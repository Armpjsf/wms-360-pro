import type { Metadata } from "next";
import { Prompt, Outfit } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import PushNotificationManager from "@/components/PushNotificationManager";
import LocalNotificationManager from "@/components/LocalNotificationManager";
import NotificationInitializer from "@/components/NotificationInitializer";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import OfflineIndicator from "@/components/OfflineIndicator";

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
            <Sidebar />
            <main className="pl-0 md:pl-64 min-h-screen transition-all duration-300 pt-20 md:pt-0">
            {children}
            </main>
        </Providers>
      </body>
    </html>
  );
}
