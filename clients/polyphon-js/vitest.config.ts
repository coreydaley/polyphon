import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/testing/**', 'src/**/*.test.ts', 'src/index.ts', 'src/types.ts'],
      thresholds: {
        lines: 90,
        branches: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@polyphon-ai/js/testing': path.resolve(__dirname, 'src/testing/index.ts'),
      '@polyphon-ai/js': path.resolve(__dirname, 'src/index.ts'),
    },
    extensions: ['.ts', '.js'],
  },
});
