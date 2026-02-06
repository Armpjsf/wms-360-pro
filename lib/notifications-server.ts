import webpush from 'web-push';
import { sendWebPush } from './webPushSender';

// Initialize web-push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

export async function sendNotificationToAll(title: string, body: string, url: string = '/') {
    // Legacy: This used to use Firebase. Now it triggers Web Push.
    console.log(`[NotificationServer] Broadcasting: ${title}`);
    
    // Use our new sender utility
    const result = await sendWebPush({
        title,
        body,
        url
    });
    
    return result.success;
}
