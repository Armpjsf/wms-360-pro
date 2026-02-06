'use client';

import { 
  Home, 
  Box, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  RotateCcw, 
  Wrench, 
  FileText, 
  ClipboardList, 
  Settings, 
  Users, 
  ShieldAlert,
  Menu,
  LogOut,
  QrCode,
  History,
  ScanLine,
  Bell,
  BellOff,
  Sparkles,
  Globe,
  Mail,
  Briefcase,
  Building2,
  Bot,
  DollarSign
} from 'lucide-react';
import { useNotification } from './providers/GlobalNotificationProvider';
import { useLanguage } from './providers/LanguageProvider';
import { cn } from '@/lib/utils';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InstallPWA from './InstallPWA';
import NotificationManager from './NotificationManager';

import BranchSelector from './BranchSelector';

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, language, setLanguage } = useLanguage();

  const menuItems = [
    { label: t('menu_dashboard'), href: '/dashboard', icon: Home },
    { label: "HQ Command Center", href: '/hq', icon: Building2 }, // Hardcoded English/Thai for now until i18n
    { label: t('menu_orders'), href: '/orders', icon: Mail },
    { label: t('menu_inventory'), href: '/inventory', icon: Box },
    { label: t('menu_inbound'), href: '/ops/inbound', icon: ArrowDownToLine },
    { label: t('menu_outbound'), href: '/ops/outbound', icon: ArrowUpFromLine },
    { label: t('menu_damage'), href: '/ops/damage', icon: ShieldAlert },
    { label: t('menu_jobs'), href: '/mobile/jobs', icon: Briefcase },
    { label: t('menu_transactions'), href: '/inventory/transactions', icon: RotateCcw },
    { label: t('menu_po_log'), href: '/po-log', icon: FileText },
    { label: t('menu_reports'), href: '/analytics/reports', icon: FileText },
    { label: t('menu_stock_card'), href: '/inventory/stock-card', icon: ClipboardList },
    { label: t('menu_barcode'), href: '/barcode/generator', icon: QrCode },
    { label: "Automation Rules", href: '/admin/rules', icon: Bot },
    { label: "Profit Analytics", href: '/analytics/profit', icon: DollarSign },
    { label: t('menu_admin'), href: '/admin', icon: Settings },
    // { label: t('menu_ops_user'), href: '/admin/users', icon: Users },      // Moved to Admin Dashboard
    // { label: t('menu_audit'), href: '/admin/audit-trail', icon: History }, // Moved to Admin Dashboard
    // { label: t('menu_quality'), href: '/admin/data-quality', icon: ShieldAlert }, // Moved to Admin Dashboard
    { label: t('menu_smart_restock'), href: '/ai-reorder', icon: Sparkles },
  ];

  const adminRoles = ['Super Admin', 'Admin', 'Manager'];
  // Cast user to any to access role
  const userRole = (session?.user as any)?.role || 'User';

  const filteredMenu = menuItems.filter(item => {
    // 1. Admin-Only Menus
    if (['/admin', '/admin/users', '/admin/audit-trail', '/admin/data-quality', '/ai-reorder', '/barcode/generator', '/admin/branches', '/admin/rules'].includes(item.href)) {
      return adminRoles.includes(userRole);
    }

    // 2. Viewer/Customer Restrictions (Hide Ops)
    // Viewers should ONLY see: Dashboard, Inventory, Stock Card, Reports
    if (userRole === 'Viewer') {
       const viewerAllowed = ['/dashboard', '/inventory', '/inventory/stock-card', '/analytics/reports', '/hq']; 
       // Note: HQ might be restricted too, but let's allow it for now or check allowedBranches later
       return viewerAllowed.includes(item.href);
    }

    return true;
  });

  return (
    <>
      <button 
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="w-6 h-6 text-slate-700" />
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>
      
      <aside className={cn(
        "fixed left-0 top-0 bottom-0 bg-white border-r border-slate-200 z-50 transition-all duration-300 flex flex-col",
        collapsed ? "w-20" : "w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
           {!collapsed && (
             <div className="flex items-center gap-3">
               {/* Logo with Filters to Force White Background to Transparent via Multiply */}
               <img 
                 src="/logo.png" 
                 className="h-16 w-auto object-contain mix-blend-multiply contrast-125 brightness-110" 
                 alt="WMS Logo" 
               />
               
               {/* Restore System Name */}
               <div>
                  <h1 className="font-black text-slate-800 text-lg leading-none">WMS <span className="text-indigo-600">360</span></h1>
                  <p className="text-[10px] font-bold text-slate-400 tracking-wider">PROFESSIONAL</p>
               </div>
             </div>
           )}
           <button onClick={() => setCollapsed(!collapsed)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
             {collapsed ? <Menu className="w-5 h-5"/> : <div className="w-1.5 h-8 bg-slate-200 rounded-full" />}
           </button>
        </div>

        {/* Branch Selector (Visible only when not collapsed) */}
        {!collapsed && (
            <div className="px-3 pt-3">
                <BranchSelector />
            </div>
        )}

        {/* Menu */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
          {filteredMenu.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                onClick={() => setMobileOpen(false)}
              >
                <div className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all group",
                  isActive 
                    ? "bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                  collapsed && "justify-center px-0"
                )}>
                  <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} strokeWidth={isActive ? 2.5 : 2} />
                  {!collapsed && <span className="font-bold text-sm">{item.label}</span>}
                  
                  {/* Active Indicator */}
                  {isActive && !collapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {/* Language & Notification Toggle */}
        {!collapsed && (
            <div className="px-4 pb-2 space-y-2">
                <NotificationToggle />
                
                <button 
                    onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors group"
                >
                    <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                        <span className="text-xs font-bold text-slate-600">Language</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        <span className={`text-[10px] font-black ${language === 'en' ? 'text-indigo-600' : 'text-slate-300'}`}>EN</span>
                        <span className="text-slate-200">/</span>
                        <span className={`text-[10px] font-black ${language === 'th' ? 'text-indigo-600' : 'text-slate-300'}`}>TH</span>
                    </div>
                </button>
            </div>
        )}

        {/* User Profile */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
             {/* Simple Avatar Replacement using div/img */}
             <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                {session?.user?.image ? (
                    <img src={session.user.image} alt="User" className="w-full h-full object-cover" />
                ) : (
                    <span>{session?.user?.name?.charAt(0) || 'U'}</span>
                )}
             </div>
             
             {!collapsed && (
               <div className="flex-1 min-w-0">
                 <p className="text-sm font-bold text-slate-900 truncate">{session?.user?.name || 'Guest'}</p>
                 <p className="text-[10px] font-medium text-slate-500 truncate capitalize">{(session?.user as any)?.role || 'Viewer'}</p>
               </div>
             )}
            
             <button 
                onClick={() => signOut({ callbackUrl: '/login' })}
                className={cn(
                    "bg-white p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-all shadow-sm",
                    collapsed && "hidden group-hover:block absolute left-20 shadow-xl"
                )}
                title={t('menu_signout')}
             >
                <LogOut className="w-4 h-4" />
             </button>
          </div>
          
          {!collapsed && (
             <button 
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="mt-3 w-full flex items-center gap-2 text-rose-500 hover:text-rose-700 text-xs font-bold px-1 py-1 transition-colors md:hidden"
             >
                <LogOut className="w-3 h-3" />
                {t('menu_signout')}
             </button>
          )}
        </div>
      </aside>
    </>
  );
}

function NotificationToggle() {
    const { permission, requestPermission } = useNotification();
    const { t } = useLanguage();
    
    if (permission === 'granted') return null; // Hide if already granted
    
    return (
        <button 
            onClick={requestPermission}
            className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"
        >
            <Bell className="w-3 h-3" />
            {t('enable_alerts')}
        </button>
    );
}
