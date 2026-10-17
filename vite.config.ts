/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** The commit being deployed, or the build time locally; the app compares it with version.json to spot updates. */
const version = process.env.GITHUB_SHA?.slice(0, 7) ?? `local-${Date.now()}`

/** Writes version.json next to the app so a running copy can see that a newer one was deployed. */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), versionFile()],
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(version) },
  // Relative asset paths so the build works from any folder or static host.
  base: './',
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
  },
})
