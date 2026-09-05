// @lovable.dev/vite-tanstack-config already includes the required TanStack,
// React, Tailwind and path-resolution plugins. Keep configuration centralized here.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  tanstackStart: {
    // The application is currently frontend-only, so SPA mode is ideal for
    // GitHub Pages and other static previews. A real backend can still be
    // connected later without changing the daily UI.
    spa: {
      enabled: true,
    },
    server: { entry: "server" },
  },
  vite: {
    base,
  },
});
