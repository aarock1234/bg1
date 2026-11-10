import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

const sourceDirectory = path.join(import.meta.dirname, 'src');

// The files the build starts from, inside the source directory.
const BUILD_INPUTS = ['bg1.tsx', 'bg1.css', 'home.tsx', 'responder.html'];

// The dev server uses HTTPS and allows any origin because the userscript
// loads BG1 into Disney's pages, which are served over HTTPS from another
// origin.
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
      input: BUILD_INPUTS.map(file => path.join(sourceDirectory, file)),

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
