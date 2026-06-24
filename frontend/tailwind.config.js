/** @type {import('tailwindcss').Config} */
// Branding note: the Facebook reference (fb.com/juanpalamanofficial) is login-
// gated, so these are a warm Filipino-food-inspired palette. Swap the hex
// values here to match the real brand guide — every screen reads from these.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9f1',
          100: '#d2f0db',
          200: '#a6e1b9',
          300: '#6fcd90',
          400: '#34b46a',
          500: '#0b9444', // Tasty Food brand green
          600: '#0a7d3a',
          700: '#0a632f',
          800: '#0a4f28',
          900: '#083f22',
        },
        gold: {
          400: '#f7b733',
          500: '#f0a202', // golden accent
          600: '#cc8400',
        },
        cream: '#fdf8f1',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
