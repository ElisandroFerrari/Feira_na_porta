tailwind.config = {
  theme: {
    extend: {
      colors: {
        forest: { 50: '#f2f7f1', 100: '#e3eee1', 200: '#c6ddc3', 500: '#498254', 600: '#356c42', 700: '#285737', 800: '#20462f', 900: '#173b2b' },
        harvest: { 100: '#fff6d9', 300: '#f6d779', 400: '#efc44f', 500: '#e5ae2f' }
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'sans-serif']
      },
      boxShadow: { card: '0 12px 36px rgba(23, 59, 43, .08)' }
    }
  }
};
