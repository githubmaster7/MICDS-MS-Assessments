import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — the application's overall UI chrome (nav, buttons,
        // active states, borders, focus rings).
        //
        // Primary is the ROLE THEME color — each of Admin/Teacher/Student/
        // Parent gets its own single brand hue driving its header, sidebar,
        // buttons, focus rings, and table/panel accents. Rather than 4
        // separate token families, `primary` itself is CSS-variable-backed
        // (--p-50..--p-950, set in globals.css) and re-anchored per role via
        // a `data-role` attribute on that role's RoleAppShell root — every
        // existing `bg-primary-600`/`border-primary-200`/etc. usage across
        // the app picks up the active role's color automatically, with no
        // per-usage changes needed. Values below are the :root fallback
        // (admin/forest) for anything rendered outside a role scope (e.g.
        // the login page).
        primary: {
          50: "rgb(var(--p-50) / <alpha-value>)",
          100: "rgb(var(--p-100) / <alpha-value>)",
          200: "rgb(var(--p-200) / <alpha-value>)",
          300: "rgb(var(--p-300) / <alpha-value>)",
          400: "rgb(var(--p-400) / <alpha-value>)",
          500: "rgb(var(--p-500) / <alpha-value>)",
          600: "rgb(var(--p-600) / <alpha-value>)",
          700: "rgb(var(--p-700) / <alpha-value>)",
          800: "rgb(var(--p-800) / <alpha-value>)",
          900: "rgb(var(--p-900) / <alpha-value>)",
          950: "rgb(var(--p-950) / <alpha-value>)",
        },
        // Text/icon color for content sitting directly on a solid `primary`
        // fill (buttons, header banner, active-nav pill). White for the 3
        // dark role colors, near-black for Parent's light neutral gray —
        // also role-scoped alongside the ramp above.
        "role-fg": "rgb(var(--role-fg) / <alpha-value>)",
        // Secondary brand accent, anchored on #581021 (wine/burgundy).
        secondary: {
          50: "#f3eeef",
          100: "#e7dddf",
          200: "#cfbbc0",
          300: "#b799a0",
          400: "#a07680",
          500: "#885460",
          600: "#703241",
          700: "#581021",
          800: "#3a0b16",
          900: "#1c050b",
          950: "#0d0205",
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        warning: {
          50: "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#facc15",
          500: "#eab308",
          600: "#ca8a04",
          700: "#a16207",
          800: "#854d0e",
          900: "#713f12",
        },
        // High-emphasis brand accent (alerts, destructive actions), anchored
        // on #d2232a — this is a distinct custom token from the grading
        // system's own raw `red-*` usage, so re-anchoring it here is safe.
        danger: {
          50: "#fbeded",
          100: "#f8dadc",
          200: "#f0b6b8",
          300: "#e89194",
          400: "#e16c71",
          500: "#da484e",
          600: "#d2232a",
          700: "#9f1a20",
          800: "#6c1216",
          900: "#390a0b",
          950: "#200506",
        },
        // Structural neutral, anchored on #bdbcb6 at the shade (200) most
        // commonly used for borders/dividers/outlines throughout the app.
        // Overrides Tailwind's stock gray/slate so every existing
        // border-gray-*/bg-gray-*/text-gray-* (and slate-*) usage shifts to
        // the brand-neutral hue without touching hundreds of call sites.
        gray: {
          50: "#eeeeed",
          100: "#dededa",
          200: "#bdbcb6",
          300: "#a6a5a0",
          400: "#8f8e89",
          500: "#777773",
          600: "#60605d",
          700: "#494946",
          800: "#323230",
          900: "#1b1b1a",
          950: "#0f0f0f",
        },
        slate: {
          50: "#eeeeed",
          100: "#dededa",
          200: "#bdbcb6",
          300: "#a6a5a0",
          400: "#8f8e89",
          500: "#777773",
          600: "#60605d",
          700: "#494946",
          800: "#323230",
          900: "#1b1b1a",
          950: "#0f0f0f",
        },
        // Standards-based performance levels (1-4 self/teacher rating scale).
        // Each level ships 4 shades: the literal brand hex (solid swatch/
        // fill — badges, score buttons, chart segments; always paired with
        // black text, computed to meet WCAG AA against black on every level),
        // -text (a darkened, WCAG AA-safe variant of the same hue for use as
        // inline text color on white), -bg (light tint for badge backgrounds),
        // and -border (mid-tone for badge/swatch borders).
        score: {
          exceeding: "#00ff00",
          "exceeding-text": "#008a00",
          "exceeding-bg": "#e0ffe0",
          "exceeding-border": "#59ff59",
          achieving: "#6aa84f",
          "achieving-text": "#52823d",
          "achieving-bg": "#edf5ea",
          "achieving-border": "#9ec68d",
          developing: "#f1c232",
          "developing-text": "#93720a",
          "developing-bg": "#fdf8e6",
          "developing-border": "#f6d77a",
          incomplete: "#ff0000",
          "incomplete-text": "#ee0000",
          "incomplete-bg": "#ffe0e0",
          "incomplete-border": "#ff5959",
        },
      },
      fontFamily: {
        // Body/UI typeface — everything except major headings: nav, buttons,
        // forms, tables, labels, tooltips, chart/graph labels, menus.
        sans: [
          "Cyntho Next",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        // Major headings only — page titles, main section titles, dashboard
        // titles. Not for buttons/nav/forms/tables/labels/small UI.
        heading: ["Times New Roman", "Times", "serif"],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Cascadia Code",
          "Consolas",
          "monospace",
        ],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "spin-slow": "spin 2s linear infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-gentle": "bounceGentle 1s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        bounceGentle: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
