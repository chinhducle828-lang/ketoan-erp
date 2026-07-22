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
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.6' }],
        sm: ['0.9rem', { lineHeight: '1.7' }],
        base: ['1rem', { lineHeight: '1.8' }],
        lg: ['1.15rem', { lineHeight: '1.75' }],
        xl: ['1.35rem', { lineHeight: '1.5' }],
        '2xl': ['1.7rem', { lineHeight: '1.3' }],
        '3xl': ['2rem', { lineHeight: '1.2' }],
        '4xl': ['2.5rem', { lineHeight: '1.1' }],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        soft: '0 12px 32px rgba(15, 23, 42, 0.08)',
        card: '0 18px 54px rgba(15, 23, 42, 0.12)',
        'premium': '0 4px 14px rgba(79, 70, 229, 0.3)',
        'premium-lg': '0 6px 20px rgba(79, 70, 229, 0.4)',
        'premium-sm': '0 2px 8px rgba(79, 70, 229, 0.3)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        'glass': '0 8px 32px rgba(79, 70, 229, 0.04)',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        'gradient-subtle': 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 50%, #F8FAFC 100%)',
        'gradient-danger': 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
        'gradient-success': 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #0B0F19 0%, #0F172A 50%, #0B0F19 100%)',
      },
      colors: {
        premium: {
          bg: {
            base: 'var(--color-bg-base)',
            surface: 'var(--color-bg-surface)',
            elevated: 'var(--color-bg-elevated)',
          },
          text: {
            base: 'var(--color-text-base)',
            secondary: 'var(--color-text-secondary)',
            muted: 'var(--color-text-muted)',
          },
          border: {
            subtle: 'var(--color-border-subtle)',
            default: 'var(--color-border-default)',
          },
          primary: {
            DEFAULT: 'var(--color-primary)',
            light: 'var(--color-primary-light)',
            dark: 'var(--color-primary-dark)',
          },
          success: {
            DEFAULT: 'var(--color-success)',
            light: 'var(--color-success-light)',
          },
          warning: {
            DEFAULT: 'var(--color-warning)',
            light: 'var(--color-warning-light)',
          },
          danger: {
            DEFAULT: 'var(--color-danger)',
            light: 'var(--color-danger-light)',
          },
          info: {
            DEFAULT: 'var(--color-info)',
            light: 'var(--color-info-light)',
          },
        },
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
};