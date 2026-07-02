import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wms360.pro', // Fixed to match google-services.json
  appName: 'WMS 360 PRO',
  webDir: 'out',
  server: {
    // Warehouse staff use the APK primarily; open straight to the jobs menu
    // so cold-starts (incl. notification taps) land on the right page instead
    // of the root spinner. Requires an APK rebuild to take effect.
    url: 'https://wms-360-pro.vercel.app/mobile/jobs',
    cleartext: true
  }
};

export default config;
