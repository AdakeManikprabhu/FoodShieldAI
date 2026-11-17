/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forestgreen: "#2F6B2E",
        cream: "#FFF9E6",
        gold: "#D4AF37",
      },
    },
  },
  plugins: [],
};
