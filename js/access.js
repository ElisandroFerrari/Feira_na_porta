import { profileFor, supabase } from './supabase.js';

export async function requireRole(requiredRole) {
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      window.location.replace('index.html');
      return null;
    }

    const profile = await profileFor(data.session.user.id);
    if (!profile) {
      window.alert('Não foi possível encontrar seu perfil. Entre novamente ou fale com a proprietária.');
      window.location.replace('index.html');
      return null;
    }
    if (!allowedRoles.includes(profile.role)) {
      window.alert('Esta área é restrita ao perfil autorizado. Você será direcionado para sua área.');
      window.location.replace(profile.role === 'admin' ? 'admin.html' : 'client.html');
      return null;
    }

    document.documentElement.classList.remove('auth-pending');
    return { session: data.session, profile };
  } catch (error) {
    console.error('Falha ao validar acesso:', error);
    window.alert(`Não foi possível validar seu acesso: ${error.message || 'erro inesperado'}`);
    window.location.replace('index.html');
    return null;
  }
}
