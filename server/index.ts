import { createApp } from './app.ts';
const port = Number(process.env.API_PORT ?? 3001);
if (!process.env.DATABASE_URL || !process.env.DATABASE_ADMIN_URL) console.warn('[api] DATABASE_URL and DATABASE_ADMIN_URL must be set in .env');
createApp().listen(port, () => console.log(`API on http://localhost:${port}`));
