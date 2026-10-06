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
    // Generados desde app/icon.svg ("el papelito").
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
