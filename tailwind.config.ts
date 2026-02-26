import type { Config } from "tailwindcss";

export default {
  content: ["./src/client/**/*.{ts,tsx}", "./src/client/index.html"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0a0a0f",
          secondary: "#111118",
          tertiary: "#1a1a28",
        },
        border: {
          DEFAULT: "#1f1f2e",
          hover: "#2a2a3a",
        },
        accent: {
          DEFAULT: "#f97316",
          dim: "rgba(249, 115, 22, 0.08)",
          hover: "#ea580c",
        },
        text: {
          primary: "#e0e0e8",
          secondary: "#888888",
          muted: "#555555",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
        display: ['"Outfit"', "sans-serif"],
      },
      animation: {
        "fade-up": "fadeUp 0.3s ease",
        "slide-in": "slideIn 0.3s ease",
        glow: "glow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(249,115,22,0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(249,115,22,0.25)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
