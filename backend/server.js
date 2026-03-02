import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env using absolute path relative to this file
dotenv.config({ path: resolve(__dirname, './.env') });
const start = async () => {
    // Dynamic import to ensure dotenv.config() has finished before app logic loads
    const { buildApp } = await import('./src/app.js');
    const app = await buildApp();

    try {
        await app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
