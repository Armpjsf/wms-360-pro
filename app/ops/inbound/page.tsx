'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, PackagePlus, Plus, Trash2, Calendar, FileText, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchableSelect } from '@/components/SearchableSelect';
import { RecentTransactions } from '@/components/RecentTransactions';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';

import { useOfflineSync } from '@/hooks/useOfflineSync';
import { db } from '@/lib/db';
import { toast } from 'react-hot-toast';

export default function InboundPage() {
  const { t } = useLanguage();
  const { isOnline } = useOfflineSync(); // Hook for network status

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Cart
  const [items, setItems] = useState<any[]>([]);
  
  // Current Item Form
  const [currentSku, setCurrentSku] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [docRef, setDocRef] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Enterprise Fields (Phase 14)
  const [batch, setBatch] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [owner, setOwner] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    async function loadProducts() {
        try {
            if (navigator.onLine) {
                const res = await fetch(getApiUrl('/api/products'));
                const data = await res.json();
                setProducts(data);
                
                // Cache for offline
                // Note: Ideally useOfflineSync hook handles this, but for now specific page cache is fine
            } else {
                // Offline Mode: Load from Dexie
                console.log("Loading products from Offline Cache...");
                const cached = await db.products.toArray();
                setProducts(cached);
            }
        } catch (e) {
            console.error(e);
            // Fallback to cache on error
            const cached = await db.products.toArray();
            setProducts(cached);
        } finally {
            setLoading(false);
        }
    }
    loadProducts();
  }, []);

  const addItem = () => {
     if (!currentSku || !currentQty) return;
     setItems(prev => [
        ...prev, 
        { sku: currentSku, qty: currentQty, salePrice: currentPrice, batch, expiryDate, owner }
     ]);
     // Clear inputs
     setCurrentSku('');
     setCurrentQty('');
     setCurrentPrice('');
     // Clear enterprise fields (optional: keep them for batch entry)
     // setBatch(''); setExpiryDate(''); setOwner('');
  };

  const removeItem = (idx: number) => {
     setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    if (!confirm(`${t('confirm_prompt')} ${items.length}?`)) return;

    setSubmitting(true);
    
    // Map items with Global fields (Date, DocRef, Enterprise Fields)
    const payloadItems = items.map(i => ({
         ...i,
         date,
         docRef, // Apply global docRef to all items
         // Enterprise Fields already in item from addItem
    }));
    const payload = { items: payloadItems };

    // OFFLINE LOGIC
    if (!isOnline) {
        try {
            await db.pendingTransactions.add({
                type: 'INBOUND',
                data: payload,
                timestamp: Date.now(),
                status: 'PENDING',
                retryCount: 0
            });
            toast.success("Saved Offline! Will sync when online.");
            setItems([]);
            setDocRef('');
        } catch (e) {
            console.error(e);
            toast.error("Failed to save offline.");
        } finally {
            setSubmitting(false);
        }
        return;
    }

    // ONLINE LOGIC
    try {
      const res = await fetch(getApiUrl('/api/inbound'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) 
      });
      
      if (!res.ok) throw new Error(await res.text());
      
      toast.success(t('success_inbound'));
      setItems([]);
      setDocRef('');
    } catch (error: any) {
      console.error(error);
      
      // Fallback: Ask to save offline if online request failed?
      if (confirm("Network Failed. Save locally to sync later?")) {
          await db.pendingTransactions.add({
                type: 'INBOUND',
                data: payload,
                timestamp: Date.now(),
                status: 'PENDING',
                retryCount: 0
          });
          toast.success("Saved Offline!");
          setItems([]);
          setDocRef('');
      } else {
          alert('Error: ' + error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

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
              <ArrowLeft className="w-4 h-4" /> {t('back_to_ops')}
           </Link>
           <div className="flex items-center gap-4">
               <div className="p-4 bg-emerald-100 rounded-3xl border border-emerald-200 shadow-lg shadow-emerald-900/10">
                 <PackagePlus className="w-10 h-10 text-emerald-600" />
               </div>
               <div>
                   <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                      {t('inbound_order')}
                   </h1>
                   <p className="text-slate-500 font-medium text-lg">{t('inbound_subtitle')}</p>
               </div>
           </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Form */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* Document Info Card */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/80 backdrop-blur-xl border border-white/50 p-6 rounded-[2rem] shadow-sm"
                >
                    <h3 className="font-bold text-slate-800 mb-6 uppercase text-sm tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-500" /> {t('document_info')}
                    </h3>
                    <div className="space-y-5">
                        <div className="group">
                             <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-emerald-600 transition-colors">{t('date')}</label>
                             <div className="relative">
                                 <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                 <input 
                                    type="date" 
                                    value={date} 
                                    onChange={e => setDate(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium" 
                                 />
                             </div>
                        </div>
                        <div className="group">
                             <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-emerald-600 transition-colors">{t('reference_po')}</label>
                             <input 
                                type="text" 
                                value={docRef} 
                                onChange={e => setDocRef(e.target.value)} 
                                placeholder="e.g. PO-2024-001" 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium" 
                             />
                        </div>
                    </div>
                </motion.div>

                {/* Add Item Card */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/80 backdrop-blur-xl border border-white/50 p-6 rounded-[2rem] shadow-sm"
                >
                    <h3 className="font-bold text-slate-800 mb-6 uppercase text-sm tracking-wider flex items-center gap-2">
                        <Plus className="w-4 h-4 text-emerald-500" /> {t('add_item')}
                    </h3>
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 font-bold block uppercase tracking-wider">{t('product')}</label>
                            <SearchableSelect 
                                options={products.map(p => ({
                                    value: p.name,
                                    label: p.name,
                                    subLabel: `Stock: ${p.stock}`
                                }))}
                                value={currentSku}
                                onChange={setCurrentSku}
                                placeholder="-- Select Product --"
                                disabled={loading}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="group">
                                <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-emerald-600 transition-colors">{t('qty')}</label>
                                <input 
                                    type="number" 
                                    value={currentQty} 
                                    onChange={e => setCurrentQty(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" 
                                    placeholder="0" 
                                />
                             </div>
                             <div className="group">
                                <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-emerald-600 transition-colors">{t('cost_opt')}</label>
                                <input 
                                    type="number" 
                                    value={currentPrice} 
                                    onChange={e => setCurrentPrice(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" 
                                    placeholder="0.00" 
                                />
                             </div>
                        </div>

                        {/* Advanced Details Toggle (Enterprise Phase 14) */}
                        <button 
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-emerald-600 py-2 transition-colors"
                        >
                            <span className="font-bold uppercase tracking-wider">Advanced Details (Batch/Expiry)</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showAdvanced && (
                            <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="group">
                                    <label className="text-xs text-slate-400 font-bold mb-1 block uppercase tracking-wider">Batch / Lot No.</label>
                                    <input 
                                        type="text" 
                                        value={batch} 
                                        onChange={e => setBatch(e.target.value)} 
                                        placeholder="e.g. LOT-2024-001"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all" 
                                    />
                                </div>
                                <div className="group">
                                    <label className="text-xs text-slate-400 font-bold mb-1 block uppercase tracking-wider">Expiry Date</label>
                                    <input 
                                        type="date" 
                                        value={expiryDate} 
                                        onChange={e => setExpiryDate(e.target.value)} 
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all" 
                                    />
                                </div>
                                <div className="group">
                                    <label className="text-xs text-slate-400 font-bold mb-1 block uppercase tracking-wider">Owner / Customer</label>
                                    <input 
                                        type="text" 
                                        value={owner} 
                                        onChange={e => setOwner(e.target.value)} 
                                        placeholder="e.g. CustomerA"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all" 
                                    />
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={addItem}
                            disabled={!currentSku || !currentQty}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                        >
                            <Plus className="w-5 h-5" /> {t('add_to_list')}
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Right: List */}
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="lg:col-span-2"
            >
                 <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden min-h-[500px] flex flex-col shadow-sm">
                     <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center backdrop-blur-sm">
                         <h3 className="font-bold text-slate-900 flex items-center gap-3 text-lg">
                            {t('items_list')} <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full border border-emerald-200 font-bold">{items.length}</span>
                         </h3>
                         {items.length > 0 && (
                            <button onClick={() => setItems([])} className="text-xs text-red-500 hover:text-red-700 font-bold uppercase tracking-wider transition-colors">
                                {t('clear_all')}
                            </button>
                         )}
                     </div>
                     
                     <div className="flex-1 overflow-auto p-2">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60 py-20">
                                <PackagePlus className="w-16 h-16 mb-4 stroke-1" />
                                <p className="text-lg font-medium">{t('no_items_added')}</p>
                                <p className="text-sm">{t('select_product_prompt')}</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-400 uppercase font-bold text-[10px] tracking-wider sticky top-0">
                                    <tr>
                                        <th className="p-4 rounded-l-xl">{t('product')}</th>
                                        <th className="p-4 text-right">{t('qty')}</th>
                                        <th className="p-4 text-right">{t('cost_opt')}</th>
                                        <th className="p-4 text-center rounded-r-xl">{t('edit')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    <AnimatePresence mode='popLayout'>
                                    {items.map((item, i) => (
                                        <motion.tr 
                                            key={`${item.sku}-${i}`}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="group hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="p-4 font-bold text-slate-800 text-base">{item.sku}</td>
                                            <td className="p-4 text-right font-mono text-emerald-600 font-bold text-lg">{parseInt(item.qty).toLocaleString()}</td>
                                            <td className="p-4 text-right font-mono text-slate-500">{item.salePrice ? `฿${item.salePrice}` : '-'}</td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => removeItem(i)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        )}
                     </div>

                     <div className="p-6 bg-white border-t border-slate-100">
                        <button
                            onClick={handleSubmit}
                            disabled={items.length === 0 || submitting}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-lg"
                        >
                            {submitting ? <Loader2 className="animate-spin w-6 h-6" /> : <Save className="w-6 h-6" />}
                            {t('confirm_inbound')} ({items.length})
                        </button>
                     </div>
                 </div>
            </motion.div>
        </div>

        {/* Recent Transactions History */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 col-span-full"
        >
             <RecentTransactions type="IN" refreshTrigger={items.length} />
        </motion.div>
      </div>
    </div>
  );
}
