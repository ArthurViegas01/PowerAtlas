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
  build: {
    // maplibre-gl (~1 MB) is the known vendor ceiling and cannot be split
    // further; raise the advisory limit above it so the build stays quiet now
    // that the heavy libs sit in their own cacheable chunks.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // Split the heavy WebGL libraries into their own long-lived chunks so
        // the app shell stays small and browser caching survives app-code
        // changes. deck.gl and the whole luma.gl/math.gl/loaders.gl family
        // MUST stay in ONE chunk: splitting luma from deck gives luma core two
        // copies and triggers "already been initialized" at runtime.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('maplibre-gl')) return 'maplibre'
          if (
            id.includes('deck.gl') ||
            id.includes('luma.gl') ||
            id.includes('math.gl') ||
            id.includes('loaders.gl')
          )
            return 'deck'
          if (id.includes('gsap')) return 'gsap'
          return undefined
        },
      },
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
