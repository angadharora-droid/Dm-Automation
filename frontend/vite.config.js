import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works when served at /dashboard.
  base: './',
  server: {
    // In dev, proxy API calls to the local backend so no CORS setup is needed.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
