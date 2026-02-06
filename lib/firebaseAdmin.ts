import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

if (!admin.apps.length) {
  try {
    let serviceAccount: admin.ServiceAccount | undefined;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        try {
            const keyPath = path.join(process.cwd(), 'service-key.json');
            if (fs.existsSync(keyPath)) {
                serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
            }
        } catch (_err) { /* ignore */ }
    }
    
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('[Firebase] Admin Initialized');
    }
  } catch (error) {
    console.error('[Firebase] Init Error:', error);
  }
}

export const messaging = admin.apps.length ? admin.messaging() : null;
