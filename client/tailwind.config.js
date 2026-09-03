/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchemin: '#FDF3E3',
        bois: { DEFAULT: '#8B4A2B', fonce: '#5C2E17', clair: '#C98450' },
        encre: '#2B1B14',
        laiton: '#E8B44A',
        coupable: '#E0443E',
        innocent: '#2FAE66',
      },
      fontFamily: {
        titre: ['Fredoka', 'Baloo 2', 'system-ui', 'sans-serif'],
        corps: ['Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        bd: '0 4px 0 0 rgba(43,27,20,0.85)',
        'bd-sm': '0 3px 0 0 rgba(43,27,20,0.85)',
        carte: '0 6px 0 0 rgba(43,27,20,0.2), 0 12px 24px -8px rgba(43,27,20,0.35)',
      },
      keyframes: {
        marteau: {
          '0%': { transform: 'rotate(-40deg)' },
          '55%': { transform: 'rotate(18deg)' },
          '70%': { transform: 'rotate(6deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        pop: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '70%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        entree: {
          '0%': { transform: 'translateY(14px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        tremble: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        flotte: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseUrgent: {
          '0%,100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
        },
        confetti: {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0' },
        },
      },
      animation: {
        marteau: 'marteau 0.6s cubic-bezier(.36,.07,.19,.97)',
        pop: 'pop 0.45s cubic-bezier(.2,1.3,.5,1) both',
        entree: 'entree 0.35s ease-out both',
        tremble: 'tremble 0.5s ease-in-out',
        flotte: 'flotte 3s ease-in-out infinite',
        urgent: 'pulseUrgent 1s ease-in-out infinite',
        confetti: 'confetti linear forwards',
      },
    },
  },
  plugins: [],
};
