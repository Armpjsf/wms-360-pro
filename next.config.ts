import type { NextConfig } from "next";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const isMobileBuild = process.env.NEXT_PUBLIC_MOBILE_BUILD === 'true';

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  importScripts: ['/push-worker.js'],
  skipWaiting: true,
});

const nextConfig: any = {
  output: isMobileBuild ? 'export' : undefined,
  images: {
    unoptimized: isMobileBuild,
  },
  // Silence Next.js 16 Turbopack error (next-pwa uses Webpack)
  turbopack: {},
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withPWA(nextConfig);
