import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/',
    server: {
      port: 3000,
      host: 'localhost',
    },
    plugins: [react()],
    define: {
      // GEMINI_API_KEY removed — must not be exposed in client bundle.
      // Use Supabase Edge Functions or a backend proxy for AI API calls.
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, '.'),
      }
    }
  };
});
