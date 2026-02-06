'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, TrendingUp, AlertTriangle, Package, RefreshCw, DollarSign } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

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
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
    );

    if (!stats) return null;

    return (
        <div className="min-h-screen p-8 bg-slate-50 relative overflow-hidden">
             <AmbientBackground />
             
             <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">HQ Command Center</h1>
                        <p className="text-slate-500 font-medium">Multi-Branch Real-time Overview</p>
                    </div>
                    <button onClick={fetchData} className="ml-auto p-2 bg-white rounded-lg shadow-sm hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* Global Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                     <MetricCard 
                        title="Global Valuation"
                        value={`฿${stats.global.totalValue.toLocaleString()}`}
                        icon={DollarSign}
                        color="indigo"
                     />
                     <MetricCard 
                        title="Total Inventory"
                        value={stats.global.totalStock.toLocaleString()}
                        subtitle="Units across all branches"
                        icon={Package}
                        color="blue"
                     />
                     <MetricCard 
                        title="Critical Alerts"
                        value={stats.global.lowStockCount}
                        subtitle="Items needing restock"
                        icon={AlertTriangle}
                        color="rose"
                     />
                </div>

                {/* Branch Breakdown */}
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-slate-400" />
                    Branch Performance
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stats.branches.map((branch) => (
                        <motion.div 
                            key={branch.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:border-indigo-100 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-3 h-3 rounded-full",
                                        branch.status === 'Online' ? "bg-emerald-500" : "bg-rose-500"
                                    )} />
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">{branch.name}</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{branch.status}</p>
                                    </div>
                                </div>
                                <div className={cn("p-2 rounded-lg bg-slate-50", branch.color === 'indigo' ? "text-indigo-600" : "text-rose-600")}>
                                    <Building2 className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Row label="Stock Value" value={`฿${branch.totalValue.toLocaleString()}`} />
                                <Row label="Active Items" value={branch.activeCount} />
                                <Row label="Critical Stock" value={branch.lowStockCount} highlight={branch.lowStockCount > 0} />
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-slate-50">
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className={cn("h-full bg-slate-300", branch.color === "indigo" ? "bg-indigo-500" : "bg-rose-500")} style={{ width: '70%' }} />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 text-right">Capacity Used (Est.)</p>
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
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        blue: "bg-blue-50 text-blue-600 border-blue-100",
        rose: "bg-rose-50 text-rose-600 border-rose-100",
    };
    
    return (
       <motion.div 
         whileHover={{ scale: 1.02 }}
         className="bg-white p-6 rounded-3xl border border-white/50 shadow-xl shadow-slate-200/50 relative overflow-hidden"
       >
           <div className={cn("absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2", colors[color as keyof typeof colors].split(' ')[0])} />
           
           <div className="flex justify-between items-start mb-4 relative z-10">
               <div>
                   <p className="text-slate-500 font-bold text-sm mb-1">{title}</p>
                   <h3 className="text-4xl font-black text-slate-900 tracking-tight">{value}</h3>
               </div>
               <div className={cn("p-3 rounded-xl border", colors[color as keyof typeof colors])}>
                   <Icon className="w-6 h-6" />
               </div>
           </div>
           {subtitle && <p className="text-slate-400 text-xs font-medium relative z-10">{subtitle}</p>}
       </motion.div>
    );
}

function Row({ label, value, highlight }: any) {
    return (
        <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 font-medium">{label}</span>
            <span className={cn("font-bold tabular-nums", highlight ? "text-rose-600" : "text-slate-800")}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
        </div>
    );
}
