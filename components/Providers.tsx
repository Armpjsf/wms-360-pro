'use client';

import { SessionProvider } from "next-auth/react";

import GlobalNotificationProvider from "@/components/providers/GlobalNotificationProvider";
import { LanguageProvider } from './providers/LanguageProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
        <LanguageProvider>
          <GlobalNotificationProvider>
              {children}
          </GlobalNotificationProvider>
        </LanguageProvider>
    </SessionProvider>
  );
}
