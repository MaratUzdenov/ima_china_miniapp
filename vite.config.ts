import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base = имя репозитория: GitHub Pages открывает сайт по адресу <логин>.github.io/<репозиторий>/
export default defineConfig({
  base: '/ima_china_miniapp/',
  plugins: [react()],
  build: { target: 'es2020' },
});
