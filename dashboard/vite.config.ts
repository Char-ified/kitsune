import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In local dev, requests to /api go to the Express server.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
