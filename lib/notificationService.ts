import { PushNotifications } from '@capacitor/push-notifications';
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
      // Request permission
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('Push notification permission not granted');
        return;
      }

      // Register with Apple / Google to receive push via APNS/FCM
      await PushNotifications.register();

      // Listen for registration
      await PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token: ' + token.value);
        // Send token to backend
        this.sendTokenToBackend(token.value);
      });

      // Listen for registration errors
      await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      // Listen for push notifications
      await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification) => {
          console.log('Push notification received: ', notification);
          // Handle notification when app is in foreground
          this.handleNotification(notification);
        }
      );

      // Listen for notification actions
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification) => {
          console.log('Push notification action performed', notification);
          // Handle notification tap
          this.handleNotificationTap(notification);
        }
      );

      this.isInitialized = true;
      console.log('Push notifications initialized');
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  private async sendTokenToBackend(token: string) {
    try {
      await fetch('/api/notifications/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch (error) {
      console.error('Error sending token to backend:', error);
    }
  }

  private handleNotification(notification: any) {
    // Show local notification if app is in foreground
    if (notification.data?.type === 'cycle_count') {
      // You can show a custom in-app notification here
      console.log('Cycle count notification:', notification);
    }
  }

  private handleNotificationTap(notification: any) {
    // Navigate to appropriate page based on notification type
    const data = notification.notification?.data || notification.data;
    if (data?.type === 'cycle_count') {
      // Navigate to cycle count page
      if (typeof window !== 'undefined') {
        window.location.href = '/mobile/cycle-count';
      }
    }
    
    // Handle New Job
    if (data?.type === 'new_job') {
      if (typeof window !== 'undefined') {
         window.location.href = '/mobile/jobs';
      }
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
