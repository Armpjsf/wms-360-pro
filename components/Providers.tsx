'use client';

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

import GlobalNotificationProvider from "@/components/providers/GlobalNotificationProvider";
import { LanguageProvider } from './providers/LanguageProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
        <LanguageProvider>
          <GlobalNotificationProvider>
              {children}
          </GlobalNotificationProvider>
          {/* toast() is used across the app; without this every message was silently dropped */}
          <Toaster
            position="top-center"
            containerStyle={{ top: 'calc(var(--sat, 0px) + 12px)' }}
            toastOptions={{ duration: 4000, style: { fontSize: '14px', maxWidth: '480px' } }}
          />
        </LanguageProvider>
    </SessionProvider>
  );
}
