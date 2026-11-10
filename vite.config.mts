import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

const sourceDirectory = path.join(import.meta.dirname, 'src');

// The dev server uses HTTPS and allows any origin because BG1 is loaded into
// Disney's pages, which are served over HTTPS from another origin.
const server = {
  host: '0.0.0.0',
  port: 3000,
  https: {
    cert: './tls/dev.cert',
    key: './tls/dev.key',
  },
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
};

export default defineConfig({
  base: '/bg1/',
  root: 'src',
  resolve: {
    alias: {
      '@/': `${sourceDirectory}/`,
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: false,
    rolldownOptions: {
      input: ['src/bg1.tsx', 'src/bg1.css', 'src/responder.html'],

      // The autoloader and Disney's login page request these files by name,
      // so they can't carry content hashes.
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  server,
  preview: server,
  plugins: [react(), tailwindcss()],
});
