import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Separate from vite.config so the app build config (manualChunks, optimizeDeps)
// does not leak into the test runner. jsdom gives composables a `window`
// (matchMedia is stubbed per-test in test/setup.ts).
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
})
