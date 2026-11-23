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
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        forge: {
          navy: '#0B1727',
          deep: '#0F1E36',
          royal: '#1D4ED8',
          blue: '#2563EB',
          sky: '#38BDF8',
          yellow: '#F59E0B',
          gold: '#EAB308',
          lightYellow: '#FEF3C7',
          canvas: '#F8FAFC',
          card: '#FFFFFF'
        }
      }
    },
  },
  plugins: [],
}

