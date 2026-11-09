/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: '#F3E5CF',
          light: '#F8EFE2',
          dark: '#E8D4BA',
        },
        cream: {
          DEFAULT: '#FFF7EA',
          light: '#FFFDF9',
          dark: '#F7EDDC',
        },
        beige: {
          DEFAULT: '#E6D1B5',
          light: '#EDE0CC',
          dark: '#D8BE9E',
        },
        taupe: {
          DEFAULT: '#BBA58C',
          light: '#C7B5A0',
          dark: '#A68F74',
        },
        espresso: {
          DEFAULT: '#482A18',
          light: '#5E3821',
          dark: '#382012',
        },
        chocolate: {
          DEFAULT: '#301B10',
          light: '#3F2416',
          dark: '#21120B',
        },
        ink: {
          DEFAULT: '#241A14',
          muted: '#524339',
          faint: '#857467',
        },
        archBorder: {
          DEFAULT: '#C9B49A',
          light: '#DBC9B3',
          dark: '#B0987B',
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        display: ['"Playfair Display"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Inter"', '"Manrope"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'arch-sm': '0 1px 3px rgba(48, 27, 16, 0.06), 0 1px 2px rgba(48, 27, 16, 0.04)',
        'arch-md': '0 4px 14px rgba(48, 27, 16, 0.08), 0 2px 6px rgba(48, 27, 16, 0.04)',
        'arch-lg': '0 10px 30px rgba(48, 27, 16, 0.10), 0 4px 12px rgba(48, 27, 16, 0.06)',
        'arch-card': '0 2px 8px rgba(72, 42, 24, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        'glass': '0 8px 32px 0 rgba(48, 27, 16, 0.05), inset 0 1px 0 0 rgba(255, 255, 255, 0.7)',
        'glass-hover': '0 14px 44px 0 rgba(48, 27, 16, 0.09), inset 0 1px 0 0 rgba(255, 255, 255, 0.85)',
        'glass-nav': '0 4px 28px -2px rgba(48, 27, 16, 0.05), 0 1px 2px 0 rgba(48, 27, 16, 0.03)',
        'glass-card': '0 4px 20px 0 rgba(48, 27, 16, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
        'glass-card-hover': '0 12px 36px 0 rgba(48, 27, 16, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
      },
      backdropBlur: {
        'xs': '2px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
      },
      borderRadius: {
        'arch': '1.25rem',
        'arch-lg': '1.75rem',
      },
    },
  },
  plugins: [],
}

