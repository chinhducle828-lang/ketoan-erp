/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Unified Design Token System
        erp: {
          bg: {
            base: 'var(--color-bg-base)',
            surface: 'var(--color-bg-surface)',
          },
          border: {
            subtle: 'var(--color-border-subtle)',
          },
          primary: 'var(--color-primary)',
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          danger: 'var(--color-danger)',
        },
        storefront: {
          bg: {
            base: 'var(--color-bg-base)',
            surface: 'var(--color-bg-surface)',
          },
          border: {
            subtle: 'var(--color-border-subtle)',
          },
          primary: 'var(--color-primary)',
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          danger: 'var(--color-danger)',
        },
      },
    },
  },
  plugins: [],
}
