import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/* Stamp a unique build ID and the list of built assets into dist/sw.js, so
   each deploy busts the service-worker cache without a manual version bump
   and every lazily loaded screen is pre-cached for offline use. */
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
      const assets = fs.readdirSync(path.resolve(outDir, 'assets'))
        .filter((f) => /\.(js|css)$/.test(f)).map((f) => `assets/${f}`)
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8')
        .replaceAll('__BUILD_ID__', buildId)
        .replace('__ASSETS__', JSON.stringify(assets)))
    },
  }
}

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
  base: '/ExpenseTracker/',
  build: {
    rolldownOptions: {
      output: {
        // Vendor code changes rarely — separate chunks stay cached across deploys.
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})

