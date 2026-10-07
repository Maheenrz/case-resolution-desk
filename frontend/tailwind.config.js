/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          50: '#F5F5F7', 100: '#EBEBEF', 200: '#D4D4DC', 300: '#A8A8B5', 400: '#7C7C8A',
          500: '#5E5E6C', 600: '#454551', 700: '#2E2E38', 800: '#1C1C24', 900: '#0F0F14',
        },
        paper: {
          50: '#FFFFFF', 100: '#F7F7F9', 200: '#F1F1F4', 300: '#E7E7EC', 400: '#D5D5DD',
        },
        ember: {
          50: '#FEF4EE', 100: '#FCE6D8', 200: '#F8CDB1', 300: '#F0AE82', 400: '#DE8148',
          500: '#C2571F', 600: '#A84818', 700: '#853912',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,15,20,0.04), 0 12px 32px -16px rgba(15,15,20,0.14)',
      },
    },
  },
  plugins: [],
}
