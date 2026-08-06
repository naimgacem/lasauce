import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", lg: "1.5rem" },
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...defaultTheme.fontFamily.sans],
      },

      /* Typography scale from docs/frontend-architecture.md §5 — encoded as
         tokens so the scale is enforced rather than hand-applied per component. */
      fontSize: {
        display: [
          "clamp(2.25rem, 1.2rem + 4.2vw, 3.75rem)",
          { lineHeight: "1.04", letterSpacing: "-0.035em", fontWeight: "700" },
        ],
        "heading-1": [
          "clamp(1.75rem, 1.2rem + 1.8vw, 2.25rem)",
          { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "700" },
        ],
        "heading-2": [
          "1.5rem",
          { lineHeight: "1.25", letterSpacing: "-0.02em", fontWeight: "600" },
        ],
        "heading-3": [
          "1.25rem",
          { lineHeight: "1.35", letterSpacing: "-0.015em", fontWeight: "600" },
        ],
        "heading-4": [
          "1.125rem",
          { lineHeight: "1.4", letterSpacing: "-0.01em", fontWeight: "500" },
        ],
        "body-lg": ["1.0625rem", { lineHeight: "1.7" }],
        body: ["1rem", { lineHeight: "1.7" }],
        "body-sm": ["0.875rem", { lineHeight: "1.6" }],
        caption: [
          "0.75rem",
          { lineHeight: "1.4", letterSpacing: "0.02em", fontWeight: "500" },
        ],
        overline: [
          "0.6875rem",
          { lineHeight: "1.3", letterSpacing: "0.09em", fontWeight: "600" },
        ],
      },

      /* Semantic spacing aliases (4px base) — §5 of the same doc. */
      spacing: {
        inline: "0.5rem",
        "stack-sm": "0.75rem",
        stack: "1rem",
        "stack-lg": "1.5rem",
        block: "2rem",
        section: "3rem",
        "section-lg": "5rem",
        /* Minimum comfortable touch target. */
        touch: "2.75rem",
      },

      maxWidth: {
        "container-page": "80rem",
        "container-app": "64rem",
        "container-prose": "42rem",
        "container-form": "28rem",
      },

      colors: {
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
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        /* Semantic domain colours — reserved for meaning, never decoration.
           `muted` variants back the soft badge/pill treatments. */
        lost: {
          DEFAULT: "hsl(var(--lost))",
          foreground: "hsl(var(--lost-foreground))",
          muted: "hsl(var(--lost-muted))",
        },
        found: {
          DEFAULT: "hsl(var(--found))",
          foreground: "hsl(var(--found-foreground))",
          muted: "hsl(var(--found-muted))",
        },
        processing: {
          DEFAULT: "hsl(var(--processing))",
          foreground: "hsl(var(--processing-foreground))",
          muted: "hsl(var(--processing-muted))",
        },

        /* Paid-feature surfaces only. */
        premium: {
          from: "hsl(var(--premium-from))",
          via: "hsl(var(--premium-via))",
          to: "hsl(var(--premium-to))",
          foreground: "hsl(var(--premium-foreground))",
          ink: "hsl(var(--premium-ink))",
          muted: "hsl(var(--premium-muted))",
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },

      /* Warm-tinted elevation — pure-black shadows look dirty on a warm canvas. */
      boxShadow: {
        xs: "0 1px 2px -1px hsl(var(--shadow-color) / 0.08)",
        sm: "0 1px 3px -1px hsl(var(--shadow-color) / 0.10), 0 1px 2px -1px hsl(var(--shadow-color) / 0.06)",
        DEFAULT:
          "0 2px 6px -2px hsl(var(--shadow-color) / 0.12), 0 1px 3px -1px hsl(var(--shadow-color) / 0.07)",
        md: "0 6px 16px -6px hsl(var(--shadow-color) / 0.16), 0 2px 6px -2px hsl(var(--shadow-color) / 0.08)",
        lg: "0 14px 32px -12px hsl(var(--shadow-color) / 0.20), 0 4px 10px -4px hsl(var(--shadow-color) / 0.10)",
        xl: "0 24px 56px -20px hsl(var(--shadow-color) / 0.26), 0 8px 18px -8px hsl(var(--shadow-color) / 0.12)",
        hero: "0 32px 70px -34px hsl(var(--shadow-color) / 0.42)",
      },

      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        /* Skeletons: a travelling sheen reads as "loading" far better than a
           whole block blinking on and off. */
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        /* Processing pulse — one soft ring, no bounce, no loop-y theatrics. */
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%, 100%": { transform: "scale(2.2)", opacity: "0" },
        },
        /* Slow drift for the AI gradient. Only used on AI surfaces. */
        "gradient-drift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },

      animation: {
        "fade-up": "fade-up 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 200ms ease-out both",
        "scale-in": "scale-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.8s infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "gradient-drift": "gradient-drift 8s ease-in-out infinite",
      },

      transitionTimingFunction: {
        /* Decelerating ease-out — the house curve for entrances. */
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
