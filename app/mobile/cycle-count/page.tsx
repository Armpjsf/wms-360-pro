'use client';

import { useState, useEffect } from 'react';
import { ClipboardCheck, CheckCircle, Search, Camera, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MobileNav from '@/components/MobileNav';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import { useNotification } from '@/components/providers/GlobalNotificationProvider';

interface DailyCountItem {
  product_name: string;
  location: string;
  zone: string;
  system_qty: number;
  unit: string;
  movement_type: 'IN' | 'OUT' | 'BOTH';
  today_in: number;
  today_out: number;
  last_movement: string;
}

interface LogEntry {
  product_name: string;
  count_date: string;
  inspector: string;
  system_qty: number;
  actual_qty: number;
  variance: number;
  status: string;
}

export default function CycleCountPage() {
  const [activeTab, setActiveTab] = useState<'count' | 'history'>('count');
  const [items, setItems] = useState<DailyCountItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Zone filtering
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [zones, setZones] = useState<string[]>([]);
  
  // Count Form State
  const [selectedProduct, setSelectedProduct] = useState<DailyCountItem | null>(null);
  const [actualQty, setActualQty] = useState('');
  const [inspector, setInspector] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Variance handling
  const [showVarianceAlert, setShowVarianceAlert] = useState(false);
  const [varianceReason, setVarianceReason] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  
  const { sendNotification } = useNotification();

  useEffect(() => {
    fetchData();
    fetchLogs();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/cycle-count/daily'));
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data);
        
        // Extract unique zones
        const uniqueZones = Array.from(new Set(data.map((item: DailyCountItem) => item.zone)));
        setZones(['All', ...uniqueZones.sort()]);

        // Notify if there are items
        if (data.length > 0) {
            sendNotification('Cycle Count Tasks', {
                body: `You have ${data.length} items to verify today.`,
                tag: 'cycle-count'
            });
        }
      }
    } catch (e) {
      console.error('Failed to fetch daily count items', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(getApiUrl('/api/cycle-count'));
      const json = await res.json();
      if (Array.isArray(json)) setLogs(json);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !actualQty) return alert('กรุณาระบุจำนวนที่นับได้จริง');

    const sysQty = selectedProduct.system_qty;
    const actQty = parseFloat(actualQty);
    const variance = actQty - sysQty;

    // If variance exists, show alert
    if (variance !== 0) {
      setShowVarianceAlert(true);
      return;
    }

    // No variance, submit directly
    await submitCount();
  };

  const submitCount = async () => {
    if (!selectedProduct || !actualQty) return;

    try {
      const res = await fetch(getApiUrl('/api/cycle-count'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: selectedProduct.product_name,
          location: selectedProduct.location,
          system_qty: selectedProduct.system_qty,
          actual_qty: actualQty,
          inspector: inspector || 'พนักงาน',
          variance_reason: varianceReason,
          photo_url: photoUrl,
        })
      });

      if (res.ok) {
        // Remove from list to prevent double counting
        setItems(prev => prev.filter(item => item.product_name !== selectedProduct.product_name));

        const result = await res.json();
        alert(`✅ บันทึกสำเร็จ!${result.has_variance ? ` ผลต่าง: ${result.variance}` : ''}`);
        resetForm();
        fetchLogs();
        // setActiveTab('history'); // Keep user on count tab for continuous flow
      } else {
        alert('❌ บันทึกไม่สำเร็จ');
      }
    } catch (e) {
      alert('Error: ' + e);
    }
  };

  const resetForm = () => {
    setActualQty('');
    setVarianceReason('');
    setPhotoUrl('');
    setSelectedProduct(null);
    setShowVarianceAlert(false);
  };

  // Filter items by zone and search
  const filteredItems = items.filter(item => {
    const matchesZone = selectedZone === 'All' || item.zone === selectedZone;
    const matchesSearch = searchQuery === '' || 
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesZone && matchesSearch;
  });

  const getMovementIcon = (type: string) => {
    if (type === 'IN') return '📥';
    if (type === 'OUT') return '📤';
    return '🔄';
  };

  const getMovementColor = (type: string) => {
    if (type === 'IN') return 'text-emerald-400';
    if (type === 'OUT') return 'text-orange-400';
    return 'text-blue-400';
  };

  return (
    <div className="relative min-h-screen pb-24 bg-slate-50/50">
      <AmbientBackground />

      <div className="relative z-10 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl p-6 border-b border-white/50 shadow-sm sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3 mb-2">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-xl">
                  <ClipboardCheck className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cycle Count</h1>
                  <p className="text-slate-500 text-xs font-medium">Daily Stock Verification</p>
              </div>
           </div>
           {loading && <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />}
        </div>
        
        {activeTab === 'count' && items.length > 0 && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-4 shadow-lg shadow-indigo-500/20 text-white"
          >
            <div className="flex justify-between items-center">
                <span className="text-indigo-100 text-sm font-medium">✨ Target for today</span>
                <span className="text-2xl font-black">{filteredItems.length} Items</span>
            </div>
            <div className="w-full bg-white/20 h-1 mt-2 rounded-full overflow-hidden">
                <div className="bg-white h-full w-1/3 rounded-full" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-[120px] z-10">
        <button
          onClick={() => setActiveTab('count')}
          className={cn(
            "flex-1 py-4 text-sm font-bold transition-all border-b-2 relative",
            activeTab === 'count' ? "border-indigo-600 text-indigo-600 bg-indigo-50/50" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          Count List ({filteredItems.length})
          {activeTab === 'count' && <motion.div layoutId="tab" className="absolute bottom-[-2px] left-0 right-0 h-0.5 bg-indigo-600" />}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex-1 py-4 text-sm font-bold transition-all border-b-2 relative",
            activeTab === 'history' ? "border-indigo-600 text-indigo-600 bg-indigo-50/50" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          History Log
          {activeTab === 'history' && <motion.div layoutId="tab" className="absolute bottom-[-2px] left-0 right-0 h-0.5 bg-indigo-600" />}
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* COUNT TAB */}
        {activeTab === 'count' && (
          <>
            {!selectedProduct ? (
              <>
                {/* Zone Tabs */}
                {loading ? (
                    <div className="flex gap-2 overflow-x-auto pb-4">
                        <Skeleton className="h-10 w-24 rounded-full flex-shrink-0" />
                        <Skeleton className="h-10 w-24 rounded-full flex-shrink-0" />
                        <Skeleton className="h-10 w-24 rounded-full flex-shrink-0" />
                    </div>
                ) : (
                    <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                      {zones.map(zone => (
                        <button
                          key={zone}
                          onClick={() => setSelectedZone(zone)}
                          className={cn(
                             "px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border",
                             selectedZone === zone 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                                : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300"
                          )}
                        >
                          {zone === 'All' ? '🌐 All Zones' : `📍 Zone ${zone}`}
                        </button>
                      ))}
                    </div>
                )}

                {/* Search */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3 flex gap-3 items-center mb-6 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                  <Search className="text-slate-400 w-5 h-5 ml-2" />
                  <input
                    type="text"
                    placeholder="Search product or location..."
                    className="bg-transparent text-slate-900 outline-none flex-1 placeholder:text-slate-400 font-medium h-10"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Items List */}
                <div className="space-y-4">
                  {loading ? (
                    Array.from({length: 4}).map((_, i) => (
                        <Skeleton key={i} className="h-32 w-full rounded-3xl" />
                    ))
                  ) : filteredItems.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                          <CheckCircle className="w-10 h-10 text-slate-300" />
                      </div>
                      <p className="font-bold text-lg text-slate-600">All Caught Up!</p>
                      <p className="text-sm">No items remaining to count</p>
                    </div>
                  ) : (
                    <AnimatePresence mode='popLayout'>
                    {filteredItems.map((item, i) => (
                      <motion.div
                        key={item.product_name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => setSelectedProduct(item)}
                        className="bg-white border border-slate-200 rounded-[2rem] p-5 active:scale-[0.98] transition-all shadow-sm hover:shadow-md relative overflow-hidden group cursor-pointer"
                      >
                         <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-full -mr-4 -mt-4 opacity-50" />
                         
                        <div className="flex justify-between items-start mb-3 relative z-10">
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                            📍 {item.location}
                          </span>
                          <span className={cn("text-xl p-2 rounded-xl bg-slate-50", getMovementColor(item.movement_type))}>
                            {getMovementIcon(item.movement_type)}
                          </span>
                        </div>
                        
                        <h3 className="font-bold text-slate-800 text-lg mb-4 line-clamp-2 leading-tight">{item.product_name}</h3>
                        
                        <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">System Qty</span>
                            <span className="text-slate-900 font-black text-lg">{item.system_qty} <span className="text-xs text-slate-500 font-medium">{item.unit}</span></span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Today's Flow</span>
                            <span className={cn("font-black text-lg", item.movement_type === 'IN' ? 'text-emerald-600' : 'text-orange-500')}>
                              {item.movement_type === 'IN' ? `+${item.today_in}` : `-${item.today_out}`} <span className="text-xs text-slate-500 font-medium">{item.unit}</span>
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end items-center gap-2 text-indigo-600 font-bold text-sm group-hover:gap-3 transition-all">
                          <span>Tap to Count</span> <span className="p-1 bg-indigo-100 rounded-full">➜</span>
                        </div>
                      </motion.div>
                    ))}
                    </AnimatePresence>
                  )}
                </div>
              </>
            ) : (
              /* Count Form */
              <div className="max-w-md mx-auto pb-20">
                <AnimatePresence mode='wait'>
                  {showVarianceAlert ? (
                    /* Variance Alert */
                    <motion.div
                      key="alert"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-white border-2 border-orange-100 rounded-[2.5rem] p-6 shadow-2xl relative z-50"
                    >
                      <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <AlertTriangle className="w-10 h-10 text-orange-500" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-1">⚠️ Variance Detected</h2>
                        <p className="text-slate-500 text-sm font-medium">Please review the discrepancy</p>
                      </div>

                      <div className="bg-slate-50 rounded-3xl p-6 mb-6 border border-slate-100">
                        <div className="grid grid-cols-2 gap-8 text-center relative">
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 -translate-x-1/2" />
                          <div>
                            <div className="text-slate-400 text-xs font-bold uppercase mb-1">System</div>
                            <div className="text-3xl font-black text-slate-900">{selectedProduct.system_qty}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 text-xs font-bold uppercase mb-1">Counted</div>
                            <div className="text-3xl font-black text-indigo-600">{actualQty}</div>
                          </div>
                        </div>
                        <div className="text-center mt-6 pt-6 border-t border-slate-200">
                          <div className="text-slate-400 text-xs font-bold uppercase mb-2">Difference</div>
                          <div className={cn("text-5xl font-black tracking-tighter", parseFloat(actualQty) > selectedProduct.system_qty ? 'text-emerald-500' : 'text-rose-500')}>
                            {parseFloat(actualQty) > selectedProduct.system_qty ? '+' : ''}
                            {parseFloat(actualQty) - selectedProduct.system_qty} <span className="text-lg font-bold text-slate-400">{selectedProduct.unit}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-slate-400 text-xs font-bold uppercase mb-2 ml-1">Reason (Optional)</label>
                          <textarea
                            value={varianceReason}
                            onChange={e => setVarianceReason(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 resize-none shadow-sm placeholder:text-slate-400 font-medium transition-all"
                            rows={3}
                            placeholder="e.g. Found damaged items, Unrecorded stock..."
                          />
                        </div>

                        <div>
                           <label className="block text-slate-400 text-xs font-bold uppercase mb-2 ml-1">Evidence (Optional)</label>
                           <button className="w-full bg-white border-2 border-dashed border-slate-200 rounded-2xl p-4 text-slate-500 hover:bg-slate-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2 group">
                             <div className="p-2 bg-slate-100 rounded-full group-hover:bg-indigo-50 transition-colors">
                                <Camera className="w-5 h-5 group-hover:text-indigo-500" />
                             </div>
                             <span className="font-bold">Add Photo Evidence</span>
                           </button>
                        </div>
                      </div>

                      <div className="mt-8 space-y-3">
                        <button
                          onClick={submitCount}
                          className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/30 text-lg flex items-center justify-center gap-2"
                        >
                          <span>Confirm Variance</span> <CheckCircle className="w-6 h-6" />
                        </button>
                        <button
                          onClick={() => {
                            setShowVarianceAlert(false);
                            setActualQty('');
                          }}
                          className="w-full py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-colors"
                        >
                          Go Back & Recount
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    /* Count Entry Form */
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-slate-200 rounded-[2.5rem] p-6 shadow-xl relative z-40"
                    >
                      <form onSubmit={handleCountSubmit} className="space-y-8">
                        {/* Product Header */}
                        <div className="relative overflow-hidden rounded-[2rem] bg-indigo-600 p-8 text-white shadow-xl shadow-indigo-600/20">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                           <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl -ml-8 -mb-8" />
                           
                           <div className="relative z-10 text-center">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-xs font-bold mb-4">
                                     <span>📍 {selectedProduct.location}</span>
                                </div>
                                <h2 className="text-2xl font-black mb-2 leading-tight">{selectedProduct.product_name}</h2>
                                <p className="text-indigo-200 font-medium text-sm">Target: {selectedProduct.system_qty} {selectedProduct.unit}</p>
                           </div>
                        </div>

                        {/* Input */}
                        <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 text-center">
                          <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Enter Actual Quantity</label>
                          <div className="relative max-w-[200px] mx-auto">
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                autoFocus
                                required
                                value={actualQty}
                                onChange={e => setActualQty(e.target.value)}
                                className="w-full bg-white border-2 border-slate-200 rounded-2xl py-6 text-5xl text-center text-slate-900 font-black outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm placeholder:text-slate-200"
                                placeholder="0"
                              />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 ml-4">Inspector Name</label>
                          <input
                            type="text"
                            value={inspector}
                            onChange={e => setInspector(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl p-5 text-slate-900 font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm placeholder:text-slate-300"
                            placeholder="Your Name..."
                          />
                        </div>

                        {/* Actions */}
                        <div className="pt-2 space-y-3">
                          <button
                            type="submit"
                            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-black rounded-3xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/30"
                          >
                            <span>Verify Count</span> <CheckCircle className="w-7 h-7" />
                          </button>
                          <button
                            type="button"
                            onClick={resetForm}
                            className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 hover:bg-slate-50 rounded-3xl transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Product</th>
                    <th className="p-4 text-right">Sys</th>
                    <th className="p-4 text-right">Act</th>
                    <th className="p-4 text-right">Var</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 font-medium">No history logs found</td>
                    </tr>
                  ) : (
                    logs.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-xs font-mono text-slate-500">{log.count_date}</td>
                        <td className="p-4 font-bold text-slate-900 text-xs max-w-[120px] truncate">{log.product_name}</td>
                        <td className="p-4 text-right font-mono">{log.system_qty}</td>
                        <td className="p-4 text-right font-mono text-indigo-600 font-bold">{log.actual_qty}</td>
                        <td className={cn("p-4 text-right font-black font-mono", log.variance === 0 ? 'text-slate-300' : log.variance > 0 ? 'text-emerald-500' : 'text-rose-500')}>
                          {log.variance > 0 ? `+${log.variance}` : log.variance}
                        </td>
                        <td className="p-4 text-right">
                           {log.variance === 0 ? (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Matched</span>
                           ) : (
                              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Variance</span>
                           )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Mobile Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <MobileNav />
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
