import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel sets VERCEL=1 while building: the site lives at the domain root there.
// GitHub Pages serves the public demo from /fernhouse-plant-shop/.
export default defineConfig({
  base: process.env.VERCEL ? '/' : '/fernhouse-plant-shop/',
  plugins: [react()],
});
