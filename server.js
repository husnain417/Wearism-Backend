import { buildApp } from './src/app.js';

const start = async () => {
    const app = await buildApp();

    try {
        await app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
