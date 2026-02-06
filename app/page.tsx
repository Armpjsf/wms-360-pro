'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Simple check for mobile width or Capacitor
    // @ts-expect-error: Capacitor global check
    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || window.Capacitor);
    
    if (isMobile) {
      router.push('/mobile/jobs');
    } else {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
}
