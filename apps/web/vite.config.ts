// Vite config for the web app (D-054): the React plugin, and a dev proxy that
// sends /trpc to the API on :8080 (`just api`), so the browser sees one
// origin and the API needs no CORS.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const config: ReturnType<typeof defineConfig> = defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/trpc': 'http://localhost:8080' },
  },
});

export default config;
