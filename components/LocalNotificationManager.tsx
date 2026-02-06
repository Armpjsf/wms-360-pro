'use client';

import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export default function LocalNotificationManager() {
  useEffect(() => {
    const setupNotifications = async () => {
        // Only run on client-side and ideally only on Mobile (Capacitor)
        if (typeof window === 'undefined') return;
        
        // Robust check for Native Platform (iOS/Android)
        if (!Capacitor.isNativePlatform()) {
             console.log("Web platform detected, skipping Local Notifications setup.");
             return; 
        }

        try {
            // 1. Create Channel (Android Only, but safe to call)
            // Required for Android 8+ to show notifications
            await LocalNotifications.createChannel({
                id: 'daily_stock_check',
                name: 'Daily Stock Check',
                description: 'Reminders to check stock at end of day',
                importance: 5, // High importance for heads-up
                visibility: 1,
                vibration: true,
            });

            // 2. Request Permission
            const perm = await LocalNotifications.requestPermissions();
            if (perm.display !== 'granted') {
                console.warn("Notification permission denied");
                return;
            }

            // 3. Clear old daily notification (ID 1)
            await LocalNotifications.cancel({ notifications: [{ id: 1 }] });

            // 4. Schedule for Mon-Fri at 16:30
            // Weekdays: 1=Sun, 2=Mon, ..., 6=Fri, 7=Sat
            const weekdays = [2, 3, 4, 5, 6]; 
            const notifications = weekdays.map(day => ({
                title: "⏰ ถึงเวลาเช็คสต็อกประจำวัน",
                body: "16:30 น. แล้ว! รบกวนตรวจสอบความถูกต้องสินค้าและเคลียร์ออเดอร์ก่อนเลิกงานครับ",
                id: 100 + day, // IDs 102-106
                schedule: { 
                    on: { 
                        weekday: day,
                        hour: 16, 
                        minute: 30 
                    },
                    allowWhileIdle: true 
                },
                channelId: 'daily_stock_check' // Assign to channel
            }));
            
            // Check if already scheduled (check ID 102)
            const pending = await LocalNotifications.getPending();
            const exists = pending.notifications.some(n => n.id === 102);

            // Always reschedule to ensure channel and update
            if (!exists) {
                await LocalNotifications.schedule({ notifications });
                console.log("✅ Scheduled Mon-Fri Notifications for 16:30");
            } else {
                 console.log("ℹ️ Mon-Fri Notifications already scheduled.");
            }

        } catch (error) {
            console.error("❌ Notification Setup Error:", error);
        }
    };

    setupNotifications();
  }, []);

  return null; // This component renders nothing
}
