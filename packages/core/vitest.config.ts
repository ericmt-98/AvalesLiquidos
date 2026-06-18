import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Integration tests hit XRPL testnet over a websocket; give them room.
    testTimeout: 30_000,
  },
});
