'use client';

import { Users, History, ShieldAlert, Sparkles, Settings, LayoutGrid, Printer, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function AdminPage() {
  const { t } = useLanguage();

  const menuItems = [
    { 
      title: t('menu_ops_user'), 
      desc: "Manage users, roles, and permissions", 
      icon: Users, 
      href: '/admin/users',
      color: 'bg-blue-500'
    },
    { 
      title: t('menu_audit'), 
      desc: "View system logs and activity history", 
      icon: History, 
      href: '/admin/audit-trail',
      color: 'bg-amber-500'
    },
    { 
      title: t('menu_quality'), 
      desc: "Check data integrity and consistency", 
      icon: ShieldAlert, 
      href: '/admin/data-quality',
      color: 'bg-emerald-500'
    },
    { 
      title: t('menu_smart_restock'), 
      desc: "AI-powered inventory analysis", 
      icon: Sparkles, 
      href: '/ai-reorder',
      color: 'bg-purple-500'
    },
    { 
      title: t('menu_slotting'), 
      desc: "Warehouse layout optimization (ABC)", 
      icon: LayoutGrid, 
      href: '/admin/slotting',
      color: 'bg-indigo-500'
    },
    { 
      title: "Label Designer", 
      desc: "Print product stickers & barcodes", 
      icon: Printer, 
      href: '/admin/labels',
      color: 'bg-rose-500'
    },
    { 
      title: "Branch Management", 
      desc: "Add/Remove locations & sheets", 
      icon: Building2, 
      href: '/admin/branches',
      color: 'bg-teal-500'
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
          <Settings className="w-8 h-8 text-slate-700" />
          {t('menu_admin')}
        </h1>
        <p className="text-slate-500">System Configuration and Management Console</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item, idx) => (
          <Link key={idx} href={item.href}>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-slate-300 transition-all cursor-pointer group h-full">
              <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mb-4 text-white shadow-md group-hover:scale-110 transition-transform`}>
                <item.icon className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">{item.title}</h2>
              <p className="text-slate-500 text-sm">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
