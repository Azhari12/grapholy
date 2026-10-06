import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Design system tokens — "code dark + run green"
        background: "#0F172A",
        foreground: "#F8FAFC",
        card: "#1E293B",
        "card-foreground": "#F8FAFC",
        muted: "#272F42",
        "muted-foreground": "#94A3B8",
        border: "#475569",
        primary: "#1E293B",
        "primary-foreground": "#FFFFFF",
        secondary: "#334155",
        "secondary-foreground": "#F8FAFC",
        accent: "#22C55E",
        "accent-foreground": "#0F172A",
        destructive: "#EF4444",
        "destructive-foreground": "#FFFFFF",
        ring: "#1E293B",
        input: "#475569",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Fira Code", "ui-monospace", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 250ms ease-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
