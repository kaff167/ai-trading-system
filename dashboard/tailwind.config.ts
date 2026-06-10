import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme palette matched to the reference video.
        bg: {
          DEFAULT: "#0a0e0d",
          soft: "#0f1513",
          card: "#121a18",
          elevated: "#16201d",
        },
        accent: {
          DEFAULT: "#22c55e", // emerald green accent
          soft: "#16a34a",
          dim: "#15803d",
        },
        loss: "#ef4444",
        info: "#3b82f6",
        muted: "#8b9a95",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 24px -6px rgba(34,197,94,0.45)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
