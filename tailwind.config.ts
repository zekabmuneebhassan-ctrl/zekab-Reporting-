import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e4ff",
          500: "#3b6cff",
          600: "#2f56d6",
          700: "#2544ad",
        },
        pos: "#0f9d58",
        neg: "#d93025",
      },
    },
  },
  plugins: [],
};

export default config;
