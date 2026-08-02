import type { Config } from "tailwindcss";

// Toutes les couleurs pointent vers des variables CSS definies dans
// globals.css (:root pour le clair, .dark pour le sombre) — format RGB
// "R G B" (sans virgules) requis par la syntaxe rgb(var(--x) / <alpha-value>)
// pour que les modificateurs d'opacite Tailwind (bg-mint/10, border-danger/20,
// deja utilises partout dans l'app) continuent de fonctionner avec le
// theme sombre. Phase 6, 27/07/2026.
function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // ── Couleurs de marque PharmaGest — DESIGN-SYSTEM.md ──────────
        // Utiliser ces noms partout plutôt que des hex en dur dans style={{}}
        navy: {
          DEFAULT: withOpacity("--color-navy"),
          light: withOpacity("--color-navy-light"),
        },
        mint: {
          DEFAULT: withOpacity("--color-mint"),
          dark: withOpacity("--color-mint-dark"),
        },
        "app-bg": withOpacity("--color-app-bg"),
        // "surface" = fond des cartes/panneaux/modales — remplace bg-white
        // partout dans l'app (sauf text-white, volontairement laisse
        // intact : sert a du texte sur fond fonce comme la sidebar ou les
        // boutons primaires, qui doit rester blanc dans les deux themes).
        surface: withOpacity("--color-surface"),
        // Sémantique badges/états — cohérent avec ANNULEE/PARTIELLE/COMPLETE etc.
        success: {
          DEFAULT: withOpacity("--color-success"),
          bg: withOpacity("--color-success-bg"),
          text: withOpacity("--color-success-text"),
        },
        warning: {
          DEFAULT: withOpacity("--color-warning"),
          bg: withOpacity("--color-warning-bg"),
          text: withOpacity("--color-warning-text"),
        },
        danger: {
          DEFAULT: withOpacity("--color-danger"),
          bg: withOpacity("--color-danger-bg"),
          text: withOpacity("--color-danger-text"),
        },
        info: {
          DEFAULT: withOpacity("--color-info"),
          bg: withOpacity("--color-info-bg"),
          text: withOpacity("--color-info-text"),
        },
        // Palette grise standard Tailwind — redefinie pour suivre le theme
        // (texte secondaire, bordures de cartes/tableaux partout dans
        // l'app). Seules les nuances reellement utilisees dans le projet.
        gray: {
          50:  withOpacity("--color-gray-50"),
          100: withOpacity("--color-gray-100"),
          200: withOpacity("--color-gray-200"),
          300: withOpacity("--color-gray-300"),
          400: withOpacity("--color-gray-400"),
          500: withOpacity("--color-gray-500"),
          600: withOpacity("--color-gray-600"),
          700: withOpacity("--color-gray-700"),
          800: withOpacity("--color-gray-800"),
          900: withOpacity("--color-gray-900"),
        },
      },
      borderRadius: {
        card: "14px", 
      },
      keyframes: {
        "toast-in": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "toast-in": "toast-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
