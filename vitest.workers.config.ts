import { defineConfig } from 'vitest/config'

// Node-env harness for worker PURE logic (hostname/CORS/lyric helpers). Tests
// live in workers/<w>/test/ — outside each worker's tsconfig `src` include, so
// they don't break `npm run check:workers`, and run via esbuild (no type-check).
// The Durable Object test (#8) needs a separate @cloudflare/vitest-pool-workers
// config and is NOT included here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['workers/*/test/**/*.test.ts'],
  },
})
