export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
 
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
 
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
 
export async function subscribeUserToPush() {
    if (!('serviceWorker' in navigator)) return null;
    
    const registration = await navigator.serviceWorker.ready;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
        console.error("VAPID Public Key not found");
        return null;
    }

    const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
    };

    try {
        const pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
        console.log('Received PushSubscription: ', JSON.stringify(pushSubscription));
        
        // Save to server
        await fetch('/api/notifications/subscribe', {
            method: 'POST',
            body: JSON.stringify(pushSubscription),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        return pushSubscription;
    } catch (err) {
        console.error('Failed to subscribe the user: ', err);
        throw err;
    }
}
