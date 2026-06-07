import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit-test harness for pure lib/ + worker logic (no HTTP surface). The pytest
// suite in tests/api|e2e|infra covers the running container; this covers the
// logic that never reaches an endpoint. Keep it node-env and dependency-light.
const root = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    // Mirror tsconfig "@/*" → repo root so units import the real modules.
    alias: { '@': root },
  },
})
