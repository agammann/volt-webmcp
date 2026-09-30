import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sites } from '@openai/sites-vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  const tailwindPackage = '@tailwindcss/' + 'postcss';
  const { default: tailwindcss } = await import(tailwindPackage);

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    plugins: [react(), sites()],
    resolve: {
      alias: { '@': rootDirectory },
    },
    server: {
      host: '127.0.0.1',
    },
  };
});
