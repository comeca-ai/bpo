/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        aj: {
          orange: '#F5820D',
          'orange-hover': '#E0740A',
          teal: '#2FC79E',
          'teal-hover': '#27AC86',
          'teal-dark': '#1B8F6F',
          'teal-light': '#7FE3C7',
          cream: '#FBF6EE',
          dark: '#2E2721',
          ink: '#2E2721',
          muted: '#6E5F4B',
          faint: '#A08A6B',
          border: '#E7DAC4',
          actbg: '#FFF4E6',
          'teal-soft': '#E7F8F2',
          danger: '#D9534F',
          'danger-soft': '#FBEBEA',
          whatsapp: '#25D366',
          sand: '#C9B99C',
          rail: '#F1E8D8',
          feedline: '#F5EDDE',
          caption: '#8A7960',
          page: '#FFFDF8',
          chipout: '#F7F2E8',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(47,199,158,.5)" },
          "70%": { boxShadow: "0 0 0 8px rgba(47,199,158,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(47,199,158,0)" },
        },
        slidein: {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "none" },
        },
        fadein: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.4s infinite",
        slidein: "slidein .45s ease",
        fadein: "fadein .3s ease",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}