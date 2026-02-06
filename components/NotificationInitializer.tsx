'use client';

import { useEffect } from 'react';
import { notificationService } from '@/lib/notificationService';

export default function NotificationInitializer() {
  useEffect(() => {
    // Initialize notifications only in mobile build
    const isMobileBuild = process.env.NEXT_PUBLIC_MOBILE_BUILD === 'true';
    
    if (isMobileBuild) {
      notificationService.initialize();
    }
  }, []);

  return null; // This component doesn't render anything
}
