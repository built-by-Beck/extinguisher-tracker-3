import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Generates ads.txt in the build output from VITE_ADSENSE_PUB_ID.
 * If the env var is not set, no ads.txt is created.
 */
function adsTxtPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'generate-ads-txt',
    closeBundle() {
      const pubId = env.VITE_ADSENSE_PUB_ID;
      if (!pubId) return;
      // Strip the "ca-" prefix if present — ads.txt uses just "pub-XXXX"
      const publisherId = pubId.replace(/^ca-/, '');
      const content = `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`;
      writeFileSync(resolve(__dirname, 'dist', 'ads.txt'), content);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  return {
  plugins: [react(), tailwindcss(), adsTxtPlugin(env)],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
};
});
