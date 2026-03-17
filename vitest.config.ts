import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/server/**/*.ts', 'src/routes/api/**/*.ts'],
      exclude: ['src/lib/server/prisma.ts']
    }
  },
  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/lib'),
      '$lib/server': resolve(__dirname, 'src/lib/server')
    }
  }
});
