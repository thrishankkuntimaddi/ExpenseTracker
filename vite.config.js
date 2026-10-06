import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/* Stamp a unique build ID into dist/sw.js so each deploy busts the
   service-worker cache without anyone having to bump a version by hand. */
function swBuildId() {
  let outDir = 'dist'
  return {
    name: 'sw-build-id',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    closeBundle() {
      const file = path.resolve(outDir, 'sw.js')
      if (!fs.existsSync(file)) return
      const buildId = process.env.GITHUB_SHA?.slice(0, 8) || Date.now().toString(36)
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', buildId))
    },
  }
}

// Native (Capacitor) builds are served from the app's own origin, so they use
// base '/'. The GitHub Pages build keeps '/ExpenseTracker/'.
const isNative = process.env.CAPACITOR === '1';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    swBuildId(),
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
  base: isNative ? '/' : '/ExpenseTracker/',
})

