import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Номер сборки: по нему Mini App понимает, что вышла новая версия (src/version.ts).
const BUILD_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

// base = имя репозитория: GitHub Pages открывает сайт по адресу <логин>.github.io/<репозиторий>/
export default defineConfig({
  base: '/ima_china_miniapp/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    {
      name: 'write-version-json',
      apply: 'build',
      closeBundle() {
        writeFileSync(resolve(__dirname, 'dist/version.json'), JSON.stringify({ build: BUILD_ID }));
      },
    },
  ],
  build: { target: 'es2020' },
});
