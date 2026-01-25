import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.SERVICE_ACCOUNT_EMAIL': JSON.stringify(env.SERVICE_ACCOUNT_EMAIL),
        'process.env.SERVICE_ACCOUNT_PRIVATE_KEY': JSON.stringify(env.SERVICE_ACCOUNT_PRIVATE_KEY),
        'process.env.SHEET_ID': JSON.stringify(env.SHEET_ID)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
