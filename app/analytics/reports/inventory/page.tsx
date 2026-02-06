'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Search, Filter, Calendar, Package, User, Loader2, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface TransactionRow {
    date: string;
    sku: string;
    qty: number;
    price: number;
    type: 'IN' | 'OUT';
    docRef?: string;
    batch?: string;
    expiryDate?: string;
    owner?: string;
}

export default function InventoryReportPage() {
    const { t } = useLanguage();
    
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<TransactionRow[]>([]);
    
    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
    const [filterSku, setFilterSku] = useState('');
    const [filterOwner, setFilterOwner] = useState('');
    const [filterBatch, setFilterBatch] = useState('');

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);
            if (filterType !== 'ALL') params.append('type', filterType);
            if (filterSku) params.append('sku', filterSku);
            if (filterOwner) params.append('owner', filterOwner);
            if (filterBatch) params.append('batch', filterBatch);

            const res = await fetch(getApiUrl(`/api/reports/inventory?${params.toString()}`));
            const json = await res.json();
            setData(json.transactions || []);
        } catch (e) {
            console.error('Report fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = () => {
        if (data.length === 0) return;

        const headers = ['Date', 'Type', 'SKU', 'Qty', 'Price', 'DocRef', 'Batch', 'Expiry', 'Owner'];
        const rows = data.map(r => [
            r.date, r.type, r.sku, r.qty, r.price, r.docRef || '', r.batch || '', r.expiryDate || '', r.owner || ''
        ]);
        
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // Summary Stats
    const totalIn = data.filter(d => d.type === 'IN').reduce((sum, d) => sum + d.qty, 0);
    const totalOut = data.filter(d => d.type === 'OUT').reduce((sum, d) => sum + d.qty, 0);
    const netMovement = totalIn - totalOut;

    return (
        <div className="relative min-h-screen p-6 pb-20">
            <AmbientBackground />
            
            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <Link href="/analytics" className="text-slate-500 hover:text-indigo-600 flex items-center gap-2 mb-4 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> กลับ Analytics
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-100 rounded-3xl border border-indigo-200 shadow-lg shadow-indigo-900/10">
                            <FileSpreadsheet className="w-10 h-10 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                                Inventory Report
                            </h1>
                            <p className="text-slate-500 font-medium text-lg">ดึงรายงานสินค้าตาม Filter ที่ต้องการ</p>
                        </div>
                    </div>
                </motion.div>

                {/* Filters Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/80 backdrop-blur-xl border border-white/50 p-6 rounded-[2rem] shadow-sm mb-6"
                >
                    <h3 className="font-bold text-slate-800 mb-4 uppercase text-sm tracking-wider flex items-center gap-2">
                        <Filter className="w-4 h-4 text-indigo-500" /> ตัวกรอง
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div>
                            <label className="text-xs text-slate-400 font-bold mb-1 block">วันที่เริ่ม</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="date" 
                                    value={dateFrom} 
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-bold mb-1 block">วันที่สิ้นสุด</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="date" 
                                    value={dateTo} 
                                    onChange={e => setDateTo(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-bold mb-1 block">ประเภท</label>
                            <select 
                                value={filterType} 
                                onChange={e => setFilterType(e.target.value as any)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500"
                            >
                                <option value="ALL">ทั้งหมด</option>
                                <option value="IN">รับเข้า (IN)</option>
                                <option value="OUT">จ่ายออก (OUT)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-bold mb-1 block">สินค้า (SKU)</label>
                            <div className="relative">
                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={filterSku} 
                                    onChange={e => setFilterSku(e.target.value)}
                                    placeholder="ค้นหา..."
                                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-bold mb-1 block">Owner</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={filterOwner} 
                                    onChange={e => setFilterOwner(e.target.value)}
                                    placeholder="ลูกค้า..."
                                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-bold mb-1 block">Batch</label>
                            <input 
                                type="text" 
                                value={filterBatch} 
                                onChange={e => setFilterBatch(e.target.value)}
                                placeholder="LOT-..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button 
                            onClick={fetchReport}
                            disabled={loading}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            ค้นหา
                        </button>
                        <button 
                            onClick={exportCSV}
                            disabled={data.length === 0}
                            className="px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                        >
                            <Download className="w-5 h-5" /> Export CSV
                        </button>
                    </div>
                </motion.div>

                {/* Summary Stats */}
                {data.length > 0 && (
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-slate-900">{data.length}</p>
                            <p className="text-sm text-slate-500">รายการทั้งหมด</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-emerald-600">+{totalIn.toLocaleString()}</p>
                            <p className="text-sm text-emerald-600">รับเข้า</p>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-rose-600">-{totalOut.toLocaleString()}</p>
                            <p className="text-sm text-rose-600">จ่ายออก</p>
                        </div>
                        <div className={`rounded-2xl p-4 text-center ${netMovement >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'} border`}>
                            <p className={`text-3xl font-black ${netMovement >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                                {netMovement >= 0 ? '+' : ''}{netMovement.toLocaleString()}
                            </p>
                            <p className={`text-sm ${netMovement >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>Net Movement</p>
                        </div>
                    </div>
                )}

                {/* Results Table */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600">วันที่</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600">ประเภท</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600">สินค้า</th>
                                    <th className="text-right px-4 py-3 font-bold text-slate-600">จำนวน</th>
                                    <th className="text-right px-4 py-3 font-bold text-slate-600">ราคา</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600">เอกสาร</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600">Batch</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600">Owner</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-12 text-slate-400">
                                            <Search className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                            <p>กดค้นหาเพื่อดึง Report</p>
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3 font-medium">{row.date}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    row.type === 'IN' 
                                                        ? 'bg-emerald-100 text-emerald-700' 
                                                        : 'bg-rose-100 text-rose-700'
                                                }`}>
                                                    {row.type === 'IN' ? '📥 IN' : '📤 OUT'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{row.sku}</td>
                                            <td className="px-4 py-3 text-right font-bold">{row.qty.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-slate-600">฿{row.price?.toLocaleString() || 0}</td>
                                            <td className="px-4 py-3 text-slate-500">{row.docRef || '-'}</td>
                                            <td className="px-4 py-3 text-slate-500">{row.batch || '-'}</td>
                                            <td className="px-4 py-3 text-slate-500">{row.owner || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
