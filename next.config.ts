import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lo precargado (Link prefetch={true}) y lo visitado se reutiliza al ir y volver sin pedirlo otra vez.
  // Las acciones del servidor invalidan esta caché con revalidatePath, así que lo tuyo siempre está al día.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
};

export default nextConfig;
