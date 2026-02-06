'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Filter, Search, Calendar } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

interface Transaction {
    transaction_id: string;
    date: string;
    product_name: string;
    type: 'IN' | 'OUT';
    quantity: number;
    location: string;
    user: string;
    reason?: string;
}

export default function InventoryReportPage() {
    // State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        type: 'ALL',
        search: ''
    });

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.type !== 'ALL') params.append('type', filters.type);
            if (filters.search) params.append('search', filters.search);

            const res = await fetch(`/api/reports/inventory?${params.toString()}`);
            const json = await res.json();
            if (json.data) {
                setTransactions(json.data);
            }
        } catch (error) {
            console.error("Failed to fetch report:", error);
        } finally {
            setLoading(false);
        }
    };

    // Initial Load & Filter Change
    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchData();
        }, 500); // 500ms debounce for search
        return () => clearTimeout(timeout);
    }, [filters]);

    // Export CSV
    const handleExport = () => {
        const headers = ['Date', 'Transaction ID', 'Type', 'Product', 'Quantity', 'Location', 'User', 'Reason'];
        const rows = transactions.map(t => [
            t.date,
            t.transaction_id,
            t.type,
            `"${t.product_name.replace(/"/g, '""')}"`, // Escape quotes
            t.quantity,
            t.location,
            t.user,
            `"${(t.reason || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `inventory_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 relative overflow-hidden">
            <AmbientBackground />
            
            <div className="relative z-10 max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Inventory Report
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Detailed movement history and analytics
                        </p>
                    </div>
                    <button 
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-sm font-medium shadow-lg shadow-indigo-500/20"
                    >
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-end">
                    
                    {/* Date Range */}
                    <div className="flex gap-2">
                        <div className="space-y-1">
                            <label className="text-xs text-slate-500 font-medium ml-1">Start Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                <input 
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-40 text-slate-300"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-slate-500 font-medium ml-1">End Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                <input 
                                    type="date"
                                    value={filters.endDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-40 text-slate-300"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Type Filter */}
                    <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-medium ml-1">Type</label>
                        <select 
                            value={filters.type}
                            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-32 text-slate-300"
                        >
                            <option value="ALL">All Types</option>
                            <option value="IN">Inbound (รับ)</option>
                            <option value="OUT">Outbound (จ่าย)</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div className="flex-1 space-y-1 w-full">
                         <label className="text-xs text-slate-500 font-medium ml-1">Search</label>
                         <div className="relative">
                            <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                            <input 
                                type="text"
                                placeholder="Search Product, ID, Location..."
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-300 placeholder-slate-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="p-4 font-medium">Date</th>
                                    <th className="p-4 font-medium">ID</th>
                                    <th className="p-4 font-medium">Type</th>
                                    <th className="p-4 font-medium">Product</th>
                                    <th className="p-4 font-medium text-right">Qty</th>
                                    <th className="p-4 font-medium">Location</th>
                                    <th className="p-4 font-medium">User</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-500">
                                            <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                            <p>Loading transactions...</p>
                                        </td>
                                    </tr>
                                ) : transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-500">
                                            No transactions found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((t, i) => (
                                        <motion.tr 
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="hover:bg-slate-800/30 transition-colors text-sm text-slate-300"
                                        >
                                            <td className="p-4 whitespace-nowrap">{t.date}</td>
                                            <td className="p-4 font-mono text-xs text-slate-500">{t.transaction_id}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                                    t.type === 'IN' 
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                }`}>
                                                    {t.type === 'IN' ? 'RECEIVE' : 'ISSUE'}
                                                </span>
                                            </td>
                                            <td className="p-4 font-medium text-white">{t.product_name}</td>
                                            <td className="p-4 text-right font-mono text-indigo-300">{t.quantity.toLocaleString()}</td>
                                            <td className="p-4">{t.location}</td>
                                            <td className="p-4 text-slate-500 text-xs">{t.user}</td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
