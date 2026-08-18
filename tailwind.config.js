/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        accent: "var(--accent)",
        accent2: "var(--accent-2)",
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
      },
      fontFamily: {
        head: "var(--font-head)",
        body: "var(--font-body)",
      },
    },
  },
  plugins: [],
};
