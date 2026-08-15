import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/**/*.integration.spec.ts'],
    testTimeout: 15_000,
  },
})
