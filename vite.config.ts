import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser only talks to /api; the Node server (server/index.ts) owns the database connection.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001' } },
});
