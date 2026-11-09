import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import https from 'node:https';

let lastLiveState = {
  moves: [] as string[],
  fen: '',
  orientation: 'white',
  whiteClock: '',
  blackClock: '',
  timestamp: 0,
};

const liveSyncPlugin = () => ({
  name: 'live-sync-plugin',
  configureServer(server: any) {
    server.middlewares.use('/api/live-sync', (req: any, res: any) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            lastLiveState = {
              moves: Array.isArray(data.moves) ? data.moves : [],
              fen: data.fen || '',
              orientation: data.orientation || 'white',
              whiteClock: data.whiteClock || '',
              blackClock: data.blackClock || '',
              timestamp: Date.now(),
            };
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', movesCount: lastLiveState.moves.length }));
          } catch {
            res.statusCode = 400;
            res.end();
          }
        });
        return;
      }

      if (req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(lastLiveState));
        return;
      }
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), liveSyncPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/lichess-api': {
        target: 'https://lichess.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lichess-api/, ''),
        timeout: 0,
        proxyTimeout: 0,
        agent: new https.Agent({ keepAlive: true }),
      },
    },
    watch: {
      ignored: ['**/dist/**', '**/engine/**', '**/models/**', '**/*.wasm'],
    },
  },
  worker: {
    format: 'es',
  },
});

