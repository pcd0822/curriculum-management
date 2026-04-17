import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'index.react.html'),
    },
  },
  server: {
    open: '/index.react.html',
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
});
