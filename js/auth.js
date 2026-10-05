import { profileFor, supabase, whatsappNumber } from './supabase.js';

const $ = (selector) => document.querySelector(selector);
const notice = $('#auth-message');

function showMessage(message, isError = false) {
  notice.textContent = message;
  notice.classList.remove('hidden', 'border-amber-300', 'bg-amber-50', 'text-amber-900', 'border-red-300', 'bg-red-50', 'text-red-800');
  notice.classList.add(...(isError ? ['border-red-300', 'bg-red-50', 'text-red-800'] : ['border-amber-300', 'bg-amber-50', 'text-amber-900']));
}

async function redirectByRole(userId) {
  const profile = await profileFor(userId);
  if (!profile) throw new Error('Perfil não encontrado. Execute o schema do Supabase e tente novamente.');
  if (profile.role === 'admin') {
    window.location.replace('admin.html');
  } else {
    window.location.replace('client.html');
  }
}

async function withBusyButton(form, callback) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await callback();
  } catch (error) {
    console.error('Falha na autenticação:', error);
    showMessage(error.message || 'Não foi possível concluir a operação. Tente novamente.', true);
  } finally {
    button.disabled = false;
  }
}

$('#login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  withBusyButton(form, async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.elements.email.value.trim(),
      password: form.elements.password.value
    });
    if (error) throw error;
    await redirectByRole(data.user.id);
  });
});

$('#signup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  withBusyButton(form, async () => {
    const { data, error } = await supabase.auth.signUp({
      email: form.elements.email.value.trim(),
      password: form.elements.password.value,
      options: { data: { full_name: form.elements.name.value.trim() } }
    });
    if (error?.message?.includes('Database error saving new user')) {
      throw new Error('O Supabase não conseguiu criar o perfil do cliente. Peça ao administrador para reaplicar a configuração do trigger de cadastro descrita em “Problemas no cadastro” no README.');
    }
    if (error) throw error;
    if (data.session && data.user) {
      await redirectByRole(data.user.id);
      return;
    }
    showMessage('Cadastro iniciado! Confira seu e-mail para confirmar a conta e depois entre por aqui.');
    form.reset();
  });
});

async function redirectExistingSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) await redirectByRole(data.session.user.id);
  } catch (error) {
    console.error('Falha ao verificar sessão existente:', error);
    showMessage(`Não foi possível verificar sua sessão: ${error.message || 'erro inesperado'}`, true);
  }
}

$('#current-year').textContent = String(new Date().getFullYear());
redirectExistingSession();

whatsappNumber().then((number) => {
  document.querySelectorAll('[data-whatsapp-link]').forEach((link) => {
    link.href = `https://wa.me/${number}`;
  });
  const localNumber = number.startsWith('55') ? number.slice(2) : number;
  const displayNumber = localNumber.length === 11
    ? `(${localNumber.slice(0, 2)}) ${localNumber.slice(2, 7)}-${localNumber.slice(7)}`
    : localNumber.length === 10
      ? `(${localNumber.slice(0, 2)}) ${localNumber.slice(2, 6)}-${localNumber.slice(6)}`
      : number;
  document.querySelectorAll('[data-whatsapp-number]').forEach((element) => {
    element.textContent = number.startsWith('55') ? `+55 ${displayNumber}` : displayNumber;
  });
}).catch((error) => {
  console.error('Falha ao carregar contato da feira:', error);
});
