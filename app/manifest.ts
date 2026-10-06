import type { MetadataRoute } from "next";

// Permite "Agregar a pantalla de inicio" y abrir como app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Intercambio GS",
    short_name: "Intercambio",
    start_url: "/",
    display: "standalone",
    background_color: "#08090a",
    theme_color: "#08090a",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
