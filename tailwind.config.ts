import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canopy: "#1F3D2B",
        sap: { DEFAULT: "#3E7D44", hover: "#2F6435", active: "#245029" },
        sprout: { DEFAULT: "#7FB069", bg: "#E7F0DF" },
        stamp: { DEFAULT: "#B8873A", dark: "#8C6526", bg: "#F3E8D2" },
        paper: { DEFAULT: "#F5F3E8", deep: "#ECE9DA" },
        ink: { DEFAULT: "#1E2119", muted: "#5B6259" },
        border: "#D9D5C3",
        error: { DEFAULT: "#A3402D", bg: "#F3E1DB" },
        warning: "#C99A3E",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      spacing: {
        1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "24px",
        6: "32px", 7: "48px", 8: "64px", 9: "96px",
      },
      borderRadius: { sm: "4px", md: "8px", lg: "16px", full: "999px" },
      boxShadow: {
        sm: "0 1px 2px rgba(30,33,25,.08), 0 1px 1px rgba(30,33,25,.04)",
        md: "0 4px 10px rgba(30,33,25,.10), 0 2px 4px rgba(30,33,25,.06)",
        lg: "0 16px 32px rgba(30,33,25,.16), 0 4px 10px rgba(30,33,25,.08)",
      },
      screens: { sm: "560px", md: "768px", lg: "1200px" },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
} satisfies Config;
