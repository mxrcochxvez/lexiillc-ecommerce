import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import netlify from '@netlify/vite-plugin-tanstack-start';

const config = defineConfig({
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(), // Must be before viteReact()
    netlify(),
    viteReact(),
  ],
  ssr: {
    // No external dependencies to bundle - using REST API instead of npm packages
    resolve: {
      conditions: ['node'],
      external: [],
    },
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
  },
  build: {
    ssr: true,
    rollupOptions: {
      output: {
        // Ensure sneaks-api is bundled
        format: 'es',
      },
    },
  },
})

export default config
