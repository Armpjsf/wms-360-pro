'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, TrendingUp, AlertTriangle, Package, RefreshCw, DollarSign } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface BranchStat {
    id: string;
    name: string;
    color: string;
    totalStock: number;
    totalValue: number;
    lowStockCount: number;
    activeCount: number;
    status: 'Online' | 'Offline';
}

export default function HQDashboard() {
    const { t } = useLanguage();
    const [stats, setStats] = useState<{ branches: BranchStat[], global: any } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = () => {
        setLoading(true);
        fetch(getApiUrl('/api/hq/stats'))
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => { fetchData() }, []);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5">
                <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
            </div>
        </div>
    );

    if (!stats) return null;

    return (
        <div className="min-h-screen px-4 py-6 sm:px-6 lg:p-8 relative overflow-hidden">
             <AmbientBackground />
             
             <div className="max-w-[1500px] mx-auto relative z-10 space-y-8">
                {/* Header */}
                <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-teal-500 to-amber-500" />
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-blue-700 text-white shadow-lg shadow-blue-900/20">
                                <Building2 className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">Multi-Branch Command</p>
                                <h1 className="text-3xl font-black tracking-tight text-slate-950">{t('hq_title')}</h1>
                                <p className="text-sm font-semibold text-slate-500">{t('hq_subtitle')}</p>
                            </div>
                        </div>
                        <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Global Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                     <MetricCard 
                        title={t('global_valuation')}
                        value={`฿${stats.global.totalValue.toLocaleString()}`}
                        icon={DollarSign}
                        color="indigo"
                     />
                     <MetricCard 
                        title={t('total_inventory_all')}
                        value={stats.global.totalStock.toLocaleString()}
                        subtitle={t('units_across_branches')}
                        icon={Package}
                        color="blue"
                     />
                     <MetricCard 
                        title={t('critical_alerts_all')}
                        value={stats.global.lowStockCount}
                        subtitle={t('items_needing_restock')}
                        icon={AlertTriangle}
                        color="rose"
                     />
                </div>

                {/* Branch Breakdown */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-200">
                            <TrendingUp className="w-5 h-5" />
                        </span>
                        {t('branch_performance')}
                    </h2>
                    <div className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500 sm:block">
                        {stats.branches.length} branches monitored
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {stats.branches.map((branch) => (
                        <motion.div 
                            key={branch.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-900/5 transition-all hover:-translate-y-1 hover:shadow-xl"
                        >
                            <div className={cn("absolute inset-x-0 top-0 h-1", branch.status === 'Online' ? "bg-gradient-to-r from-teal-500 to-emerald-500" : "bg-gradient-to-r from-rose-500 to-amber-500")} />
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "flex h-3 w-3 rounded-full ring-4",
                                        branch.status === 'Online' ? "bg-emerald-500 ring-emerald-100" : "bg-rose-500 ring-rose-100"
                                    )} />
                                    <div>
                                        <h3 className="font-black text-lg text-slate-900">{branch.name}</h3>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">{branch.status === 'Online' ? t('online') : t('offline')}</p>
                                    </div>
                                </div>
                                <div className={cn("p-2 rounded-xl ring-1", branch.status === 'Online' ? "bg-teal-50 text-teal-700 ring-teal-200" : "bg-rose-50 text-rose-700 ring-rose-200")}>
                                    <Building2 className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Row label={t('stock_value')} value={`฿${branch.totalValue.toLocaleString()}`} />
                                <Row label={t('active_items')} value={branch.activeCount} />
                                <Row label={t('critical_stock')} value={branch.lowStockCount} highlight={branch.lowStockCount > 0} />
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                    <div className={cn("h-full", branch.status === "Online" ? "bg-gradient-to-r from-teal-500 to-emerald-500" : "bg-gradient-to-r from-rose-500 to-amber-500")} style={{ width: '70%' }} />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 text-right">{t('capacity_used')}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
             </div>
        </div>
    );
}

function MetricCard({ title, value, subtitle, icon: Icon, color }: any) {
    const colors = {
        indigo: "bg-blue-50 text-blue-700 border-blue-200 from-blue-50",
        blue: "bg-cyan-50 text-cyan-700 border-cyan-200 from-cyan-50",
        rose: "bg-rose-50 text-rose-700 border-rose-200 from-rose-50",
    };
    
    return (
       <motion.div 
         whileHover={{ y: -4 }}
         className={cn("relative overflow-hidden rounded-2xl border bg-gradient-to-br to-white p-6 shadow-lg shadow-slate-900/5", colors[color as keyof typeof colors])}
       >
           <div className={cn("absolute inset-x-0 top-0 h-1", colors[color as keyof typeof colors].split(' ')[0].replace('50', '600'))} />
           
           <div className="flex justify-between items-start mb-4 relative z-10">
               <div>
                   <p className="text-slate-500 font-black text-xs uppercase tracking-[0.16em] mb-2">{title}</p>
                   <h3 className="text-4xl font-black tracking-tight">{value}</h3>
               </div>
               <div className={cn("p-3 rounded-xl border bg-white/75", colors[color as keyof typeof colors])}>
                   <Icon className="w-6 h-6" />
               </div>
           </div>
           {subtitle && <p className="text-slate-400 text-xs font-medium relative z-10">{subtitle}</p>}
       </motion.div>
    );
}

function Row({ label, value, highlight }: any) {
    return (
        <div className="flex justify-between items-center rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-100">
            <span className="text-slate-500 font-bold">{label}</span>
            <span className={cn("font-black tabular-nums", highlight ? "text-rose-600" : "text-slate-900")}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
        </div>
    );
}
