import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/ai-market/',
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
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
