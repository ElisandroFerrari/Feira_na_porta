const THEME_KEY = 'feira-na-porta-theme';
const toggle = document.querySelector('[data-theme-toggle]');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === 'dark' ? '#111b16' : '#173b2b';
  if (!toggle) return;
  const dark = theme === 'dark';
  toggle.textContent = dark ? '☀️' : '🌙';
  toggle.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
  toggle.title = dark ? 'Ativar tema claro' : 'Ativar tema escuro';
}

const savedTheme = localStorage.getItem(THEME_KEY);
applyTheme(savedTheme === 'dark' ? 'dark' : 'light');

toggle?.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
});
