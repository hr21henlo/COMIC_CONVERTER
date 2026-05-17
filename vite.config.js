import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/nvidia': {
        target: 'https://ai.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
  },
});
