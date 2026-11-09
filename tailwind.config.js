/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        chess: {
          dark: '#0f141c',
          card: '#18202c',
          border: '#283548',
          accent: '#10b981',
          primary: '#38bdf8',
          boardLight: '#f0d9b5',
          boardDark: '#b58863',
          evalWhite: '#ffffff',
          evalBlack: '#1e293b',
        }
      }
    },
  },
  plugins: [],
}

