import type { Config } from "tailwindcss";

const config: Config = {
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
          DEFAULT: "#0D2847",
          light: "#16385f",
        },
        mint: {
          DEFAULT: "#2ECC8A",
          dark: "#25a86f",
        },
        "app-bg": "#EEF1F6",
        // Sémantique badges/états — cohérent avec ANNULEE/PARTIELLE/COMPLETE etc.
        success: { DEFAULT: "#16a34a", bg: "#dcfce7", text: "#166534" },
        warning: { DEFAULT: "#f59e0b", bg: "#fef3c7", text: "#92400e" },
        danger:  { DEFAULT: "#dc2626", bg: "#fee2e2", text: "#991b1b" },
        info:    { DEFAULT: "#2563eb", bg: "#dbeafe", text: "#1e40af" },
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
