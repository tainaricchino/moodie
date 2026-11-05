/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#090A0C",
        card: "#121418",
        line: "#222630",
        accent: "#00FF9D",
        highlight: "#F2F4F7",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Barlow", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Barlow Semi Condensed", "sans-serif"],
        mono: ["var(--font-mono)", "Barlow Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
