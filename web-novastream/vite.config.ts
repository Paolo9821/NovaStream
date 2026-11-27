import path from "path";

import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://tanstack.com/start/latest/docs/framework/react/guide/hosting#cloudflare-workers
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  // The app builds to one Cloudflare Worker (server rendering, server functions, API routes) plus its static
  // files. tanstackStart() must come before react(). Tailwind 3 runs through postcss.config.js.
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tanstackStart(), react()],
  environments: {
    ssr: { build: { minify: true, rolldownOptions: { output: { keepNames: true } } } },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // Expose both VITE_* (Vite default) and EXPO_PUBLIC_* (Rork's cross-platform
  // public-env convention, written by tools like getOrCreateAuthConfig).
  envPrefix: ["VITE_", "EXPO_PUBLIC_"],
});
