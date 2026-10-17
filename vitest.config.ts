import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['electron/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'electron-dist/**'],
  },
})
