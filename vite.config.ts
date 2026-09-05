// @lovable.dev/vite-tanstack-config already includes the required TanStack,
// React, Tailwind and path-resolution plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isPagesBuild = process.env.GITHUB_PAGES === "1";
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  tanstackStart: {
    ...(isPagesBuild ? { spa: { enabled: true } } : {}),
    server: { entry: "server" },
  },
  // GitHub Pages needs TanStack Start's normal dist/client + dist/server output
  // so the SPA shell can be prerendered. Normal/Lovable/server builds keep the
  // existing Nitro target for later private deployment.
  nitro: isPagesBuild ? false : true,
  vite: {
    base,
  },
});
