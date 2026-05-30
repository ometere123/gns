import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#FFFFFF",
        ink: "#0B0F19",
        primary: "#2563EB",
        primaryDark: "#1D4ED8",
        softblue: "#EFF6FF",
        borderGrey: "#E5E7EB",
        muted: "#6B7280",
        section: "#F8FAFC",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
