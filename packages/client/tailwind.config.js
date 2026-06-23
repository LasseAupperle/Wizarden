/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        elevated: 'var(--elevated)',
        line: 'var(--border)',
        accent: { DEFAULT: 'var(--accent)', strong: 'var(--accent-strong)' },
        gold: 'var(--gold)',
        ink: 'var(--text)',
        muted: 'var(--text-secondary)',
        positive: 'var(--positive)',
        negative: 'var(--negative)',
        suit: {
          red: 'var(--suit-red)',
          blue: 'var(--suit-blue)',
          green: 'var(--suit-green)',
          yellow: 'var(--suit-yellow)',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        ui: ['Outfit', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        ui: 'var(--radius-ui)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        sheet: 'var(--shadow-sheet)',
      },
    },
  },
  plugins: [],
};
