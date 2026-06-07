import { defineConfig } from 'vitest/config'
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'

// vitest-pool-workers 0.16+ (vitest 4): the cloudflareTest() Vite plugin wires
// the workerd pool + the `cloudflare:test` module from the worker's wrangler
// config (main + COMMENT_RATE_LIMITER binding). Tests live in test/ — outside
// the tsconfig `src` include, so `npm run type-check` is unaffected.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
  },
})
