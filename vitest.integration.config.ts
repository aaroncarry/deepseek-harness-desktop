import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.integration.spec.ts'],
    testTimeout: 90_000,
  },
})
