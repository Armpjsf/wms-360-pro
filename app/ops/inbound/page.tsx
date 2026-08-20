'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Loader2,
  PackagePlus,
  Plus,
  Trash2,
  Calendar,
  FileText,
  ChevronDown,
  FileSpreadsheet,
  MapPin,
  Sparkles,
  Truck,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
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
import { ImportTransactionsModal } from '@/components/ImportTransactionsModal';
import { suggestPutawayLocation, checkCrossDockOpportunity } from '@/lib/putaway';
import { buildWarehouseMap } from '@/lib/warehouseMap';
import { triggerHaptic } from '@/lib/voiceAssistant';

export default function InboundPage() {
  const { t } = useLanguage();
  const { isOnline } = useOfflineSync();

  const [products, setProducts] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

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
    async function loadData() {
      try {
        if (navigator.onLine) {
          const [prodRes, ordersRes] = await Promise.all([
            fetch(getApiUrl('/api/products')),
            fetch(getApiUrl('/api/orders/fulfillment?action=check_pending')).catch(() => null),
          ]);

          const prodData = await prodRes.json();
          setProducts(prodData || []);

          if (ordersRes && ordersRes.ok) {
            const ordersData = await ordersRes.json();
            if (ordersData?.pending_tasks) {
              setPendingOrders(ordersData.pending_tasks);
            }
          }
        } else {
          console.log('Loading products from Offline Cache...');
          const cached = await db.products.toArray();
          setProducts(cached);
        }
      } catch (e) {
        console.error(e);
        const cached = await db.products.toArray();
        setProducts(cached);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Warehouse Map Zones for Putaway Logic
  const { zones } = useMemo(() => {
    return buildWarehouseMap(products);
  }, [products]);

  // Selected product metadata
  const selectedProduct = useMemo(() => {
    return products.find(p => p.name === currentSku || p.id === currentSku);
  }, [products, currentSku]);

  // Smart Put-away Suggestion
  const putawaySuggestion = useMemo(() => {
    if (!selectedProduct) return null;
    return suggestPutawayLocation(selectedProduct, zones);
  }, [selectedProduct, zones]);

  // Cross-Docking Opportunity Check
  const crossDockMatch = useMemo(() => {
    if (!currentSku) return { hasCrossDock: false, pendingQty: 0, matchedOrdersCount: 0, orders: [] };
    return checkCrossDockOpportunity(currentSku, pendingOrders);
  }, [currentSku, pendingOrders]);

  const addItem = () => {
    if (!currentSku || !currentQty) return;
    setItems(prev => [
      ...prev,
      {
        sku: currentSku,
        qty: currentQty,
        salePrice: currentPrice,
        batch,
        expiryDate,
        owner,
        location: putawaySuggestion?.suggestedLocation || selectedProduct?.location || 'Unassigned',
      },
    ]);
    triggerHaptic('success');
    toast.success(`เพิ่ม ${currentSku} เข้าคิวรับเข้า`);
    setCurrentSku('');
    setCurrentQty('');
    setCurrentPrice('');
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    if (!confirm(`${t('confirm_prompt')} ${items.length}?`)) return;

    setSubmitting(true);

    const payloadItems = items.map(i => ({
      ...i,
      date,
      docRef,
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
          retryCount: 0,
        });
        toast.success('Saved Offline! Will sync when online.');
        setItems([]);
        setDocRef('');
      } catch (e) {
        console.error(e);
        toast.error('Failed to save offline.');
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
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      triggerHaptic('success');
      toast.success(t('success_inbound'));
      setItems([]);
      setDocRef('');
    } catch (error: any) {
      console.error(error);
      if (confirm('Network Failed. Save locally to sync later?')) {
        await db.pendingTransactions.add({
          type: 'INBOUND',
          data: payload,
          timestamp: Date.now(),
          status: 'PENDING',
          retryCount: 0,
        });
        toast.success('Saved Offline!');
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
    <div className="relative min-h-screen px-4 py-6 pb-20 sm:px-6 lg:p-8 bg-slate-50">
      <AmbientBackground />

      <div className="max-w-[1500px] mx-auto relative z-10 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[1.75rem] border border-emerald-200 bg-white/90 p-6 shadow-xl shadow-emerald-900/5 backdrop-blur-xl"
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-500" />

          <Link
            href="/dashboard"
            className="relative z-10 text-slate-500 hover:text-emerald-600 flex items-center gap-2 mb-4 transition-colors font-bold uppercase text-xs tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" /> {t('back_to_dashboard')}
          </Link>
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl shadow-lg shadow-emerald-900/20 text-white">
                <PackagePlus className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
                  Smart Inbound & Put-Away Workspace
                </p>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                  {t('inbound_order')}
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">
                  รับสินค้าเข้าคลัง • แนะนำตำแหน่งจัดเก็บ (Smart Put-away) • ตรวจสอบ Cross-Docking
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-emerald-200 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm text-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{t('import_excel')}</span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-1 space-y-6">
            {/* Document Info Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-md backdrop-blur-xl space-y-4"
            >
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" /> {t('document_info')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">
                    {t('date')}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-500 font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">
                    {t('reference_po')}
                  </label>
                  <input
                    type="text"
                    value={docRef}
                    onChange={e => setDocRef(e.target.value)}
                    placeholder="e.g. PO-2026-001 / ใบส่งของ"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>
            </motion.div>

            {/* Add Item Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-md backdrop-blur-xl space-y-4"
            >
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-500" /> {t('add_item')}
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider">
                    {t('product')}
                  </label>
                  <SearchableSelect
                    options={products.map(p => ({
                      value: p.name,
                      label: p.name,
                      subLabel: `Stock: ${p.stock} | พิกัด: ${p.location || 'Unassigned'}`,
                    }))}
                    value={currentSku}
                    onChange={setCurrentSku}
                    placeholder="-- เลือกสินค้าหรือยิงบาร์โค้ด --"
                    disabled={loading}
                  />
                </div>

                {/* CROSS-DOCKING ALERT (If matching pending order) */}
                {crossDockMatch.hasCrossDock && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2 font-bold text-amber-800">
                      <Truck className="w-4 h-4 text-amber-600" />
                      <span>⚡ โอกาสส่งตรง Cross-Docking!</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-tight">
                      มี <strong>{crossDockMatch.matchedOrdersCount} ออเดอร์</strong> กำลังรอสินค้านี้ (รวม{' '}
                      <strong>{crossDockMatch.pendingQty} ชิ้น</strong>) สามารถนำไปที่จุดแพ็กส่งออกได้ทันทีโดยไม่ต้องขึ้นชั้นวาง
                    </p>
                  </motion.div>
                )}

                {/* SMART PUT-AWAY LOCATION RECOMMENDATION */}
                {putawaySuggestion && (
                  <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-teal-800">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" /> แนะนำตำแหน่งจัดเก็บ (Put-away):
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white font-mono font-black text-xs">
                        {putawaySuggestion.suggestedLocation}
                      </span>
                    </div>
                    <p className="text-[10px] text-teal-700">
                      {putawaySuggestion.reason} (Zone {putawaySuggestion.zone} • แร็ค {putawaySuggestion.rack})
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">
                      {t('qty')}
                    </label>
                    <input
                      type="number"
                      value={currentQty}
                      onChange={e => setCurrentQty(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold outline-none focus:bg-white focus:border-emerald-500 font-mono"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">
                      {t('cost_opt')}
                    </label>
                    <input
                      type="number"
                      value={currentPrice}
                      onChange={e => setCurrentPrice(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-500 font-mono"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Advanced Details Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-emerald-600 py-1 transition-colors"
                >
                  <span className="font-bold uppercase tracking-wider">ข้อมูลเพิ่มเติม (Lot / Expiry)</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                  />
                </button>

                {showAdvanced && (
                  <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold mb-1 block uppercase">
                        Lot / Batch No.
                      </label>
                      <input
                        type="text"
                        value={batch}
                        onChange={e => setBatch(e.target.value)}
                        placeholder="e.g. LOT-2026-001"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold mb-1 block uppercase">
                        วันหมดอายุ (Expiry Date)
                      </label>
                      <input
                        type="date"
                        value={expiryDate}
                        onChange={e => setExpiryDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={addItem}
                  disabled={!currentSku || !currentQty}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs shadow-md shadow-emerald-600/20 active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" /> {t('add_to_list')}
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
            <div className="bg-white/95 border border-slate-200 rounded-2xl overflow-hidden min-h-[500px] flex flex-col shadow-lg shadow-slate-900/5">
              <div className="p-5 bg-slate-50/75 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                  {t('items_list')}
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold">
                    {items.length}
                  </span>
                </h3>
                {items.length > 0 && (
                  <button
                    onClick={() => setItems([])}
                    className="text-xs text-red-500 hover:text-red-700 font-bold uppercase transition-colors"
                  >
                    {t('clear_all')}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-auto p-2">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60 py-20 space-y-2">
                    <PackagePlus className="w-16 h-16 stroke-1 text-emerald-500" />
                    <p className="text-base font-bold text-slate-600">{t('no_items_added')}</p>
                    <p className="text-xs">{t('select_product_prompt')}</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-white uppercase font-bold text-[10px] tracking-wider sticky top-0 z-20">
                      <tr className="bg-gradient-to-r from-emerald-600 to-teal-600 shadow-sm">
                        <th className="py-3 px-4 rounded-l-xl">{t('product')}</th>
                        <th className="py-3 px-4">พิกัดจัดเก็บ</th>
                        <th className="py-3 px-4 text-right">{t('qty')}</th>
                        <th className="py-3 px-4 text-right">{t('cost_opt')}</th>
                        <th className="py-3 px-4 text-center rounded-r-xl">{t('edit')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <AnimatePresence mode="popLayout">
                        {items.map((item, i) => (
                          <motion.tr
                            key={`${item.sku}-${i}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="group hover:bg-slate-50 transition-colors text-xs"
                          >
                            <td className="py-3 px-4 font-bold text-slate-800">{item.sku}</td>
                            <td className="py-3 px-4 font-mono text-teal-700 font-bold">
                              <span className="px-2 py-0.5 bg-teal-50 border border-teal-200 rounded">
                                {item.location}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-600 font-bold text-sm">
                              {parseInt(item.qty).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-500">
                              {item.salePrice ? `฿${item.salePrice}` : '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => removeItem(i)}
                                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-4 bg-white border-t border-slate-100">
                <button
                  onClick={handleSubmit}
                  disabled={items.length === 0 || submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                  {t('confirm_inbound')} ({items.length})
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recent Transactions History */}
        <div className="mt-8">
          <RecentTransactions type="IN" refreshTrigger={items.length} />
        </div>
      </div>

      <ImportTransactionsModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        type="IN"
        products={products}
        onImported={importedItems => setItems(prev => [...prev, ...importedItems])}
      />
    </div>
  );
}
