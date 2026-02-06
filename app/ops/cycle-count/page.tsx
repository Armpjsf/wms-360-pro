'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, ClipboardCheck, Check, X, AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { SearchableSelect } from '@/components/SearchableSelect';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { toast } from 'react-hot-toast';

interface CountItem {
    sku: string;
    systemQty: number;
    actualQty: string;
    variance: number;
    status: 'pending' | 'match' | 'variance';
}

export default function CycleCountPage() {
    const { t } = useLanguage();
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [countItems, setCountItems] = useState<CountItem[]>([]);
    const [countDate, setCountDate] = useState(new Date().toISOString().split('T')[0]);
    const [countNote, setCountNote] = useState('');

    // Load products with current stock
    useEffect(() => {
        async function loadProducts() {
            try {
                const res = await fetch(getApiUrl('/api/products'));
                const data = await res.json();
                setProducts(data);
                
                // Initialize count items
                const items: CountItem[] = data.map((p: any) => ({
                    sku: p.name,
                    systemQty: p.stock || 0,
                    actualQty: '',
                    variance: 0,
                    status: 'pending' as const
                }));
                setCountItems(items);
            } catch (e) {
                console.error('Load products error:', e);
            } finally {
                setLoading(false);
            }
        }
        loadProducts();
    }, []);

    // Update an item's actual count
    const updateActualQty = (sku: string, value: string) => {
        setCountItems(prev => prev.map(item => {
            if (item.sku === sku) {
                const actual = parseInt(value) || 0;
                const variance = actual - item.systemQty;
                let status: 'pending' | 'match' | 'variance' = 'pending';
                if (value !== '') {
                    status = variance === 0 ? 'match' : 'variance';
                }
                return { ...item, actualQty: value, variance, status };
            }
            return item;
        }));
    };

    // Calculate summary
    const summary = {
        total: countItems.length,
        counted: countItems.filter(i => i.actualQty !== '').length,
        matches: countItems.filter(i => i.status === 'match').length,
        variances: countItems.filter(i => i.status === 'variance').length,
    };

    // Save cycle count results
    const handleSave = async () => {
        setSaving(true);
        try {
            const countedItems = countItems.filter(i => i.actualQty !== '');
            
            const res = await fetch(getApiUrl('/api/cycle-count'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: countDate,
                    note: countNote,
                    items: countedItems.map(i => ({
                        sku: i.sku,
                        systemQty: i.systemQty,
                        actualQty: parseInt(i.actualQty),
                        variance: i.variance
                    }))
                })
            });

            if (!res.ok) throw new Error('Failed to save');
            
            toast.success(`บันทึก Cycle Count ${summary.counted} รายการเรียบร้อย!`);
        } catch (e: any) {
            toast.error('Error: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    // Filter to show only items with variance
    const [showOnlyVariance, setShowOnlyVariance] = useState(false);
    const displayItems = showOnlyVariance 
        ? countItems.filter(i => i.status === 'variance')
        : countItems;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="relative min-h-screen p-6 pb-20">
            <AmbientBackground />
            
            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <Link href="/ops" className="text-slate-500 hover:text-indigo-600 flex items-center gap-2 mb-4 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> กลับ Operations
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-amber-100 rounded-3xl border border-amber-200 shadow-lg shadow-amber-900/10">
                            <ClipboardCheck className="w-10 h-10 text-amber-600" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                                Cycle Count
                            </h1>
                            <p className="text-slate-500 font-medium text-lg">ตรวจนับสต๊อคจริง เทียบกับระบบ</p>
                        </div>
                    </div>
                </motion.div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                        <p className="text-3xl font-black text-slate-900">{summary.total}</p>
                        <p className="text-sm text-slate-500">สินค้าทั้งหมด</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                        <p className="text-3xl font-black text-blue-600">{summary.counted}</p>
                        <p className="text-sm text-blue-600">นับแล้ว</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                        <p className="text-3xl font-black text-emerald-600">{summary.matches}</p>
                        <p className="text-sm text-emerald-600">✓ ตรงกัน</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center">
                        <p className="text-3xl font-black text-rose-600">{summary.variances}</p>
                        <p className="text-sm text-rose-600">⚠ มีผลต่าง</p>
                    </div>
                </div>

                {/* Info & Actions */}
                <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
                    <div className="flex gap-4 items-center">
                        <input 
                            type="date" 
                            value={countDate} 
                            onChange={e => setCountDate(e.target.value)}
                            className="px-4 py-2 border border-slate-200 rounded-xl"
                        />
                        <input 
                            type="text" 
                            value={countNote} 
                            onChange={e => setCountNote(e.target.value)}
                            placeholder="หมายเหตุ (ถ้ามี)"
                            className="px-4 py-2 border border-slate-200 rounded-xl w-64"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowOnlyVariance(!showOnlyVariance)}
                            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                                showOnlyVariance 
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                        >
                            <AlertTriangle className="w-4 h-4" />
                            แสดงเฉพาะผลต่าง
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={saving || summary.counted === 0}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50 transition-all"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            บันทึก Cycle Count
                        </button>
                    </div>
                </div>

                {/* Count Table */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden"
                >
                    <div className="overflow-x-auto max-h-[60vh]">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                                <tr>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600 w-1/3">สินค้า</th>
                                    <th className="text-right px-4 py-3 font-bold text-slate-600">ระบบ</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-600 w-32">นับจริง</th>
                                    <th className="text-right px-4 py-3 font-bold text-slate-600">ผลต่าง</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-600">สถานะ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayItems.map((item, idx) => (
                                    <tr key={item.sku} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-900">{item.sku}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-600">{item.systemQty.toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <input 
                                                type="number"
                                                value={item.actualQty}
                                                onChange={e => updateActualQty(item.sku, e.target.value)}
                                                placeholder="-"
                                                className="w-full text-center px-2 py-1 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                                            />
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${
                                            item.variance > 0 ? 'text-emerald-600' : 
                                            item.variance < 0 ? 'text-rose-600' : 'text-slate-400'
                                        }`}>
                                            {item.actualQty !== '' ? (
                                                item.variance > 0 ? `+${item.variance}` : item.variance
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {item.status === 'match' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                                                    <Check className="w-3 h-3" /> ตรงกัน
                                                </span>
                                            )}
                                            {item.status === 'variance' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">
                                                    <AlertTriangle className="w-3 h-3" /> ผลต่าง
                                                </span>
                                            )}
                                            {item.status === 'pending' && (
                                                <span className="text-slate-400 text-xs">รอนับ</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
