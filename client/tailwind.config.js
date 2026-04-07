/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3498db',
        'primary-dark': '#2980b9',
        header: '#2c3e50',
        success: '#2ecc71',
        danger: '#e74c3c',
      },
    },
  },
  plugins: [],
};
