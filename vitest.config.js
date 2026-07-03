import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Integration tests hit live Supabase and run via the separate integration config.
    exclude: ['**/node_modules/**', '**/tests/integration/**'],
  },
  resolve: {
    // Map "@/..." imports to the repo root (trailing slash avoids matching "@scope/pkg").
    alias: {
      '@/': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
