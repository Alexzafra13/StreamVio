/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Colores personalizados basados en la interfaz mostrada
        primary: {
          DEFAULT: "#3b82f6", // Azul para el componente de películas
          hover: "#2563eb",
        },
        secondary: {
          DEFAULT: "#9333ea", // Morado para el componente de series
          hover: "#7e22ce",
        },
        success: {
          DEFAULT: "#10b981", // Verde para el componente de bibliotecas
          hover: "#059669",
        },
        background: {
          dark: "#0f172a", // Fondo oscuro principal
          card: "#1e293b", // Fondo de tarjetas
          sidebar: "#111827", // Fondo de sidebar
        },
        text: {
          primary: "#f8fafc",
          secondary: "#cbd5e1",
          muted: "#64748b",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      spacing: {
        18: "4.5rem",
        68: "17rem",
      },
      boxShadow: {
        card: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};
