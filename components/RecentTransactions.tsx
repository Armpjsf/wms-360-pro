'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';
import { getApiUrl } from '@/lib/config';

interface Transaction {
    date: string;
    product: string;
    qty: number;
}

interface RecentTransactionsProps {
    type: 'IN' | 'OUT';
    refreshTrigger?: number; // Increment to force refresh
}

export function RecentTransactions({ type, refreshTrigger }: RecentTransactionsProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [type, refreshTrigger]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(getApiUrl(`/api/transactions/recent?type=${type}&limit=5`));
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            }
        } catch (error) {
            console.error("Failed to fetch recent transactions", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) { // Initial load only, or maybe show spinner overlay
         return (
             <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                 <Loader2 className="w-5 h-5 animate-spin" />
                 <span className="text-xs font-bold uppercase tracking-wider">Loading History...</span>
             </div>
         );
    }

    if (transactions.length === 0) {
        return (
            <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No recent history found</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 uppercase tracking-wide">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Recent {type === 'IN' ? 'Inbound' : 'Outbound'}
                </h4>
                <span className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-400">
                    Last 5
                </span>
            </div>
            
            <div className="divide-y divide-slate-50">
                {transactions.map((t, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                            }`}>
                                {type === 'IN' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-700 line-clamp-1 w-32 sm:w-48" title={t.product}>
                                    {t.product}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    {t.date}
                                </p>
                            </div>
                        </div>
                        <span className="font-mono font-bold text-slate-600 text-sm">
                            {t.qty.toLocaleString()}
                        </span>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
