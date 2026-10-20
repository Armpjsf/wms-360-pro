'use client';

import { useEffect } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

/**
 * แถบกันแถบสถานะด้านบน (status-bar scrim) เป็นพื้นขาว → บังคับไอคอนนาฬิกา/แบตเป็นสีเข้ม
 * ไม่งั้นเครื่องที่เปิด dark mode จะได้ไอคอนขาวบนพื้นขาว (มองไม่เห็น)
 * เรียก plugin ที่ฝังใน APK อยู่แล้ว (Capacitor 8 core) → ไม่ต้อง build APK ใหม่
 */
export default function SystemBarsInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    SystemBars.setStyle({ style: SystemBarsStyle.Light }).catch(() => {});
  }, []);
  return null;
}
