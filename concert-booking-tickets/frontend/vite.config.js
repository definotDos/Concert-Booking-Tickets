import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const backendEnv = loadEnv(mode, fileURLToPath(new URL('../backend', import.meta.url)), '');
  const frontendUrl = new URL(
    process.env.FRONTEND_URL || backendEnv.FRONTEND_URL || 'http://localhost:5173',
  );
  const apiPort = process.env.PORT || backendEnv.PORT || '4000';
  return {
    plugins: [
      react(),
      {
        name: 'concert-dev-identity',
        configureServer(server) {
          server.middlewares.use('/__concert_dev', (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ root: path.resolve(server.config.root) }));
          });
        },
      },
    ],
    server: {
      host: frontendUrl.hostname,
      port: Number(frontendUrl.port || 80),
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${apiPort}` },
    },
  };
});
