import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    globals: true,
    environmentMatchGlobs: [
      // Component tests (*.test.tsx) run in jsdom
      ['src/components/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['src/test-setup.ts'],
  },
});
