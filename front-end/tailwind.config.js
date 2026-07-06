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
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.6' }],
        sm: ['0.9rem', { lineHeight: '1.7' }],
        base: ['1rem', { lineHeight: '1.8' }],
        lg: ['1.15rem', { lineHeight: '1.75' }],
        xl: ['1.35rem', { lineHeight: '1.5' }],
        '2xl': ['1.7rem', { lineHeight: '1.3' }],
        '3xl': ['2rem', { lineHeight: '1.2' }],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 12px 32px rgba(15, 23, 42, 0.08)',
        card: '0 18px 54px rgba(15, 23, 42, 0.12)',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
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
