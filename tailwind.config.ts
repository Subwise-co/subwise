import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Geist via --font-sans (loaded in app/layout.tsx); legacy components fall back to Inter/system.
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        // DM Serif Display for the new landing display type.
        display: ["var(--font-dm-serif)", "Georgia", "serif"],
        serif: ["var(--font-dm-serif)", "Georgia", "serif"],
      },
      colors: {
        // --- shadcn / new design system (HSL tokens, see app/globals.css) ---
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
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // --- legacy tokens (kept so /privacy, /terms, /guides still render) ---
        // Channels are `R G B` so alpha modifiers work. Values live in app/globals.css.
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        faint: "rgb(var(--c-ink) / 0.35)",
        line: "rgb(var(--c-ink) / 0.10)",
        pos: "rgb(var(--c-pos) / <alpha-value>)",
        leak: "rgb(var(--c-leak) / <alpha-value>)",
        tintBlue: "rgb(var(--c-tint-blue) / <alpha-value>)",
        tintYellow: "rgb(var(--c-tint-yellow) / <alpha-value>)",
        tintPink: "rgb(var(--c-tint-pink) / <alpha-value>)",
        tintGreen: "rgb(var(--c-tint-green) / <alpha-value>)",
        inkfix: "#0F0F0F",
        canvasfix: "#FFFFFF",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      maxWidth: { container: "1280px" },
      letterSpacing: { tightest: "-0.04em", tighter: "-0.02em" },
      boxShadow: {
        soft: "var(--shadow-soft)",
        phone: "var(--shadow-phone)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(-8px)" }, "50%": { transform: "translateY(8px)" } },
      },
      animation: { float: "float 6s ease-in-out infinite" },
    },
  },
  plugins: [],
};

export default config;
