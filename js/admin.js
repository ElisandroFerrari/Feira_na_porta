import { formatMoney, safeImageUrl, supabase } from './supabase.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#product-form');
let busy = false;
let ownerUser;
let adminProfileLoaded = false;
const ORDER_STATUS_LABELS = {
  pending: 'Pendente',
  completed: 'Concluído',
  cancelled: 'Cancelado'
};
const ORDER_STATUS_CLASSES = {
  pending: 'order-status order-status-pending',
  completed: 'order-status order-status-completed',
  cancelled: 'order-status order-status-cancelled'
};

function setError(element, message) {
  element.textContent = message;
  element.classList.toggle('hidden', !message);
}

function clearForm() {
  form.reset();
  form.elements.id.value = '';
  form.elements.categoria.value = 'Outros';
  renderPriceFields();
  $('#form-title').textContent = 'Adicionar produto';
  $('#save-button').textContent = 'Salvar produto';
  $('#cancel-edit').classList.add('hidden');
  setError($('#form-error'), '');
}

const PRICE_TYPES = ['Caixa', 'Kg', 'Grama', 'Unidade', 'Maço', 'Litro', 'Outro'];

function addPriceRow(price = {}) {
  const row = document.createElement('div');
  row.dataset.priceRow = '';
  row.className = 'grid gap-2 rounded-xl bg-forest-50/70 p-3 sm:grid-cols-2';

  const typeLabel = document.createElement('label');
  typeLabel.className = 'block text-xs font-semibold text-forest-900';
  typeLabel.textContent = 'Tipo';
  const type = document.createElement('select');
  type.dataset.priceType = '';
  type.className = 'mt-1 h-10 w-full rounded-lg border border-forest-900/10 bg-white px-2 text-sm font-normal outline-none focus:border-forest-500';
  PRICE_TYPES.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    type.append(option);
  });
  typeLabel.append(type);

  const amountLabel = document.createElement('label');
  amountLabel.className = 'block text-xs font-semibold text-forest-900';
  amountLabel.textContent = 'Preço (R$)';
  const amount = document.createElement('input');
  amount.dataset.priceAmount = '';
  amount.type = 'number';
  amount.min = '0.01';
  amount.step = '0.01';
  amount.required = true;
  amount.value = price.preco ?? '';
  amount.placeholder = '0,00';
  amount.className = 'mt-1 h-10 w-full rounded-lg border border-forest-900/10 bg-white px-2 text-sm font-normal outline-none focus:border-forest-500';
  amountLabel.append(amount);

  const customLabel = document.createElement('label');
  customLabel.className = 'hidden text-xs font-semibold text-forest-900';
  customLabel.dataset.priceCustomLabel = '';
  const detailTitle = document.createElement('span');
  const detail = document.createElement('input');
  detail.dataset.priceDetail = '';
  detail.maxLength = '40';
  detail.className = 'mt-1 h-10 w-full rounded-lg border border-forest-900/10 bg-white px-2 text-sm font-normal outline-none focus:border-forest-500';
  customLabel.append(detailTitle, detail);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'self-end rounded-full px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50';
  remove.textContent = 'Remover';
  remove.setAttribute('aria-label', 'Remover esta opção de preço');
  remove.addEventListener('click', () => row.remove());

  const savedUnit = String(price.unidade || '');
  const savedType = PRICE_TYPES.find((value) => value !== 'Outro' && (savedUnit === value || savedUnit.startsWith(`${value} `))) || 'Outro';
  type.value = savedType;
  detail.value = savedType === 'Outro'
    ? savedUnit
    : savedUnit === savedType ? '' : savedUnit.slice(savedType.length).trim();

  const updateDetail = () => {
    const show = ['Caixa', 'Grama', 'Outro'].includes(type.value);
    customLabel.classList.toggle('hidden', !show);
    detailTitle.textContent = type.value === 'Caixa'
      ? 'Detalhe (opcional)'
      : type.value === 'Grama' ? 'Peso' : 'Nome da unidade';
    detail.placeholder = type.value === 'Caixa'
      ? 'Ex.: 20kg'
      : type.value === 'Grama' ? 'Ex.: 500g ou 50g' : 'Ex.: dúzia';
    detail.required = type.value === 'Outro' || type.value === 'Grama';
  };
  type.addEventListener('change', updateDetail);
  updateDetail();

  row.append(typeLabel, amountLabel, customLabel, remove);
  $('#prices-container').append(row);
}

function renderPriceFields(prices = []) {
  const container = $('#prices-container');
  container.replaceChildren();
  (prices.length ? prices : [{}]).forEach(addPriceRow);
}

