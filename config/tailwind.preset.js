/**
 * Talafee Tailwind CSS Preset
 * Gold Price Comparison Platform
 *
 * Usage in tailwind.config.ts:
 * import talafeePreset from './tailwind.preset'
 * export default { presets: [talafeePreset], ... }
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Background
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
        },

        // Text
        foreground: {
          DEFAULT: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
        },

        // Border
        border: {
          DEFAULT: 'var(--color-border)',
          subtle: 'var(--color-border-subtle)',
          focus: 'var(--color-border-focus)',
        },

        // Gold accent scale
        gold: {
          50: '#FDF8E8',
          100: '#F9EDCC',
          200: '#F0D98C',
          300: '#E5C560',
          400: '#D4AF37',
          500: '#C5A028',
          600: '#A68523',
          700: '#8B6914',
          800: '#6E5310',
          900: '#4A380A',
        },

        // Semantic colors
        success: {
          DEFAULT: '#10B981',
          bg: 'var(--color-success-bg)',
        },
        danger: {
          DEFAULT: '#EF4444',
          bg: 'var(--color-danger-bg)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          bg: 'var(--color-warning-bg)',
        },
        info: {
          DEFAULT: '#3B82F6',
          bg: 'var(--color-info-bg)',
        },

        // Best deal
        'best-deal': {
          DEFAULT: '#059669',
          bg: '#D1FAE5',
        },
      },

      fontFamily: {
        display: ['Outfit', 'Vazirmatn', 'system-ui', 'sans-serif'],
        body: ['Work Sans', 'Vazirmatn', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
        persian: ['Vazirmatn', 'IRANSans', 'Tahoma', 'sans-serif'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1' }],        // 10px
        xs: ['0.75rem', { lineHeight: '1.5' }],          // 12px
        sm: ['0.875rem', { lineHeight: '1.5' }],         // 14px
        base: ['1rem', { lineHeight: '1.5' }],           // 16px
        lg: ['1.125rem', { lineHeight: '1.4' }],         // 18px
        xl: ['1.25rem', { lineHeight: '1.3' }],          // 20px
        '2xl': ['1.5rem', { lineHeight: '1.25' }],       // 24px
        '3xl': ['1.75rem', { lineHeight: '1.2' }],       // 28px
        '4xl': ['2rem', { lineHeight: '1.1' }],          // 32px

        // Price-specific sizes
        'price-lg': ['1.75rem', { lineHeight: '1.1', fontWeight: '700' }],
        'price-md': ['1.25rem', { lineHeight: '1.2', fontWeight: '600' }],
        'price-sm': ['0.875rem', { lineHeight: '1.3', fontWeight: '500' }],
      },

      spacing: {
        18: '4.5rem',   // 72px
        22: '5.5rem',   // 88px
      },

      borderRadius: {
        '4xl': '2rem',  // 32px
      },

      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
        DEFAULT: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        md: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
        gold: '0 0 0 1px #F0D98C, 0 4px 12px rgba(212, 175, 55, 0.15)',
        focus: '0 0 0 3px rgba(212, 175, 55, 0.2)',
      },

      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      animation: {
        'price-flash': 'price-flash 600ms ease-out',
        'price-up': 'price-up 600ms ease-out',
        'price-down': 'price-down 600ms ease-out',
        'skeleton': 'skeleton-pulse 1.5s ease-in-out infinite',
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
      },

      keyframes: {
        'price-flash': {
          '0%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'var(--color-gold-100)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'price-up': {
          '0%': { color: 'var(--color-text-primary)' },
          '50%': { color: '#10B981' },
          '100%': { color: 'var(--color-text-primary)' },
        },
        'price-down': {
          '0%': { color: 'var(--color-text-primary)' },
          '50%': { color: '#EF4444' },
          '100%': { color: 'var(--color-text-primary)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },

      zIndex: {
        dropdown: 100,
        sticky: 200,
        'modal-backdrop': 300,
        modal: 400,
        toast: 500,
        tooltip: 600,
      },
    },
  },
  plugins: [],
}
