import type { Metadata } from "next";
import { Prompt, Outfit } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import PushNotificationManager from "@/components/PushNotificationManager";
import LocalNotificationManager from "@/components/LocalNotificationManager";
import NotificationInitializer from "@/components/NotificationInitializer";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import OfflineIndicator from "@/components/OfflineIndicator";
import SystemBarsInit from "@/components/SystemBarsInit";

import Providers from "@/components/Providers";

const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WMS 360 PRO",
  description: "Advanced Warehouse Management System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WMS 360",
  },
  formatDetection: {
    telephone: false,
  },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  // cover = วาดเต็มจอรวมใต้รอยบาก แล้วเว้นที่เองด้วย var(--sat)/var(--sab) (globals.css)
  // + ทำให้ Capacitor ฉีดค่า safe-area ให้ฝั่ง Android
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning={true}
        className={`${prompt.variable} ${outfit.variable} antialiased`}
      >
        <Providers>
            <PushNotificationManager />
            <LocalNotificationManager />
            <NotificationInitializer />
            <KeyboardShortcuts />
            <OfflineIndicator />
            <SystemBarsInit />
            {/* แถบกันใต้นาฬิกา/แบต/กล้องหน้า (มือถือ) — เนื้อหาที่เลื่อนขึ้นไปจะไม่ซ้อนกับแถบสถานะ */}
            <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[45] h-[var(--sat)] bg-white/90 backdrop-blur-md md:hidden" />
            <Sidebar />
            <main id="main-content" className="min-h-screen pt-[calc(5rem+var(--sat))] transition-all duration-300 md:pl-72 md:pt-0">
            {children}
            </main>
        </Providers>
      </body>
    </html>
  );
}
