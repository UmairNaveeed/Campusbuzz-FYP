import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            const code = err?.code || '';
            const restarting =
              code === 'ECONNRESET' ||
              code === 'ECONNREFUSED' ||
              code === 'ECONNABORTED';
            if (restarting) {
              const path = req?.url || '/api';
              console.warn(
                `[vite proxy] Backend unavailable (${code}) — ${path}. ` +
                  'Wait for "Backend running on http://localhost:5000" then refresh.'
              );
            }
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    code === 'ECONNRESET'
                      ? 'Backend restarted or closed the connection. Try again in a few seconds.'
                      : 'Backend unavailable. Start it: cd Backend && node server.js',
                })
              );
            }
          });
        },
      },
    },
  },
})
