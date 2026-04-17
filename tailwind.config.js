/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: "#f4efe7",
        ink: "#1c2333",
        muted: "#5b6475",
        accent: "#c85b32",
        "accent-deep": "#9f401e",
        info: "#2b5db8",
        good: "#1f8f55",
        bad: "#bb3e45",
      },
      boxShadow: {
        panel: "0 24px 60px rgba(48, 34, 20, 0.14)",
      },
      fontFamily: {
        sans: ["Avenir Next", "Segoe UI Variable", "Trebuchet MS", "sans-serif"],
        serif: ["Georgia", "Times New Roman", "serif"],
        mono: ["IBM Plex Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};