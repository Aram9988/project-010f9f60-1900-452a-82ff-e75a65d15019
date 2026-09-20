# Local deployment

This repository can continue to run on GitHub Pages with the Supabase sync endpoint while a private local deployment uses the same codebase.

For the local build:

```bash
GITHUB_PAGES=1 VITE_WORKSPACE_SYNC_ENDPOINT=/api/workspace-sync npm run build
PORT=8080 node server/local-server.mjs
```

The local server stores shared state in `data/operations.sqlite` and attachments in `data/attachments/`.
A one-time `data/seed-snapshot.json` may be supplied before first start to seed the local database. Never commit that file because it contains operational data.

The local backend accepts the same workspace synchronization key hash as the current deployment, so existing devices can use the same workspace key when they connect to the private URL.
