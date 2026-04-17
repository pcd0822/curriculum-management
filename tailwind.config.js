/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.react.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4f46e5',
        secondary: '#7c3aed',
        tertiary: '#10b981',
        surface: '#f7f9fb',
        onSurface: '#191c1e',
        outline: '#777587',
        error: '#ba1a1a',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans KR"', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
        label: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
