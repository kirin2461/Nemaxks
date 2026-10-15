/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'xs': '375px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        emerald: {
          50: "hsl(var(--emerald-50) / <alpha-value>)",
          100: "hsl(var(--emerald-100) / <alpha-value>)",
          200: "hsl(var(--emerald-200) / <alpha-value>)",
          300: "hsl(var(--emerald-300) / <alpha-value>)",
          400: "hsl(var(--emerald-400) / <alpha-value>)",
          500: "hsl(var(--emerald-500) / <alpha-value>)",
          600: "hsl(var(--emerald-600) / <alpha-value>)",
          700: "hsl(var(--emerald-700) / <alpha-value>)",
          800: "hsl(var(--emerald-800) / <alpha-value>)",
          900: "hsl(var(--emerald-900) / <alpha-value>)",
        },
        graphite: {
          50: "hsl(var(--graphite-50) / <alpha-value>)",
          100: "hsl(var(--graphite-100) / <alpha-value>)",
          200: "hsl(var(--graphite-200) / <alpha-value>)",
          300: "hsl(var(--graphite-300) / <alpha-value>)",
          400: "hsl(var(--graphite-400) / <alpha-value>)",
          500: "hsl(var(--graphite-500) / <alpha-value>)",
          600: "hsl(var(--graphite-600) / <alpha-value>)",
          700: "hsl(var(--graphite-700) / <alpha-value>)",
          800: "hsl(var(--graphite-800) / <alpha-value>)",
          900: "hsl(var(--graphite-900) / <alpha-value>)",
          950: "hsl(var(--graphite-950) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
          soft: "hsl(var(--success-soft) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
          soft: "hsl(var(--warning-soft) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "hsl(var(--danger) / <alpha-value>)",
          foreground: "hsl(var(--danger-foreground) / <alpha-value>)",
          soft: "hsl(var(--danger-soft) / <alpha-value>)",
        },
        online: "hsl(var(--online) / <alpha-value>)",
        idle: "hsl(var(--idle) / <alpha-value>)",
        dnd: "hsl(var(--dnd) / <alpha-value>)",
        offline: "hsl(var(--offline) / <alpha-value>)",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "var(--radius)",
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        "soft": "var(--shadow-soft)",
        "elev": "var(--shadow-elev)",
        "pop": "var(--shadow-pop)",
        "lg-brand": "var(--shadow-lg-brand)",
      },
      fontFamily: {
        display: [
          'Manrope', 'Inter', '-apple-system', 'Segoe UI', 'Noto Sans SC',
          'PingFang SC', 'Microsoft YaHei', 'sans-serif',
        ],
        sans: [
          'Inter', '-apple-system', 'Segoe UI', 'Noto Sans SC',
          'PingFang SC', 'Microsoft YaHei', 'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Noto Sans Mono CJK SC', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'spring-soft': 'cubic-bezier(0.34, 1.35, 0.64, 1)',
      },
      animation: {
        "rise-in": "rise-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in-soft": "fade-in-soft 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-in": "scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pop-menu": "pop-menu 140ms cubic-bezier(0.34, 1.35, 0.64, 1)",
        "slide-in-right": "slide-in-right 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-left": "slide-in-left 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        "drawer-up": "drawer-up 280ms cubic-bezier(0.16, 1, 0.3, 1)",
        "msg-send": "msg-send 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        "msg-receive": "msg-receive 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        "typing-bounce": "typing-bounce 1.2s infinite",
        "shimmer-sweep": "shimmer-sweep 1.4s linear infinite",
        "toast-in": "toast-in 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        "toast-out": "toast-out 180ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "progress-fill": "progress-fill 5000ms linear",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        "count-flick": "count-flick 300ms cubic-bezier(0.16, 1, 0.3, 1)",
        "bar-grow": "bar-grow 600ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "rise-in": {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        "fade-in-soft": {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        "scale-in": {
          from: { opacity: '0', transform: 'scale(.96) translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
        "pop-menu": {
          from: { opacity: '0', transform: 'scale(.95) translateY(-4px)' },
          to: { opacity: '1', transform: 'none' },
        },
        "slide-in-right": {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'none' },
        },
        "slide-in-left": {
          from: { opacity: '0', transform: 'translateX(-24px)' },
          to: { opacity: '1', transform: 'none' },
        },
        "drawer-up": {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'none' },
        },
        "msg-send": {
          from: { opacity: '0', transform: 'translateY(8px) scale(.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        "msg-receive": {
          from: { opacity: '0', transform: 'translateY(8px) scale(.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        "typing-bounce": {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '.4' },
          '30%': { transform: 'translateY(-3px)', opacity: '1' },
        },
        "shimmer-sweep": {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        "toast-in": {
          from: { opacity: '0', transform: 'translateY(-10px) scale(.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        "toast-out": {
          from: { opacity: '1' },
          to: { opacity: '0', transform: 'translateY(-8px)' },
        },
        "progress-fill": {
          from: { width: '0%' },
          to: { width: '100%' },
        },
        "pulse-ring": {
          '0%': { transform: 'scale(1)', opacity: '.55' },
          '100%': { transform: 'scale(1.65)', opacity: '0' },
        },
        "count-flick": {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        "bar-grow": {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
      },
    },
  },
  plugins: [],
}
