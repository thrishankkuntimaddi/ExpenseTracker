import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/* Android / desktop builds load the app from local files: no service
   worker (it would only serve stale code after an app update) and no
   web-app manifest. */
function nativeShell() {
  let outDir = 'dist-native'
  return {
    name: 'native-shell',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    transformIndexHtml(html) {
      return html
        .replace(/[ \t]*<!-- web-only:start[\s\S]*?<!-- web-only:end -->\n?/, '')
        .replace(/[ \t]*<link rel="manifest"[^>]*><!-- web-only -->\n?/, '')
    },
    closeBundle() {
      // PWA-only files: the apps have their own launcher icons
      for (const f of ['sw.js', 'manifest.json', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'])
        fs.rmSync(path.resolve(outDir, f), { force: true })
    },
  }
}

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
//   vite build                → website (GitHub Pages, /ExpenseTracker/, service worker)
//   vite build --mode native  → dist-native/ for the Android (Capacitor) and desktop (Tauri) apps
export default defineConfig(({ mode }) => {
  const native = mode === 'native'
  return {
    plugins: [
      react(),
      native ? nativeShell() : swBuildId(),
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
    base: native ? './' : '/ExpenseTracker/',
    define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version) },
    build: {
      outDir: native ? 'dist-native' : 'dist',
      // The Firestore SDK alone is ~545 kB minified (160 kB gzip) and can't be
      // split further; 600 kB still flags any real growth of our own code.
      chunkSizeWarningLimit: 600,
      rolldownOptions: {
        output: {
          // Vendor code changes rarely — separate chunks stay cached across deploys.
          codeSplitting: {
            groups: [
              { name: 'firestore', test: /node_modules[\\/]@firebase[\\/](firestore|webchannel-wrapper)[\\/]/ },
              { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
