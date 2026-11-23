/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./product.html",
    "./assets/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          DEFAULT: '#ff7a00',
          hover: '#ff8c1a',
          600: '#ea580c',
          700: '#c2410c',
          dark: '#9a3412'
        },
        dark: {
          base: '#07080b',
          surface: '#0d0f17',
          card: '#121522',
          elevated: '#181b2c',
          border: '#1f2438',
          hover: '#1a1f32'
        }
      },
      boxShadow: {
        'brand': '0 0 25px -4px rgba(255, 122, 0, 0.35)',
        'brand-sm': '0 0 15px -2px rgba(255, 122, 0, 0.25)',
        'clean-card': '0 10px 30px -10px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
      }
    }
  },
  plugins: []
};
