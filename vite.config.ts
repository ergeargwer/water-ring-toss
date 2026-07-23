import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2022',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          matter: ['matter-js'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
