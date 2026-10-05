import { formatMoney, safeImageUrl, supabase, whatsappNumber } from './supabase.js';

const $ = (selector) => document.querySelector(selector);
const CART_STORAGE_KEY = 'feira-na-porta-cart-v2';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=700&q=80';
let products = [];
let cart = loadCart();
let checkoutBusy = false;
let customerProfile = null;

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((item) =>
      item && (typeof item.id === 'string' || Number.isInteger(item.id)) && /^\d+$/.test(String(item.id)) &&
      typeof item.nome === 'string' &&
      Number.isFinite(item.preco) && Number.isInteger(item.quantidade) && item.quantidade > 0
    ).map((item) => ({ ...item, id: String(item.id) })) : [];
  } catch (error) {
    console.error('Não foi possível recuperar o carrinho salvo:', error);
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  renderCart();
}

function renderProducts() {
  const query = $('#search-input').value.trim().toLocaleLowerCase('pt-BR');
  const shown = products.filter((product) => `${product.nome} ${product.categoria} ${product.descricao || ''}`.toLocaleLowerCase('pt-BR').includes(query));
  const grid = $('#product-grid');
  grid.replaceChildren();
  $('#empty-state').classList.toggle('hidden', shown.length > 0);

  shown.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'product-card group overflow-hidden rounded-2xl border border-forest-900/[.07] bg-white shadow-card transition hover:-translate-y-1 hover:shadow-xl sm:rounded-3xl';
    const imageWrap = document.createElement('div');
    imageWrap.className = 'relative aspect-[1/1] overflow-hidden bg-forest-50 sm:aspect-[1.12/1]';
    const image = document.createElement('img');
    image.className = 'product-image h-full w-full object-cover';
    image.alt = product.nome;
    image.loading = 'lazy';
    image.src = safeImageUrl(product.imagem) || FALLBACK_IMAGE;
    image.addEventListener('error', () => { image.src = FALLBACK_IMAGE; }, { once: true });
    imageWrap.append(image);
    const category = document.createElement('span');
    category.className = 'absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-forest-700 shadow-sm sm:left-3 sm:top-3 sm:px-3 sm:text-xs';
    category.textContent = product.categoria || 'Outros';
    imageWrap.append(category);
    const content = document.createElement('div');
    content.className = 'p-3 sm:p-4';
    const title = document.createElement('h2');
    title.className = 'truncate font-display text-lg text-forest-900 sm:text-xl';
    title.textContent = product.nome;
    content.append(title);
    if (product.descricao) {
      const description = document.createElement('p');
      description.className = 'mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-forest-900/55 sm:text-sm sm:leading-5';
      description.textContent = product.descricao;
      content.append(description);
    }
    const prices = [...(product.precos_produto || [])]
      .sort((first, second) => (first.ordem ?? 0) - (second.ordem ?? 0));
    const priceList = document.createElement('ul');
    priceList.className = 'mt-3 space-y-1 text-xs font-semibold text-forest-900 sm:text-sm';
    prices.forEach((option) => {
      const line = document.createElement('li');
      line.className = 'flex flex-wrap justify-between gap-x-2';
      const unit = document.createElement('span');
      unit.className = 'text-forest-900/65';
      unit.textContent = `${option.unidade}:`;
      const amount = document.createElement('span');
      amount.textContent = formatMoney(option.preco);
      line.append(unit, amount);
      priceList.append(line);
    });
    content.append(priceList);

    const bottom = document.createElement('div');
    bottom.className = 'mt-3 flex flex-col gap-2.5 sm:mt-4';
    let selectedPrice = prices[0];
    if (prices.length > 1) {
      const priceLabel = document.createElement('label');
      priceLabel.className = 'text-xs font-semibold text-forest-900/70';
      priceLabel.textContent = 'Adicionar como';
      const priceSelect = document.createElement('select');
      priceSelect.className = 'mt-1 h-10 w-full rounded-xl border border-forest-900/10 bg-white px-3 text-xs font-semibold text-forest-900 outline-none focus:border-forest-500';
      prices.forEach((option, index) => {
        const item = document.createElement('option');
        item.value = String(index);
        item.textContent = `${option.unidade} — ${formatMoney(option.preco)}`;
        priceSelect.append(item);
      });
      priceSelect.addEventListener('change', () => {
        selectedPrice = prices[Number(priceSelect.value)];
      });
      priceLabel.append(priceSelect);
      bottom.append(priceLabel);
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'min-h-10 w-full rounded-full bg-forest-900 px-3 text-xs font-bold text-white transition hover:bg-forest-700 sm:px-4 sm:text-sm';
    add.textContent = '+ Adicionar';
    add.setAttribute('aria-label', `Adicionar ${product.nome} ao carrinho`);
    add.disabled = !selectedPrice;
    add.classList.toggle('cursor-not-allowed', !selectedPrice);
    add.classList.toggle('opacity-50', !selectedPrice);
    add.addEventListener('click', () => {
      if (selectedPrice) addToCart(product, selectedPrice);
    });
    bottom.append(add);
    content.append(bottom);
    card.append(imageWrap, content);
    grid.append(card);
  });
}

