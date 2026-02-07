import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function normalizeBasePath(value: string | undefined) {
  const raw = value?.trim() || "/";
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

const basePath = normalizeBasePath(process.env.VITE_BASE_PATH);

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "vite.svg",
        "pwa-icon.svg",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        "icons/apple-touch-icon-180.png",
      ],
      manifest: {
        name: "Ponto Online",
        short_name: "Ponto",
        description: "Controle de ponto com React + Supabase",
        theme_color: "#0e1218",
        background_color: "#0e1218",
        display: "standalone",
        orientation: "portrait",
        start_url: basePath,
        scope: basePath,
        icons: [
          {
            src: `${basePath}icons/icon-192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${basePath}icons/icon-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${basePath}icons/icon-maskable-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: `${basePath}pwa-icon.svg`,
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"],
      },
    }),
  ],
});