function pricesForProduct(product) {
  return [...(product.precos_produto || [])]
    .sort((first, second) => (first.ordem ?? 0) - (second.ordem ?? 0));
}

function priceSummary(product) {
  return pricesForProduct(product)
    .map((price) => `${price.unidade}: ${formatMoney(price.preco)}`)
    .join(' | ');
}

function editProduct(product) {
  form.elements.id.value = product.id;
  form.elements.nome.value = product.nome;
  form.elements.descricao.value = product.descricao || '';
  form.elements.categoria.value = product.categoria;
  renderPriceFields(pricesForProduct(product));
  form.elements.imagem_url.value = product.imagem || '';
  form.elements.imagem_arquivo.value = '';
  $('#form-title').textContent = 'Editar produto';
  $('#save-button').textContent = 'Salvar alterações';
  $('#cancel-edit').classList.remove('hidden');
  setError($('#form-error'), '');
  form.elements.nome.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderProducts(products) {
  const list = $('#product-list');
  list.replaceChildren();
  $('#product-count').textContent = `${products.length} produto${products.length === 1 ? '' : 's'} cadastrado${products.length === 1 ? '' : 's'}`;
  if (!products.length) {
    const empty = document.createElement('p');
    empty.className = 'p-5 text-sm text-forest-900/55';
    empty.textContent = 'Nenhum produto cadastrado. Adicione o primeiro ao formulário.';
    list.append(empty);
    return;
  }

  products.forEach((product) => {
    const row = document.createElement('article');
    row.className = 'flex items-center gap-3 p-3 sm:p-4';
    const image = document.createElement('img');
    image.className = 'h-14 w-14 rounded-xl bg-forest-50 object-cover';
    image.alt = '';
    image.src = safeImageUrl(product.imagem) || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=120&q=70';
    image.addEventListener('error', () => { image.removeAttribute('src'); }, { once: true });
    const details = document.createElement('div');
    details.className = 'min-w-0 flex-1';
    const name = document.createElement('p');
    name.className = 'truncate text-sm font-bold text-forest-900';
    name.textContent = product.nome;
    const meta = document.createElement('p');
    meta.className = 'mt-0.5 truncate text-xs text-forest-900/55';
    meta.textContent = `${product.categoria} · ${priceSummary(product) || 'Sem preços cadastrados'}`;
    details.append(name, meta);
    const actions = document.createElement('div');
    actions.className = 'flex shrink-0 gap-1.5';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'rounded-full border border-forest-900/15 px-3 py-1.5 text-xs font-semibold hover:bg-forest-50';
    edit.textContent = 'Editar';
    edit.addEventListener('click', () => editProduct(product));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50';
    remove.textContent = 'Excluir';
    remove.addEventListener('click', () => deleteProduct(product));
    actions.append(edit, remove);
    row.append(image, details, actions);
    list.append(row);
  });
}

async function loadProducts() {
  setError($('#list-error'), '');
  $('#product-count').textContent = 'Carregando...';
  const { data, error } = await supabase.from('produtos')
    .select('id,nome,descricao,categoria,imagem,precos_produto(unidade,preco,ordem)')
    .order('nome');
  if (error) {
    console.error('Falha ao carregar produtos:', error);
    $('#product-count').textContent = 'Não foi possível carregar.';
    setError($('#list-error'), `Erro ao carregar produtos: ${error.message}`);
    return;
  }
  renderProducts(data || []);
}

function tableCell(text, className = 'p-3 align-top', label) {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text || '—';
  if (label) cell.dataset.label = label;
  return cell;
}

function formatAddress(record) {
  const street = [record.street, record.house_number].filter(Boolean).join(', ');
  return [street, record.neighborhood, record.city].filter(Boolean).join(' · ');
}

function renderOrders(orders) {
  const tbody = $('#orders-table');
  tbody.replaceChildren();
  $('#orders-count').textContent = `${orders.length} pedido${orders.length === 1 ? '' : 's'}`;
  if (!orders.length) {
    const row = document.createElement('tr');
    const cell = tableCell('Ainda não há pedidos registrados.', 'p-5 text-center text-forest-900/55');
    cell.colSpan = 6;
    row.append(cell);
    tbody.append(row);
    return;
  }

  orders.forEach((order) => {
    const row = document.createElement('tr');
    const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(order.created_at));
    row.append(tableCell(`#${order.id.slice(0, 8)}\n${date}`, 'whitespace-pre-line p-3 align-top', 'Pedido / data'));

    const customerCell = document.createElement('td');
    customerCell.className = 'p-3 align-top';
    customerCell.dataset.label = 'Cliente';
    const customerName = document.createElement('p');
    customerName.className = 'font-semibold text-forest-900';
    customerName.textContent = order.customer_name || 'Cliente';
    const customerEmail = document.createElement('p');
    customerEmail.className = 'mt-1 text-xs text-forest-900/55';
    customerEmail.textContent = order.customer_email || '';
    customerCell.append(customerName, customerEmail);
    row.append(customerCell);

    const itemList = (Array.isArray(order.items) ? order.items : [])
      .map((item) => `${item.quantidade} × ${item.nome} (${item.unidade}) — ${formatMoney(item.subtotal)}`)
      .join('\n');
    row.append(tableCell(itemList, 'whitespace-pre-line p-3 align-top', 'Produtos'));
    row.append(tableCell(formatMoney(order.total), 'p-3 align-top font-bold text-forest-900', 'Total'));

    const deliveryCell = document.createElement('td');
    deliveryCell.className = 'p-3 align-top';
    deliveryCell.dataset.label = 'Entrega';
    const address = document.createElement('p');
    address.textContent = formatAddress(order);
    const phone = document.createElement('p');
    phone.className = 'mt-1 text-xs text-forest-900/55';
    phone.textContent = order.phone;
    const note = document.createElement('p');
    note.className = 'mt-1 text-xs italic text-forest-900/55';
    note.textContent = order.note ? `Obs.: ${order.note}` : '';
    deliveryCell.append(address, phone, note);
    row.append(deliveryCell);

    const statusCell = document.createElement('td');
    statusCell.className = 'p-3 align-top';
    statusCell.dataset.label = 'Status / ações';
    const status = document.createElement('span');
    const renderStatus = () => {
      status.className = ORDER_STATUS_CLASSES[order.status] || ORDER_STATUS_CLASSES.pending;
      status.textContent = ORDER_STATUS_LABELS[order.status] || ORDER_STATUS_LABELS.pending;
    };
    renderStatus();
    statusCell.append(status);

    const actions = document.createElement('div');
    actions.className = 'flex flex-wrap gap-2';
    const statusButtons = [];
    const updateStatus = async (nextStatus) => {
      if (order.status !== 'pending') return;
      statusButtons.forEach((button) => { button.disabled = true; });
      try {
        const { error } = await supabase.from('orders')
          .update({ status: nextStatus })
          .eq('id', order.id);
        if (error) throw error;
        order.status = nextStatus;
        renderStatus();
        actions.remove();
        setError($('#orders-error'), '');
      } catch (error) {
        console.error('Falha ao atualizar status do pedido:', error);
        setError($('#orders-error'), `Não foi possível atualizar o status: ${error.message}`);
      } finally {
        statusButtons.forEach((button) => {
          button.disabled = button.dataset.status === order.status;
        });
      }
    };

    const availableActions = order.status === 'pending' ? [
      { value: 'completed', label: 'Concluído', className: 'rounded-full bg-forest-900 px-3 py-2 text-xs font-semibold text-white hover:bg-forest-700' },
      { value: 'cancelled', label: 'Cancelado', className: 'rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50' }
    ] : [];
    availableActions.forEach(({ value, label, className }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.textContent = label;
      button.dataset.status = value;
      button.disabled = order.status === value;
      button.addEventListener('click', () => updateStatus(value));
      statusButtons.push(button);
      actions.append(button);
    });
    if (statusButtons.length) statusCell.append(actions);
    row.append(statusCell);
    tbody.append(row);
  });
}

