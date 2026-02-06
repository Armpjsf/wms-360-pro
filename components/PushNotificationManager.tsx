'use client';

import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export default function PushNotificationManager() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'web') {
      const initPush = async () => {
        try {
          // 1. Request Permission
          let permStatus = await PushNotifications.checkPermissions();

          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }

          if (permStatus.receive !== 'granted') {
            console.warn("User denied push notifications");
            return;
          }

          // 2. Register
          await PushNotifications.register();

          // 3. Listeners
          PushNotifications.addListener('registration', async ({ value: token }) => {
            console.log("Push Token:", token);
            try {
                // Register with Backend
                await fetch('/api/device/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, platform: Capacitor.getPlatform() })
                });
            } catch (e) {
                console.error("Token Sync Failed", e);
            }
          });

          PushNotifications.addListener('registrationError', err => {
            console.error("Push Reg Error:", err);
          });

          PushNotifications.addListener('pushNotificationReceived', notification => {
            console.log("Push Received:", notification);
            // Force an alert or toast
            alert(`📢 ${notification.title}\n${notification.body}`);
          });

          PushNotifications.addListener('pushNotificationActionPerformed', notification => {
            console.log("Push Action:", notification);
            // Handle deep linking or navigation here
          });

        } catch (e) {
          console.error("Push Init Error:", e);
        }
      };

      initPush();
    }
  }, []);

  return null;
}
