import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // '@/components/...' maps to 'components/...' in project root
      // '@/lib/...' maps to 'lib/...' in project root
      '@': resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/nvidia': {
        target: 'https://ai.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, '')
      },
      '/api/sarvam': {
        target: 'https://api.sarvam.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sarvam/, '')
      },
      '/.netlify/functions': {
        target: 'http://localhost:9999',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
  },
});