async function loadOrders() {
  setError($('#orders-error'), '');
  $('#orders-count').textContent = 'Carregando...';
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Falha ao carregar pedidos:', error);
    $('#orders-count').textContent = 'Não foi possível carregar.';
    setError($('#orders-error'), `Erro ao carregar pedidos: ${error.message}`);
    return;
  }
  renderOrders(data || []);
}

function renderCustomers(customers) {
  const tbody = $('#customers-table');
  tbody.replaceChildren();
  $('#customers-count').textContent = `${customers.length} cliente${customers.length === 1 ? '' : 's'}`;
  if (!customers.length) {
    const row = document.createElement('tr');
    const cell = tableCell('Ainda não há clientes cadastrados.', 'p-5 text-center text-forest-900/55');
    cell.colSpan = 4;
    row.append(cell);
    tbody.append(row);
    return;
  }
  customers.forEach((customer) => {
    const row = document.createElement('tr');
    row.append(
      tableCell(customer.full_name, 'p-3 align-top', 'Nome'),
      tableCell(customer.email, 'p-3 align-top', 'E-mail'),
      tableCell(customer.phone, 'p-3 align-top', 'Telefone'),
      tableCell(formatAddress(customer), 'p-3 align-top', 'Endereço')
    );
    tbody.append(row);
  });
}

