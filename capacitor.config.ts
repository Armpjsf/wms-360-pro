import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wms360.pro', // Fixed to match google-services.json
  appName: 'WMS 360 PRO',
  webDir: 'out',
  server: {
    url: 'https://wms-360-pro.vercel.app',
    cleartext: true
  }
};

export default config;
