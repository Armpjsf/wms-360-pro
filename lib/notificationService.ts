import { Capacitor } from '@capacitor/core';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: any;
}

class NotificationService {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    // Check if running in Capacitor Native Platform
    if (!Capacitor.isNativePlatform()) {
      console.log('Not running in Native Capacitor, skipping push notifications');
      return;
    }

    try {
      // การตั้งค่า push ทั้งหมด (ขอสิทธิ์ / register / รับ token / จัดการ tap) ทำโดย
      // <PushNotificationManager /> ซึ่ง mount แบบ global ใน app/layout.tsx เพียงที่เดียว
      // เดิม initialize() ลงทะเบียน listener + register() ซ้ำ ทำให้:
      //   - token ถูกส่งไป 2 endpoint (device/register + notifications/register) เกิด token ซ้ำในชีต -> แจ้งเตือนซ้ำ
      //   - handleNotificationTap ยิงสองครั้งต่อการกด 1 ที
      // จึงยกเลิกการตั้งค่าซ้ำที่นี่ และให้ initialize() เป็น no-op บน native (คงไว้เพื่อ backward-compat ผู้เรียกเดิม)
      this.isInitialized = true;
      console.log('Push notifications delegated to <PushNotificationManager />');
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  handleNotificationTap(notification: any) {
    // Navigate to the appropriate page based on notification type
    const data = notification.notification?.data || notification.data;
    if (typeof window === 'undefined') return;

    const routes: Record<string, string> = {
      cycle_count: '/mobile/cycle-count',
      new_job: '/mobile/jobs',
      ready: '/mobile/jobs',
      signature: '/mobile/jobs',
      anomaly: '/mobile/cycle-count',
      stock_alert: '/inventory?status=LOW',
    };

    // Priority: explicit url from payload > type-based route > jobs (default).
    // Always navigate somewhere so a tap is never silently ignored.
    const target = data?.url || routes[data?.type] || '/mobile/jobs';

    // If we're already on the target page, a plain href assignment does nothing
    // (same URL) — the tap would look silent and the new job wouldn't appear.
    // Force a reload in that case so the list refetches.
    const targetPath = target.split('?')[0];
    if (window.location.pathname === targetPath) {
      window.location.reload();
    } else {
      window.location.href = target;
    }
  }

  async scheduleLocalNotification(payload: NotificationPayload) {
    try {
      if (!Capacitor.isNativePlatform()) {
        console.log('Not in Native Capacitor, skipping local notification');
        return;
      }

      // For local notifications, you might want to use @capacitor/local-notifications
      console.log('Schedule local notification:', payload);
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  }
}

export const notificationService = new NotificationService();

export async function sendLineNotify(message: string): Promise<boolean> {
  const token = process.env.LINE_NOTIFY_TOKEN;
  if (!token) {
      console.warn("LINE_NOTIFY_TOKEN not found");
      return false;
  }

  try {
      const params = new URLSearchParams();
      params.append("message", message);

      const res = await fetch("https://notify-api.line.me/api/notify", {
          method: "POST",
          headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params
      });

      if (!res.ok) {
          console.error("LINE Notify Error", await res.text());
          return false;
      }
      return true;
  } catch (error) {
      console.error("LINE Notify Failed", error);
      return false;
  }
}
