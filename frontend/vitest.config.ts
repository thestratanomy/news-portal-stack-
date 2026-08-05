import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      GHOST_CONTENT_API_KEY: '1234567890abcdef1234567890',
    },
  },
});
