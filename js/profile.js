import { profileFor, supabase } from './supabase.js';

const $ = (selector) => document.querySelector(selector);
const profileForm = $('#profile-form');
const securityForm = $('#security-form');
let currentUser;

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.remove('hidden', 'bg-amber-50', 'text-amber-900', 'bg-red-50', 'text-red-800');
  element.classList.add(...(isError ? ['bg-red-50', 'text-red-800'] : ['bg-amber-50', 'text-amber-900']));
}

function setBusy(form, busy) {
  form.querySelector('button[type="submit"]').disabled = busy;
}

async function loadProfile() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sua sessão expirou. Entre novamente.');
  currentUser = data.user;
  const profile = await profileFor(currentUser.id);
  if (!profile) throw new Error('Não foi possível encontrar seus dados cadastrais.');
  const { data: details, error: detailsError } = await supabase.from('profiles')
    .select('phone,street,house_number,neighborhood,city')
    .eq('user_id', currentUser.id)
    .single();
  if (detailsError) throw detailsError;
  for (const field of ['full_name', 'phone', 'street', 'house_number', 'neighborhood', 'city']) {
    profileForm.elements[field].value = (field === 'full_name' ? profile[field] : details[field]) || '';
  }
  $('#current-email').textContent = `E-mail atual: ${currentUser.email}`;
  securityForm.elements.email.value = currentUser.email || '';
}

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(profileForm, true);
  try {
    const values = Object.fromEntries(
      ['full_name', 'phone', 'street', 'house_number', 'neighborhood', 'city']
        .map((field) => [field, profileForm.elements[field].value.trim()])
    );
    const { error } = await supabase.from('profiles')
      .update(values)
      .eq('user_id', currentUser.id);
    if (error) throw error;
    showMessage($('#profile-message'), 'Seus dados foram salvos.');
  } catch (error) {
    console.error('Falha ao salvar perfil:', error);
    showMessage($('#profile-message'), `Não foi possível salvar seus dados: ${error.message || 'erro inesperado'}`, true);
  } finally {
    setBusy(profileForm, false);
  }
});

securityForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(securityForm, true);
  try {
    const email = securityForm.elements.email.value.trim();
    const password = securityForm.elements.password.value;
    const updates = {};
    if (email && email !== currentUser.email) updates.email = email;
    if (password) updates.password = password;
    if (!Object.keys(updates).length) throw new Error('Informe um novo e-mail ou uma nova senha.');
    const { data, error } = await supabase.auth.updateUser(updates);
    if (error) throw error;
    currentUser = data.user;
    securityForm.elements.password.value = '';
    securityForm.elements.email.value = currentUser.email || email;
    $('#current-email').textContent = `E-mail atual: ${currentUser.email}`;
    showMessage(
      $('#security-message'),
      updates.email
        ? 'Solicitação enviada. Confirme o novo endereço pelo link enviado pelo Supabase; a alteração pode exigir confirmação por e-mail.'
        : 'Sua senha foi atualizada.'
    );
  } catch (error) {
    console.error('Falha ao atualizar dados de acesso:', error);
    showMessage($('#security-message'), `Não foi possível atualizar: ${error.message || 'erro inesperado'}`, true);
  } finally {
    setBusy(securityForm, false);
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

loadProfile().catch((error) => {
  console.error('Falha ao carregar perfil:', error);
  showMessage($('#profile-message'), `Não foi possível carregar seu perfil: ${error.message || 'erro inesperado'}`, true);
});
