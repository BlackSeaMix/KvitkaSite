import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#F3E1D8",
        cream: "#F7F3EA",
        brandYellow: "#E8A87C",
        ink: "#121212",
      },
    },
  },
  plugins: [],
} satisfies Config;
