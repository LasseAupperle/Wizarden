/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Wizard suit colours (kept here so UI never hardcodes hex per component).
        suit: {
          red: '#e23b3b',
          blue: '#2f6fe0',
          green: '#2ea24d',
          yellow: '#e6b422',
        },
      },
    },
  },
  plugins: [],
};
