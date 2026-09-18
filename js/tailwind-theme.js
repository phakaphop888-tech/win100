tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#F7F5F2",
          100: "#EFEBE6",
          200: "#DDD6CC",
          300: "#B8AFA4",
          400: "#8A8178",
          500: "#5C554E",
          700: "#2C2A28",
          800: "#1C1B1A",
          900: "#121110",
        },
        brand: {
          50: "#FFF8E8",
          100: "#FDEFC4",
          300: "#F5C84A",
          400: "#E8B42A",
          500: "#D4A017",
          700: "#A67C0A",
        },
      },
      fontFamily: {
        sans: ['"Noto Sans Thai"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 24px rgba(18, 17, 16, 0.08)",
        sheet: "0 -12px 40px rgba(18, 17, 16, 0.12)",
      },
    },
  },
};
