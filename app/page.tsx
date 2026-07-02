'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Simple check for mobile width or Capacitor
    // @ts-expect-error: Capacitor global check
    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || window.Capacitor);
    
    // replace() (not push) so the root spinner never sits in the back stack,
    // avoiding a back-button loop back onto this loading screen.
    router.replace(isMobile ? '/mobile/jobs' : '/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
}
