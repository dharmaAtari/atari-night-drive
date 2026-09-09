import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8000,
  },
  build: {
    rollupOptions: {
      output: {
        // Phaser is far larger than the game itself; splitting it out keeps the
        // game chunk small enough to read in the network panel and lets it cache
        // separately across releases.
        manualChunks(id: string) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          return undefined;
        },
      },
    },
  },
});
