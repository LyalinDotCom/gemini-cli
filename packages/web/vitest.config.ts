/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/client/**'],
    environment: 'node',
    globals: true,
    reporters: ['default'],
    alias: {
      react: path.resolve(__dirname, '../../node_modules/react'),
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['server/src/**/*'],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
