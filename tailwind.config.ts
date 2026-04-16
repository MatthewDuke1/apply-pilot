import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eff6ff", 100: "#dbeafe", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 900: "#1e3a5f" },
        surface: { DEFAULT: "#ffffff", muted: "#f8fafc", border: "#e2e8f0" },
      },
    },
  },
  plugins: [],
};
export default config;
