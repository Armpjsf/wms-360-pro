import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import PushNotificationManager from "@/components/PushNotificationManager";
import LocalNotificationManager from "@/components/LocalNotificationManager";
import NotificationInitializer from "@/components/NotificationInitializer";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import OfflineIndicator from "@/components/OfflineIndicator";

import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
            <PushNotificationManager />
            <LocalNotificationManager />
            <NotificationInitializer />
            <KeyboardShortcuts />
            <OfflineIndicator />
            <Sidebar />
            <main className="pl-0 md:pl-64 min-h-screen transition-all duration-300 pt-20 md:pt-0">
            {children}
            </main>
        </Providers>
      </body>
    </html>
  );
}