async function loadCustomers() {
  setError($('#customers-error'), '');
  $('#customers-count').textContent = 'Carregando...';
  const { data, error } = await supabase.rpc('admin_customer_list');
  if (error) {
    console.error('Falha ao carregar clientes:', error);
    $('#customers-count').textContent = 'Não foi possível carregar.';
    setError($('#customers-error'), `Erro ao carregar clientes: ${error.message}`);
    return;
  }
  renderCustomers(data || []);
}

function showProfileMessage(element, message, isError = false) {
  if (!message) {
    element.textContent = '';
    element.classList.add('hidden');
    return;
  }
  element.textContent = message;
  element.classList.remove('hidden', 'bg-amber-50', 'text-amber-900', 'bg-red-50', 'text-red-800');
  element.classList.add(...(isError ? ['bg-red-50', 'text-red-800'] : ['bg-amber-50', 'text-amber-900']));
}

function setProfileFormBusy(formElement, isBusy) {
  formElement.querySelector('button[type="submit"]').disabled = isBusy;
}

async function loadAdminProfile() {
  showProfileMessage($('#admin-profile-message'), '');
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Sua sessão expirou. Entre novamente.');
    ownerUser = data.user;
    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('full_name,phone,street,house_number,neighborhood,city')
      .eq('user_id', ownerUser.id)
      .single();
    if (profileError) throw profileError;
    const profileForm = $('#admin-profile-form');
    for (const field of ['full_name', 'phone', 'street', 'house_number', 'neighborhood', 'city']) {
      profileForm.elements[field].value = profile[field] || '';
    }
    $('#admin-current-email').textContent = `E-mail atual: ${ownerUser.email}`;
    const securityForm = $('#admin-security-form');
    securityForm.elements.email.value = ownerUser.email || '';
    adminProfileLoaded = true;
  } catch (error) {
    console.error('Falha ao carregar perfil da proprietária:', error);
    showProfileMessage($('#admin-profile-message'), `Não foi possível carregar o perfil: ${error.message || 'erro inesperado'}`, true);
  }
}

$('#admin-profile-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!ownerUser) return;
  const profileForm = event.currentTarget;
  setProfileFormBusy(profileForm, true);
  try {
    const values = Object.fromEntries(
      ['full_name', 'phone', 'street', 'house_number', 'neighborhood', 'city']
        .map((field) => [field, profileForm.elements[field].value.trim()])
    );
    const phoneDigits = values.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      throw new Error('Informe o telefone com DDD e, se necessário, o código do país.');
    }
    const { error } = await supabase.from('profiles').update(values).eq('user_id', ownerUser.id);
    if (error) throw error;
    adminProfileLoaded = false;
    showProfileMessage($('#admin-profile-message'), 'Perfil salvo. O novo telefone será usado nos próximos acessos ao site e nos próximos pedidos.');
  } catch (error) {
    console.error('Falha ao salvar perfil da proprietária:', error);
    showProfileMessage($('#admin-profile-message'), `Não foi possível salvar o perfil: ${error.message || 'erro inesperado'}`, true);
  } finally {
    setProfileFormBusy(profileForm, false);
  }
});

$('#admin-security-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!ownerUser) return;
  const securityForm = event.currentTarget;
  setProfileFormBusy(securityForm, true);
  try {
    const email = securityForm.elements.email.value.trim();
    const password = securityForm.elements.password.value;
    const updates = {};
    if (email && email !== ownerUser.email) updates.email = email;
    if (password) updates.password = password;
    if (!Object.keys(updates).length) throw new Error('Informe um novo e-mail ou uma nova senha.');
    const { data, error } = await supabase.auth.updateUser(updates);
    if (error) throw error;
    ownerUser = data.user;
    securityForm.elements.email.value = ownerUser.email || email;
    securityForm.elements.password.value = '';
    $('#admin-current-email').textContent = `E-mail atual: ${ownerUser.email}`;
    showProfileMessage(
      $('#admin-security-message'),
      updates.email
        ? 'Solicitação enviada. Confirme o novo e-mail pelo link enviado pelo Supabase; a alteração pode exigir confirmação por e-mail.'
        : 'Sua senha foi atualizada.'
    );
  } catch (error) {
    console.error('Falha ao atualizar acesso da proprietária:', error);
    showProfileMessage($('#admin-security-message'), `Não foi possível atualizar: ${error.message || 'erro inesperado'}`, true);
  } finally {
    setProfileFormBusy(securityForm, false);
  }
});

