'use client';

import { useState, useEffect } from 'react';
import { Bell, BellRing, Check } from 'lucide-react';
import { subscribeUserToPush } from '@/lib/notifications-client';

export default function NotificationManager() {
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
        setPermission(Notification.permission);
    }
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
        const result = await Notification.requestPermission();
        setPermission(result);
        
        if (result === 'granted') {
            await subscribeUserToPush();
        }
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  if (permission === 'granted') {
      return (
        <div className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl mb-2">
            <Check className="w-5 h-5" />
            <span>Updates On</span>
        </div>
      );
  }

  if (permission === 'denied') {
      return null; // Don't annoy user
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors mb-2"
    >
      {loading ? <Bell className="w-5 h-5 animate-spin" /> : <BellRing className="w-5 h-5" />}
      <span>Enable Alerts</span>
    </button>
  );
}
