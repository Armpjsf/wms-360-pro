import webpush from 'web-push';
import { getSubscriptions } from './subscriptionRepository';

// Initialize web-push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

export async function sendNotificationToAll(title: string, body: string, url = '/') {
    try {
        const subscriptions = await getSubscriptions();
        console.log(`[Push] Sending "${title}" to ${subscriptions.length} devices...`);

        const payload = JSON.stringify({
            title,
            body,
            icon: '/icon512_rounded.png',
            url
        });

        const results = await Promise.allSettled(
            subscriptions.map(sub => 
                webpush.sendNotification(sub, payload)
                    .catch(err => {
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            // Subscription expired or gone. 
                            // TODO: Remove from sheet (Optional for MVP)
                            console.log('Subscription expired:', sub.endpoint);
                        } else {
                            throw err;
                        }
                    })
            )
        );

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[Push] Sent successfully to ${successCount} devices.`);
        return successCount;

    } catch (error) {
        console.error('Error sending notifications:', error);
        return 0;
    }
}
