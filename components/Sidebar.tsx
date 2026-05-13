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
  RefreshCw,
  Menu,
  LogOut,
  QrCode,
  History,
  ScanLine,
  Sparkles,
  Globe,
  Mail,
  Briefcase,
  Building2,
  Bot,
  BarChart3
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

import BranchSelector from './BranchSelector';

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, language, setLanguage } = useLanguage();

  const menuItems = [
    { label: t('menu_dashboard'), href: '/dashboard', icon: Home, color: 'text-blue-500' },
    { label: "HQ Command Center", href: '/hq', icon: Building2, color: 'text-indigo-500' }, 
    { label: t('menu_orders'), href: '/orders', icon: Mail, color: 'text-pink-500' },
    { label: t('menu_inventory'), href: '/inventory', icon: Box, color: 'text-amber-500' },
    { label: t('menu_inbound'), href: '/ops/inbound', icon: ArrowDownToLine, color: 'text-emerald-500' },
    { label: t('menu_outbound'), href: '/ops/outbound', icon: ArrowUpFromLine, color: 'text-rose-500' },
    { label: t('menu_damage'), href: '/ops/damage', icon: ShieldAlert, color: 'text-red-500' },
    { label: t('menu_jobs'), href: '/mobile/jobs', icon: Briefcase, color: 'text-violet-500' },
    { label: t('menu_transactions'), href: '/inventory/transactions', icon: RotateCcw, color: 'text-cyan-500' },
    { label: t('menu_po_log'), href: '/po-log', icon: FileText, color: 'text-slate-500' },
    { label: t('menu_analytics'), href: '/analytics', icon: BarChart3, color: 'text-purple-500' },
    { label: t('menu_stock_card'), href: '/inventory/stock-card', icon: ClipboardList, color: 'text-blue-600' },
    { label: t('menu_barcode'), href: '/barcode/generator', icon: QrCode, color: 'text-indigo-600' },
    { label: t('rules_title'), href: '/admin/rules', icon: Bot, color: 'text-orange-500' },
    { label: t('menu_admin'), href: '/admin', icon: Settings, color: 'text-slate-600' },
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
        "fixed left-0 top-0 bottom-0 bg-white/80 backdrop-blur-xl border-r border-slate-200/50 z-50 transition-all duration-300 flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.02)]",
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
                  <h1 className="font-black text-slate-800 text-2xl leading-none tracking-tighter">
                    WMS <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 font-mono">360</span>
                  </h1>
                  <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] mt-1 font-mono">PROFESSIONAL</p>
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
            
            // Map icon color to background and border colors for premium frames
            const getColorStyles = (colorClass: string) => {
              if (colorClass.includes('blue-500')) return "bg-blue-500/10 border-blue-500/30";
              if (colorClass.includes('indigo-500')) return "bg-indigo-500/10 border-indigo-500/30";
              if (colorClass.includes('pink-500')) return "bg-pink-500/10 border-pink-500/30";
              if (colorClass.includes('amber-500')) return "bg-amber-500/10 border-amber-500/30";
              if (colorClass.includes('emerald-500')) return "bg-emerald-500/10 border-emerald-500/30";
              if (colorClass.includes('rose-500')) return "bg-rose-500/10 border-rose-500/30";
              if (colorClass.includes('red-500')) return "bg-red-500/10 border-red-500/30";
              if (colorClass.includes('violet-500')) return "bg-violet-500/10 border-violet-500/30";
              if (colorClass.includes('cyan-500')) return "bg-cyan-500/10 border-cyan-500/30";
              if (colorClass.includes('slate-500')) return "bg-slate-500/10 border-slate-500/30";
              if (colorClass.includes('blue-600')) return "bg-blue-600/10 border-blue-600/30";
              if (colorClass.includes('indigo-600')) return "bg-indigo-600/10 border-indigo-600/30";
              if (colorClass.includes('orange-500')) return "bg-orange-500/10 border-orange-500/30";
              if (colorClass.includes('emerald-600')) return "bg-emerald-600/10 border-emerald-600/30";
              if (colorClass.includes('slate-600')) return "bg-slate-600/10 border-slate-600/30";
              if (colorClass.includes('purple-500')) return "bg-purple-500/10 border-purple-500/30";
              return "bg-slate-50 border-slate-200";
            };

            return (
              <Link 
                key={item.href} 
                href={item.href}
                onClick={() => setMobileOpen(false)}
              >
                <div className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                  isActive 
                    ? "text-white shadow-xl shadow-blue-500/20" 
                    : cn(
                        "border transition-all hover:shadow-lg hover:-translate-y-0.5",
                        getColorStyles((item as any).color)
                      ),
                  collapsed && "justify-center px-0"
                )}>
                  {/* Active Background */}
                  {isActive && (
                      <motion.div 
                        layoutId="active-pill"
                        className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                  )}

                  <div className={cn(
                    "relative z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                    isActive ? "bg-white/20" : cn("bg-slate-50 group-hover:bg-white", (item as any).color.replace('text-', 'bg-').replace('500', '50').replace('600', '100'))
                  )}>
                    <item.icon className={cn("w-4 h-4 transition-colors", isActive ? "text-white" : (item as any).color)} strokeWidth={isActive ? 2.5 : 2} />
                  </div>

                  {!collapsed && (
                    <span className={cn(
                      "text-sm font-black tracking-tight relative z-10 transition-colors", 
                      isActive ? "text-white" : (item as any).color
                    )}>
                      {item.label}
                    </span>
                  )}
                  
                  {/* Active Indicator Dot */}
                  {isActive && !collapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white relative z-10 shadow-sm" />
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {/* Language Toggle */}
        {!collapsed && (
            <div className="px-4 pb-2 space-y-2">
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