function addToCart(product, price) {
  const existing = cart.find((item) => item.id === String(product.id) && item.unidade === price.unidade);
  if (existing) existing.quantidade += 1;
  else cart.push({
    id: String(product.id),
    nome: product.nome,
    unidade: price.unidade,
    preco: Number(price.preco),
    quantidade: 1
  });
  saveCart();
}

function renderCart() {
  const container = $('#cart-items');
  container.replaceChildren();
  $('#cart-empty').classList.toggle('hidden', cart.length > 0);
  let total = 0;
  cart.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'flex items-start justify-between gap-3 py-3';
    const info = document.createElement('div');
    info.className = 'min-w-0';
    const name = document.createElement('p');
    name.className = 'text-sm font-bold text-forest-900';
    name.textContent = item.nome;
    const quantity = document.createElement('p');
    quantity.className = 'mt-1 text-xs text-forest-900/55';
    quantity.textContent = `${item.quantidade} × ${formatMoney(item.preco)} / ${item.unidade}`;
    info.append(name, quantity);
    const actions = document.createElement('div');
    actions.className = 'flex shrink-0 flex-col items-end gap-1';
    const subtotal = item.preco * item.quantidade;
    total += subtotal;
    const amount = document.createElement('span');
    amount.className = 'text-sm font-bold text-forest-900';
    amount.textContent = formatMoney(subtotal);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-xs font-semibold text-red-700 underline underline-offset-2';
    remove.textContent = 'Remover';
    remove.setAttribute('aria-label', `Remover ${item.nome} do carrinho`);
    remove.addEventListener('click', () => {
      cart = cart.filter((entry) => entry.id !== item.id || entry.unidade !== item.unidade);
      saveCart();
    });
    actions.append(amount, remove);
    row.append(info, actions);
    container.append(row);
  });
  $('#cart-total').textContent = formatMoney(total);
  $('#cart-count').textContent = String(cart.reduce((sum, item) => sum + item.quantidade, 0));
  $('#checkout-button').disabled = cart.length === 0;
}

async function fetchProducts() {
  const { data, error } = await supabase.from('produtos')
    .select('id,nome,descricao,categoria,imagem,precos_produto(unidade,preco,ordem)')
    .order('nome');
  if (error) {
    console.error('Falha ao carregar produtos:', error);
    $('#store-message').textContent = `Não foi possível carregar os produtos: ${error.message}`;
    $('#store-message').classList.remove('hidden');
    return;
  }
  products = data || [];
  $('#store-message').classList.add('hidden');
  renderProducts();
}

