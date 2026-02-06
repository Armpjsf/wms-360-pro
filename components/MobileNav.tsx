'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, ClipboardCheck } from 'lucide-react';

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/mobile/jobs', label: 'งานส่งสินค้า', icon: ClipboardList },
    { href: '/mobile/cycle-count', label: 'นับสต็อก', icon: ClipboardCheck },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-blue-400 bg-slate-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
