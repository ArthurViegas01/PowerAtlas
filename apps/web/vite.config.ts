import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  optimizeDeps: {
    // Pre-bundle the whole deck.gl/luma.gl family in ONE optimizer pass.
    // @luma.gl/webgl is only reached via a dynamic import inside luma core;
    // left to a secondary discovery pass it gets its own copy of luma core,
    // which then logs "already been initialized" errors in dev.
    include: [
      '@deck.gl/aggregation-layers',
      '@deck.gl/core',
      '@deck.gl/extensions',
      '@deck.gl/layers',
      '@deck.gl/mapbox',
      '@deck.gl/core > @luma.gl/core',
      '@deck.gl/core > @luma.gl/engine',
      '@deck.gl/core > @luma.gl/webgl',
      'maplibre-gl',
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Bind IPv4 + IPv6: with the default ('localhost') Node may listen on
    // ::1 only, which breaks clients that resolve localhost to 127.0.0.1.
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
})