function showAdminTab(tabName) {
  const panels = {
    products: $('#products-panel'),
    orders: $('#orders-panel'),
    customers: $('#customers-panel'),
    profile: $('#profile-panel')
  };
  Object.entries(panels).forEach(([name, panel]) => panel.classList.toggle('hidden', name !== tabName));
  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    const active = button.dataset.adminTab === tabName;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('bg-forest-900', active);
    button.classList.toggle('text-white', active);
    button.classList.toggle('border', !active);
    button.classList.toggle('border-forest-900/15', !active);
  });
  if (tabName === 'orders') loadOrders();
  if (tabName === 'customers') loadCustomers();
  if (tabName === 'profile' && !adminProfileLoaded) loadAdminProfile();
}

async function imageForProduct(file, rawUrl, userId) {
  if (file) {
    if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem válido.');
    if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 5 MB.');
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'image';
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  }
  if (!rawUrl) return null;
  const url = safeImageUrl(rawUrl);
  if (!url) throw new Error('Informe uma URL de imagem válida (http ou https).');
  return url;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  setError($('#form-error'), '');
  busy = true;
  $('#save-button').disabled = true;
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('Sua sessão expirou. Entre novamente.');
    const values = {
      nome: form.elements.nome.value.trim(),
      descricao: form.elements.descricao.value.trim(),
      categoria: form.elements.categoria.value.trim()
    };
    if (!values.nome || !values.categoria) throw new Error('Preencha o nome e a categoria.');
    const prices = [...$('#prices-container').querySelectorAll('[data-price-row]')].map((row) => {
      const type = row.querySelector('[data-price-type]').value;
      const detail = row.querySelector('[data-price-detail]').value.trim();
      const unidade = type === 'Outro' ? detail : ['Caixa', 'Grama'].includes(type) && detail ? `${type} ${detail}` : type;
      return { unidade, preco: Number(row.querySelector('[data-price-amount]').value) };
    });
    if (!prices.length) throw new Error('Adicione pelo menos uma opção de preço.');
    if (prices.some((price) => !price.unidade || price.unidade.length > 40 || !Number.isFinite(price.preco) || price.preco <= 0)) {
      throw new Error('Informe uma unidade e um preço maior que zero para cada opção.');
    }
    const normalizedUnits = prices.map((price) => price.unidade.trim().toLocaleLowerCase('pt-BR'));
    if (new Set(normalizedUnits).size !== normalizedUnits.length) {
      throw new Error('Cada opção precisa ter um tipo de unidade diferente.');
    }
    const valuesWithImage = {
      ...values,
      imagem: await imageForProduct(form.elements.imagem_arquivo.files[0], form.elements.imagem_url.value.trim(), session.user.id)
    };
    const id = form.elements.id.value;
    const { error } = await supabase.rpc('save_product_with_prices', {
      p_product_id: id || null,
      p_nome: valuesWithImage.nome,
      p_descricao: valuesWithImage.descricao,
      p_categoria: valuesWithImage.categoria,
      p_imagem: valuesWithImage.imagem,
      p_precos: prices
    });
    if (error) throw error;
    clearForm();
    await loadProducts();
  } catch (error) {
    console.error('Falha ao salvar produto:', error);
    setError($('#form-error'), `Não foi possível salvar: ${error.message || 'erro inesperado'}`);
  } finally {
    busy = false;
    $('#save-button').disabled = false;
  }
});

async function deleteProduct(product) {
  if (!window.confirm(`Excluir "${product.nome}" do catálogo?`)) return;
  setError($('#list-error'), '');
  const { error } = await supabase.from('produtos').delete().eq('id', product.id);
  if (error) {
    console.error('Falha ao excluir produto:', error);
    setError($('#list-error'), `Não foi possível excluir: ${error.message}`);
    return;
  }
  await loadProducts();
}

$('#cancel-edit').addEventListener('click', clearForm);
$('#add-price-button').addEventListener('click', () => addPriceRow());
$('#refresh-button').addEventListener('click', loadProducts);
$('#refresh-orders').addEventListener('click', loadOrders);
$('#refresh-customers').addEventListener('click', loadCustomers);
document.querySelectorAll('[data-admin-tab]').forEach((button) => {
  button.addEventListener('click', () => showAdminTab(button.dataset.adminTab));
});
$('#logout-button').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Falha ao sair:', error);
    window.alert(`Não foi possível encerrar a sessão: ${error.message}`);
    return;
  }
  window.location.replace('index.html');
});

loadProducts();
renderPriceFields();
