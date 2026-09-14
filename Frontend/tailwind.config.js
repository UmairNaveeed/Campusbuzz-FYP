/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
        'segoe': ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        'brand': {
          'dark': '#05072F',
          'primary': '#0D4062',
        },
        'text': {
          'primary': '#000000',
          'secondary': '#536471',
          'muted': '#828282',
          'gray': '#393B41',
        },
        'border': {
          'light': '#E6E6E6',
          'medium': '#D8D8D8',
          'dark': '#C4C4C4',
        },
        'bg': {
          'widget': '#F7F9F9',
          'search': '#EFF3F4',
        },
        'action': {
          'like': '#EF1C5C',
          'retweet': '#0CB245',
          'link': '#1DA1F2',
        },
      },
      spacing: {
        '4.5': '1.125rem',
        '15': '3.75rem',
        '19': '4.75rem',
        '133': '33.25rem',
        '155': '38.75rem',
        '256': '64rem',
        '439': '109.75rem',
        '1405': '351.25rem',
      },
      lineHeight: {
        '1.21': '1.21',
        '1.33': '1.33',
      },
    },
  },
  plugins: [],
}
