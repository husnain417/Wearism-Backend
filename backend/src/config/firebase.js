// src/config/firebase.js
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let messaging = null;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(
            Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8')
        );

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        messaging = admin.messaging();
        console.log('[Firebase] Initialized successfully');
    } else {
        process.env.NODE_ENV !== 'test' && console.warn('[Firebase] Skipping init: FIREBASE_SERVICE_ACCOUNT_JSON env var not found');
    }
} catch (error) {
    console.error('[Firebase] Init failed:', error.message);
}

export const getMessaging = () => messaging;
