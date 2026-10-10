import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom is a fake browser, so components can render without a real one.
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
  },
});