$('#search-input').addEventListener('input', renderProducts);
$('#share-store-button').addEventListener('click', async () => {
  const shareUrl = new URL('index.html#signup-form', window.location.href).href;
  const shareData = {
    title: 'Feira na Porta',
    text: 'Conheça a Feira na Porta e cadastre-se para escolher produtos fresquinhos.',
    url: shareUrl
  };
  const status = $('#share-message');
  status.classList.remove('hidden');

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      status.textContent = 'Obrigado por compartilhar a Feira na Porta!';
      return;
    } catch (error) {
      if (error.name === 'AbortError') {
        status.classList.add('hidden');
        return;
      }
      console.error('Não foi possível compartilhar pelo navegador:', error);
    }
  }

  try {
    if (!navigator.clipboard?.writeText) throw new Error('A cópia automática não está disponível neste navegador.');
    await navigator.clipboard.writeText(shareUrl);
    status.textContent = 'Link para cadastro copiado. Compartilhe com seus amigos!';
  } catch (error) {
    console.error('Não foi possível copiar o link de compartilhamento:', error);
    status.textContent = `Copie e compartilhe este link para cadastro: ${shareUrl}`;
  }
});

function showCheckoutMessage(message, isError = false) {
  const element = $('#checkout-message');
  element.textContent = message;
  element.classList.remove('hidden', 'bg-amber-50', 'text-amber-900', 'bg-red-50', 'text-red-800');
  element.classList.add(...(isError ? ['bg-red-50', 'text-red-800'] : ['bg-amber-50', 'text-amber-900']));
}

$('#checkout-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!cart.length || checkoutBusy) return;
  checkoutBusy = true;
  $('#checkout-button').disabled = true;
  $('#checkout-message').classList.add('hidden');
  const note = $('#customer-note').value.trim();
  try {
    if (!customerProfile) {
      throw new Error('Não foi possível carregar seu perfil. Atualize a página ou complete seus dados em Meu perfil.');
    }
    const { phone, street, house_number: houseNumber, neighborhood, city } = customerProfile;
    if (![phone, street, houseNumber, neighborhood, city].every((value) => value?.trim())) {
      throw new Error('Complete seu telefone e endereço em Meu perfil antes de finalizar o pedido.');
    }
    const number = await whatsappNumber();
    const { data, error } = await supabase.rpc('create_customer_order', {
      p_items: cart.map((item) => ({
        product_id: Number(item.id),
        unidade: item.unidade,
        quantidade: item.quantidade
      })),
      p_phone: phone,
      p_street: street,
      p_house_number: houseNumber,
      p_neighborhood: neighborhood,
      p_city: city,
      p_note: note
    });
    if (error) throw error;
    const lines = data.items.map((item) =>
      `• ${item.nome} — ${item.quantidade} × ${item.unidade} a ${formatMoney(item.preco)} = ${formatMoney(item.subtotal)}`
    );
    const message = [
      'Olá! Quero fazer um pedido na Feira na Porta.',
      `Pedido: ${data.id}`,
      '',
      ...lines,
      '',
      `Total estimado: ${formatMoney(data.total)}`,
      '',
      'DADOS PARA ENTREGA',
      `Rua: ${street}, Número: ${houseNumber}`,
      `Bairro: ${neighborhood}`,
      `Cidade: ${city}`,
      `Telefone/WhatsApp: ${phone}`,
      ...(note ? ['', `Observação: ${note}`] : []),
      '',
      'Pode confirmar a disponibilidade e combinar a entrega?'
    ];
    window.location.href = `https://wa.me/${number}?text=${encodeURIComponent(message.join('\n'))}`;
  } catch (error) {
    console.error('Falha ao finalizar pedido:', error);
    showCheckoutMessage(`Não foi possível finalizar o pedido: ${error.message || 'erro inesperado'}`, true);
    checkoutBusy = false;
    $('#checkout-button').disabled = false;
  }
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

renderCart();
fetchProducts();

async function fillCheckoutFromProfile() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sua sessão expirou. Entre novamente.');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('phone,street,house_number,neighborhood,city')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error('Perfil não encontrado. Atualize seus dados em Meu perfil.');
  customerProfile = profile;
}

fillCheckoutFromProfile().catch((error) => {
  console.error('Falha ao preencher o endereço do perfil:', error);
  showCheckoutMessage(`Não foi possível carregar os dados do perfil: ${error.message || 'erro inesperado'}`, true);
});
