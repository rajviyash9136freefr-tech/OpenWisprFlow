/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"EB Garamond"', 'Garamond', 'Newsreader', 'Georgia', 'serif'],
        sans: ['Figtree', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"Google Sans Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        stone: {
          50: '#F8F8F6',
          100: '#F2F1ED',
          200: '#E5E4DE',
          300: '#D5D4CE',
          400: '#A8A7A0',
          500: '#717069',
          600: '#52514B',
          700: '#3D3C37',
          800: '#2A2925',
          900: '#1A1917',
        },
      },
    },
  },
  plugins: [],
}
