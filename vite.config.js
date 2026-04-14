import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Serve manifest.json with correct MIME type so Chrome doesn't throw
    // "Manifest: Line: 1, column: 1, Syntax error." in dev mode.
    {
      name: 'manifest-content-type',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('manifest.json')) {
            res.setHeader('Content-Type', 'application/manifest+json');
          }
          next();
        });
      },
    },
  ],
  base: '/ExpenseTracker/',
})

