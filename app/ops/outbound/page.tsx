'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  PackageMinus, 
  Plus, 
  Trash2, 
  Calendar, 
  FileText, 
  Info, 
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  X
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
import PickLocationSelect, { useExtraLocations } from '@/components/warehouse/PickLocationSelect';

export default function OutboundPage() {
  const { t } = useLanguage();
  const { isOnline } = useOfflineSync();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Outbound Mode: ROLLTAG (default) vs DIRECT
  const [mode, setMode] = useState<'ROLLTAG' | 'DIRECT'>('ROLLTAG');
  const [customer, setCustomer] = useState('');
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);

  // Banner on success
  const [bannerInfo, setBannerInfo] = useState<{ title: string; description: string } | null>(null);

  // Cart
  const [items, setItems] = useState<any[]>([]);
  
  // Current Item Form
  const [currentSku, setCurrentSku] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  // '' = main location; an extra bin's code = reduce that bin on issue
  const [currentLocation, setCurrentLocation] = useState('');
  const extraLocations = useExtraLocations();
  const [docRef, setDocRef] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // FIFO Preview State
  const [fifoPreview, setFifoPreview] = useState<any>(null);
  const [fifoLoading, setFifoLoading] = useState(false);
  const [fifoMethod, setFifoMethod] = useState<'FIFO' | 'FEFO'>('FIFO');

  useEffect(() => {
    async function loadProducts() {
        try {
            if (navigator.onLine) {
                const res = await fetch(getApiUrl('/api/products'));
                const data = await res.json();
                setProducts(data);
            } else {
                console.log("Loading products from Offline Cache...");
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
    loadProducts();
  }, []);

  // Fetch Customers for RollTag datalist
  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch(getApiUrl('/api/customers'));
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.customers)) {
            setCustomers(data.customers);
          }
        }
      } catch (e) {
        console.warn("Could not load customer list:", e);
      }
    }
    loadCustomers();
  }, []);

  // FIFO Preview: Fetch when SKU/Qty changes
  useEffect(() => {
    if (!currentSku || !currentQty || Number(currentQty) <= 0) {
      setFifoPreview(null);
      return;
    }

    const fetchPreview = async () => {
      setFifoLoading(true);
      try {
        const res = await fetch(getApiUrl('/api/fifo/preview'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sku: currentSku, qty: Number(currentQty), method: fifoMethod })
        });
        const data = await res.json();
        setFifoPreview(data);
      } catch (e) {
        console.error('FIFO Preview Error:', e);
        setFifoPreview(null);
      } finally {
        setFifoLoading(false);
      }
    };

    const debounce = setTimeout(fetchPreview, 500);
    return () => clearTimeout(debounce);
  }, [currentSku, currentQty, fifoMethod]);

  const addItem = () => {
     if (!currentSku || !currentQty) return;
     setItems(prev => [
        ...prev, 
        { sku: currentSku, qty: currentQty, salePrice: currentPrice, location: currentLocation || undefined }
     ]);
     // Clear inputs
     setCurrentSku('');
     setCurrentQty('');
     setCurrentPrice('');
     setCurrentLocation('');
  };

  const removeItem = (idx: number) => {
     setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(getApiUrl('/api/orders/upload-excel'), {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      const tags = (data.results || []).map((r: any) => r.tagId);
      const tagStr = tags.join(', ');
      toast.success(`ส่งเข้าคิวสำเร็จ (${tagStr || data.processed + ' แท็ก'})`);
      setBannerInfo({
        title: `ส่งเข้าคิวจัดการออเดอร์สำเร็จ (${tagStr})`,
        description: `นำเข้าไฟล์ "${file.name}" สำเร็จ สร้าง ${data.processed} RollTag (${tagStr})`
      });
    } catch (err: any) {
      console.error("Excel upload error:", err);
      toast.error(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;

    if (mode === 'ROLLTAG') {
      if (!customer.trim()) {
        toast.error('กรุณาระบุชื่อลูกค้า');
        return;
      }
      if (!isOnline) {
        toast.error('กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อส่งเข้าคิวจัดการออเดอร์');
        return;
      }
      if (!confirm(`ยืนยันการส่ง ${items.length} รายการเข้าคิวจัดการออเดอร์ (RollTag)?`)) return;

      setSubmitting(true);
      try {
        const res = await fetch(getApiUrl('/api/orders/manual-rolltag'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer: customer.trim(),
            orderNo: docRef.trim(),
            items
          })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create RollTag');
        }

        const tagText = data.tagId || (data.results?.[0]?.tagId) || 'RollTag';
        toast.success(`ส่งเข้าคิวจัดการออเดอร์สำเร็จ (${tagText})`);
        setBannerInfo({
          title: `ส่งเข้าคิวจัดการออเดอร์สำเร็จ (${tagText})`,
          description: `สร้างแท็ก ${tagText} สำหรับลูกค้า "${customer.trim()}" จำนวน ${items.length} รายการเรียบร้อยแล้ว`
        });
        setItems([]);
        setDocRef('');
        setCustomer('');
      } catch (err: any) {
        console.error("Manual RollTag Error:", err);
        toast.error(err.message || 'ส่งเข้าคิวจัดการออเดอร์ไม่สำเร็จ');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // DIRECT mode: existing logic
    if (!confirm(`${t('confirm_prompt')} ${items.length}?`)) return;

    setSubmitting(true);
    
    const payloadItems = items.map(i => ({
         ...i,
         date,
         docRef // Apply global docRef to all items
    }));
    const payload = { items: payloadItems };

    // OFFLINE LOGIC
    if (!isOnline) {
        try {
            await db.pendingTransactions.add({
                type: 'OUTBOUND',
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
      const res = await fetch(getApiUrl('/api/outbound'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) 
      });
      
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json().catch(() => null);

      toast.success(t('success_outbound'));
      (result?.warnings || []).forEach((w: string) => toast(w, { icon: '⚠️', duration: 8000 }));
      setItems([]);
      setDocRef('');
    } catch (error: any) {
      console.error(error);
      if (confirm("Network Failed. Save locally to sync later?")) {
          await db.pendingTransactions.add({
                type: 'OUTBOUND',
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
    <div className="relative min-h-screen px-4 py-6 pb-20 sm:px-6 lg:p-8">
      <AmbientBackground />
      
      <div className="max-w-[1500px] mx-auto relative z-10">
      
        {/* Header */}
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-8 overflow-hidden rounded-[1.75rem] border border-rose-200 bg-white/85 p-6 shadow-xl shadow-rose-900/10 backdrop-blur-xl"
        >
           <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-600 via-amber-500 to-blue-500" />
           
           <Link href="/dashboard" className="relative z-10 text-slate-500 hover:text-rose-600 flex items-center gap-2 mb-6 transition-colors font-bold uppercase text-xs tracking-widest">
              <ArrowLeft className="w-4 h-4" /> {t('back_to_dashboard')}
           </Link>
           <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex items-center gap-5">
                   <div className="p-5 bg-gradient-to-br from-rose-600 to-orange-600 rounded-3xl shadow-xl shadow-rose-900/20">
                     <PackageMinus className="w-10 h-10 text-white" />
                   </div>
                   <div>
                       <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-rose-700">Dispatch Workspace</p>
                       <h1 className="text-4xl font-black text-slate-950 tracking-tight mb-1">
                          {t('outbound_order')}
                       </h1>
                       <p className="text-slate-500 font-semibold text-sm">{t('outbound_subtitle')}</p>
                   </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleUploadExcel}
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingFile}
                        className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white px-5 py-3.5 rounded-2xl font-bold transition-all active:scale-95 shadow-md shadow-rose-600/20 disabled:opacity-50"
                    >
                        {isUploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                        <span>{isUploadingFile ? 'กำลังส่งเข้าคิว...' : 'แนบไฟล์ส่งเข้าคิวออเดอร์ (.xlsx/.csv)'}</span>
                    </button>
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center gap-2 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-rose-200 px-6 py-3.5 rounded-2xl font-bold transition-all active:scale-95 shadow-sm"
                    >
                        <FileSpreadsheet className="w-5 h-5 text-rose-500" />
                        <span>{t('import_excel')}</span>
                    </button>
                </div>
            </div>
        </motion.div>

        {/* Banner after successful RollTag or Excel upload */}
        {bannerInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-emerald-950 text-sm">{bannerInfo.title}</p>
                <p className="text-xs text-emerald-700 mt-0.5">{bannerInfo.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/orders"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 whitespace-nowrap active:scale-95"
              >
                <span>ไปที่หน้าจัดการออเดอร์</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setBannerInfo(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Form */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* Document Info Card */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-xl"
                >
                    <h3 className="font-bold text-slate-800 mb-5 uppercase text-sm tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-rose-500" /> {t('document_info')}
                    </h3>

                    {/* Mode Toggle */}
                    <div className="mb-5">
                        <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider">
                            รูปแบบการทำงาน (Outbound Mode)
                        </label>
                        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl gap-1">
                            <button
                                type="button"
                                onClick={() => setMode('ROLLTAG')}
                                className={cn(
                                    "py-2.5 px-2 text-xs font-bold rounded-lg transition-all text-center leading-tight",
                                    mode === 'ROLLTAG'
                                        ? "bg-white text-rose-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                ส่งเข้าคิวจัดการออเดอร์ (RollTag)
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('DIRECT')}
                                className={cn(
                                    "py-2.5 px-2 text-xs font-bold rounded-lg transition-all text-center leading-tight",
                                    mode === 'DIRECT'
                                        ? "bg-white text-rose-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                จ่ายออกทันที (Direct Issue)
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {mode === 'ROLLTAG' && (
                            <div className="group">
                                <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">
                                    ลูกค้า / Customer <span className="text-rose-500">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    list="outbound-customers"
                                    value={customer} 
                                    onChange={e => setCustomer(e.target.value)} 
                                    placeholder="พิมพ์ค้นหาหรือกรอกชื่อลูกค้าใหม่..." 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium" 
                                />
                                <datalist id="outbound-customers">
                                    {customers.map((c, idx) => (
                                        <option key={`${c.id}-${idx}`} value={c.name ? `${c.name} (${c.id})` : c.id}>
                                            {c.name ? `${c.name} (${c.id})` : c.id}
                                        </option>
                                    ))}
                                </datalist>
                            </div>
                        )}

                        <div className="group">
                             <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">{t('date')}</label>
                             <div className="relative">
                                 <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                 <input 
                                    type="date" 
                                    value={date} 
                                    onChange={e => setDate(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium" 
                                 />
                             </div>
                        </div>
                        <div className="group">
                             <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">
                                 {mode === 'ROLLTAG' ? 'เลขที่คำสั่งซื้อ / Order No.' : t('reference_inv')}
                             </label>
                             <input 
                                type="text" 
                                value={docRef} 
                                onChange={e => setDocRef(e.target.value)} 
                                placeholder={mode === 'ROLLTAG' ? "e.g. PO-2024-001 / SO-001" : "e.g. INV-2024-001"} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium" 
                             />
                        </div>
                    </div>
                </motion.div>

                {/* Add Item Card */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-xl"
                >
                    <h3 className="font-bold text-slate-800 mb-6 uppercase text-sm tracking-wider flex items-center gap-2">
                        <Plus className="w-4 h-4 text-rose-500" /> {t('add_item')}
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
                                onChange={v => { setCurrentSku(v); setCurrentLocation(''); }}
                                placeholder="-- Select Product --"
                                disabled={loading}
                            />
                        </div>

                        <PickLocationSelect
                            product={products.find(prod => prod.name === currentSku)}
                            extras={extraLocations}
                            value={currentLocation}
                            onChange={setCurrentLocation}
                        />

                        {currentSku && (() => {
                            const p = products.find(prod => prod.name === currentSku);
                            if (p?.fifo?.maxDaysOld > 90) {
                                return (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-200">
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-amber-700 uppercase">
                                                {t('fifo_recommendation')}
                                            </p>
                                            <p className="text-sm text-amber-800">
                                                Pick stock from <strong>{p.fifo.oldestDate}</strong> ({p.fifo.maxDaysOld} days old).
                                            </p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        <div className="grid grid-cols-2 gap-4">
                             <div className="group">
                                <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">{t('qty')}</label>
                                <input 
                                    type="number" 
                                    value={currentQty} 
                                    onChange={e => setCurrentQty(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all" 
                                    placeholder="0" 
                                />
                             </div>
                             <div className="group">
                                <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">{t('price_opt')}</label>
                                <input 
                                    type="number" 
                                    value={currentPrice} 
                                    onChange={e => setCurrentPrice(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all" 
                                    placeholder="0.00" 
                                />
                             </div>
                        </div>

                        {/* FIFO/FEFO Preview Info Box */}
                        {fifoPreview && currentSku && currentQty && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                <div className="flex items-start gap-2">
                                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm w-full">
                                        {/* Method Toggle */}
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-bold text-blue-800">{fifoMethod === 'FIFO' ? 'FIFO (ของเก่าก่อน)' : 'FEFO (หมดอายุก่อน)'}</p>
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => setFifoMethod('FIFO')}
                                                    className={`px-2 py-1 text-xs rounded-lg font-bold ${fifoMethod === 'FIFO' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}
                                                >FIFO</button>
                                                <button 
                                                    onClick={() => setFifoMethod('FEFO')}
                                                    className={`px-2 py-1 text-xs rounded-lg font-bold ${fifoMethod === 'FEFO' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-600'}`}
                                                >FEFO</button>
                                            </div>
                                        </div>
                                        {fifoLoading ? (
                                            <p className="text-blue-600">กำลังคำนวณ...</p>
                                        ) : fifoPreview.allocations?.length > 0 ? (
                                            <div className="space-y-1">
                                                <p className="text-blue-700">สต๊อคคงเหลือ: <strong>{fifoPreview.currentStock}</strong> ชิ้น</p>
                                                <p className="text-blue-700">จะดึงจาก:</p>
                                                <ul className="list-disc list-inside text-blue-600 text-xs space-y-0.5">
                                                    {fifoPreview.allocations.map((a: any, i: number) => (
                                                        <li key={i}>
                                                            <strong>{a.qtyFromLayer}</strong> ชิ้น 
                                                            {a.expiryDate ? ` (หมดอายุ ${a.expiryDate})` : ` (รับ ${a.date})`}
                                                            <span className="text-slate-400"> • {a.daysOld} วัน</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <p className="text-red-600 font-medium">⚠️ สต๊อคไม่เพียงพอ!</p>
                                        )}
                                    </div>
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
                 <div className="bg-white/95 border border-slate-200 rounded-2xl overflow-hidden min-h-[500px] flex flex-col shadow-lg shadow-slate-900/5">
                     <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center backdrop-blur-sm">
                         <h3 className="font-bold text-slate-900 flex items-center gap-3 text-lg">
                            {t('items_list')} <span className="bg-rose-100 text-rose-800 text-xs px-3 py-1 rounded-full border border-rose-200 font-bold">{items.length}</span>
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
                                <PackageMinus className="w-16 h-16 mb-4 stroke-1" />
                                <p className="text-lg font-medium">{t('no_items_added')}</p>
                                <p className="text-sm">{t('select_product_prompt')}</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="text-white uppercase font-black text-[10px] tracking-[0.1em] sticky top-0 z-20">
                                    <tr className="bg-gradient-to-r from-rose-600 to-pink-600 shadow-md">
                                        <th className="p-5 rounded-l-2xl">{t('product')}</th>
                                        <th className="p-5 text-right">{t('qty')}</th>
                                        <th className="p-5 text-right">{t('price_opt')}</th>
                                        <th className="p-5 text-center rounded-r-2xl">{t('edit')}</th>
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
                                            <td className="p-4 font-bold text-slate-800 text-base">
                                                {item.sku}
                                                {item.location && (
                                                    <span className="ml-2 px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-mono">{item.location}</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right font-mono text-rose-600 font-bold text-lg">{parseInt(item.qty).toLocaleString()}</td>
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
                            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-rose-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-lg"
                        >
                            {submitting ? <Loader2 className="animate-spin w-6 h-6" /> : <Send className="w-6 h-6" />}
                            {mode === 'ROLLTAG' 
                                ? `ส่งเข้าคิวจัดการออเดอร์ (${items.length})` 
                                : `${t('confirm_outbound')} (${items.length})`}
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
             <RecentTransactions type="OUT" refreshTrigger={items.length} />
        </motion.div>
      </div>

      <ImportTransactionsModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          type="OUT"
          products={products}
          onImported={(importedItems) => setItems(prev => [...prev, ...importedItems])}
      />
    </div>
  );
}
