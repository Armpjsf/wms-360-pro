'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  Undo2, 
  Plus, 
  Trash2, 
  Calendar, 
  FileText, 
  Info,
  Package,
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
import PickLocationSelect, { useExtraLocations } from '@/components/warehouse/PickLocationSelect';

export default function ReturnOutPage() {
  const { t } = useLanguage();
  const { isOnline } = useOfflineSync();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Return-Out Mode: ROLLTAG (default) vs DIRECT
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
  const [currentLocation, setCurrentLocation] = useState('');
  const extraLocations = useExtraLocations();
  const [docRef, setDocRef] = useState('');
  const [reason, setReason] = useState('ส่งคืน Supplier');
  const [customReason, setCustomReason] = useState('');
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
    if (!currentSku || !currentQty || Number(currentQty) <= 0) return;
    setItems(prev => [
      ...prev, 
      { 
        sku: currentSku, 
        qty: currentQty, 
        salePrice: currentPrice, 
        location: currentLocation || undefined 
      }
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

  const effectiveReason = reason === 'อื่นๆ' ? (customReason.trim() || 'ส่งกลับ') : reason;

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('isReturnOut', 'true');

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
      toast.success(`ส่งเข้าคิวส่งกลับสำเร็จ (${tagStr || data.processed + ' แท็ก'})`);
      setBannerInfo({
        title: `ส่งเข้าคิวจัดการส่งกลับสินค้าสำเร็จ (${tagStr})`,
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
        toast.error('กรุณาระบุชื่อลูกค้า / ผู้รับคืน');
        return;
      }
      if (!isOnline) {
        toast.error('กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อส่งเข้าคิวจัดการออเดอร์');
        return;
      }
      if (!confirm(`ยืนยันการส่งรายการส่งกลับ ${items.length} รายการเข้าคิวจัดการออเดอร์ (RollTag)?`)) return;

      setSubmitting(true);
      try {
        const orderNo = docRef.trim() || effectiveReason;
        const res = await fetch(getApiUrl('/api/orders/manual-rolltag'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer: customer.trim(),
            orderNo,
            items,
            isReturnOut: true
          })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create RollTag');
        }

        const tagText = data.tagId || (data.results?.[0]?.tagId) || 'RollTag';
        toast.success(`ส่งเข้าคิวจัดการส่งกลับสำเร็จ (${tagText})`);
        setBannerInfo({
          title: `ส่งเข้าคิวจัดการส่งกลับสำเร็จ (${tagText})`,
          description: `สร้างแท็ก ${tagText} สำหรับ "${customer.trim()}" จำนวน ${items.length} รายการเรียบร้อยแล้ว`
        });
        setItems([]);
        setDocRef('');
        setCustomer('');
      } catch (err: any) {
        console.error("Manual RollTag Error:", err);
        toast.error(err.message || 'ส่งเข้าคิวจัดการส่งกลับไม่สำเร็จ');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // DIRECT mode: existing logic
    if (!isOnline) {
      toast.error('กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อทำรายการส่งกลับสินค้า');
      return;
    }

    if (!confirm(`ยืนยันการบันทึกส่งกลับสินค้าจำนวน ${items.length} รายการ?`)) return;

    setSubmitting(true);
    
    const payloadItems = items.map(i => ({
      ...i,
      date,
      docRef: docRef.trim() || undefined,
    }));

    const payload = { 
      items: payloadItems,
      reason: effectiveReason,
    };

    try {
      const res = await fetch(getApiUrl('/api/return-out'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) 
      });
      
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');

      toast.success(result?.message || 'บันทึกส่งกลับสินค้าสำเร็จ');
      (result?.warnings || []).forEach((w: string) => toast(w, { icon: '⚠️', duration: 8000 }));
      setItems([]);
      setDocRef('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'บันทึกส่งกลับสินค้าไม่สำเร็จ');
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
            className="relative mb-8 overflow-hidden rounded-[1.75rem] border border-indigo-200 bg-white/85 p-6 shadow-xl shadow-indigo-900/10 backdrop-blur-xl"
        >
           <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-600 via-violet-500 to-purple-500" />
           
           <Link href="/ops" className="relative z-10 text-slate-500 hover:text-indigo-600 flex items-center gap-2 mb-6 transition-colors font-bold uppercase text-xs tracking-widest">
              <ArrowLeft className="w-4 h-4" /> ย้อนกลับ Operations
           </Link>
           <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex items-center gap-5">
                   <div className="p-5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl shadow-xl shadow-indigo-900/20">
                     <Undo2 className="w-10 h-10 text-white" />
                   </div>
                   <div>
                       <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-700">Inventory Returns Workspace</p>
                       <h1 className="text-4xl font-black text-slate-950 tracking-tight mb-1">
                          ส่งกลับสินค้า (Return Out)
                       </h1>
                       <p className="text-slate-500 font-semibold text-sm">
                          ตัดสต็อกสินค้าจริงออกจากระบบ แต่ไม่นับรวมในยอดขายหรือสรุปยอดจ่ายออกของคลัง (เช่น คืน Supplier / ส่งกลับสาขาใหญ่)
                       </p>
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
                        className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-3.5 rounded-2xl font-bold transition-all active:scale-95 shadow-md shadow-indigo-600/20 disabled:opacity-50"
                    >
                        {isUploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                        <span>{isUploadingFile ? 'กำลังส่งเข้าคิว...' : 'แนบไฟล์ส่งเข้าคิวส่งกลับ (.xlsx/.csv)'}</span>
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
                        <FileText className="w-4 h-4 text-indigo-500" /> ข้อมูลเอกสาร & เหตุผล
                    </h3>

                    {/* Mode Toggle */}
                    <div className="mb-5">
                        <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider">
                            รูปแบบการทำงาน (Return Mode)
                        </label>
                        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl gap-1">
                            <button
                                type="button"
                                onClick={() => setMode('ROLLTAG')}
                                className={cn(
                                    "py-2.5 px-2 text-xs font-bold rounded-lg transition-all text-center leading-tight",
                                    mode === 'ROLLTAG'
                                        ? "bg-white text-indigo-600 shadow-sm"
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
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                ตัดสต็อกส่งกลับทันที (Direct)
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {mode === 'ROLLTAG' && (
                            <div className="group">
                                <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-indigo-600 transition-colors">
                                    ลูกค้า / ผู้รับคืน <span className="text-rose-500">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    list="return-out-customers"
                                    value={customer} 
                                    onChange={e => setCustomer(e.target.value)} 
                                    placeholder="พิมพ์ค้นหาหรือกรอกชื่อลูกค้า / ซัพพลายเออร์..." 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium" 
                                />
                                <datalist id="return-out-customers">
                                    {customers.map((c, idx) => (
                                        <option key={`${c.id}-${idx}`} value={c.name ? `${c.name} (${c.id})` : c.id}>
                                            {c.name ? `${c.name} (${c.id})` : c.id}
                                        </option>
                                    ))}
                                </datalist>
                            </div>
                        )}

                        <div className="group">
                             <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-indigo-600 transition-colors">
                                วันที่ทำรายการ
                             </label>
                             <div className="relative">
                                 <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                 <input 
                                    type="date" 
                                    value={date} 
                                    onChange={e => setDate(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium" 
                                 />
                             </div>
                        </div>

                        <div className="group">
                             <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-indigo-600 transition-colors">
                                เลขที่เอกสารอ้างอิง (Doc Ref / RTN No.)
                             </label>
                             <input 
                                type="text" 
                                value={docRef} 
                                onChange={e => setDocRef(e.target.value)} 
                                placeholder="e.g. RTN-2024-001 / ใบส่งคืนซัพพลายเออร์" 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium" 
                             />
                        </div>

                        <div className="group">
                             <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-indigo-600 transition-colors">
                                เหตุผล / ปลายทางส่งกลับ
                             </label>
                             <select
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                             >
                                <option value="ส่งคืน Supplier">ส่งคืน Supplier (คืนผู้จัดจำหน่าย)</option>
                                <option value="ส่งกลับสาขาใหญ่">ส่งกลับสาขาใหญ่ / คลังกลาง</option>
                                <option value="โอนย้ายข้ามสาขา">โอนย้ายข้ามสาขา (Transfer Out)</option>
                                <option value="เคลมสินค้า">เคลมสินค้า (Claim to Vendor)</option>
                                <option value="อื่นๆ">อื่นๆ (ระบุเอง)</option>
                             </select>
                             {reason === 'อื่นๆ' && (
                                <input 
                                  type="text" 
                                  value={customReason} 
                                  onChange={e => setCustomReason(e.target.value)} 
                                  placeholder="ระบุเหตุผลหรือปลายทางส่งกลับ..." 
                                  className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium" 
                                />
                             )}
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
                        <Plus className="w-4 h-4 text-indigo-500" /> เพิ่มรายการสินค้าที่จะส่งกลับ
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
                                placeholder="-- เลือกสินค้า --"
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
                                                ควรเลือกสต็อกจากล็อต <strong>{p.fifo.oldestDate}</strong> (เก็บมา {p.fifo.maxDaysOld} วันแล้ว)
                                            </p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        <div className="grid grid-cols-2 gap-4">
                             <div className="group">
                                <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-indigo-600 transition-colors">{t('qty')}</label>
                                <input 
                                    type="number" 
                                    value={currentQty} 
                                    onChange={e => setCurrentQty(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                                    placeholder="0" 
                                    min="1"
                                />
                             </div>
                             <div className="group">
                                <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-indigo-600 transition-colors">ราคาอ้างอิง (ถ้ามี)</label>
                                <input 
                                    type="number" 
                                    value={currentPrice} 
                                    onChange={e => setCurrentPrice(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium" 
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
                            disabled={!currentSku || !currentQty || Number(currentQty) <= 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                        >
                            <Plus className="w-5 h-5" /> เพิ่มลงรายการ
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
                            รายการสินค้าที่จะส่งกลับ <span className="bg-indigo-100 text-indigo-800 text-xs px-3 py-1 rounded-full border border-indigo-200 font-bold">{items.length}</span>
                         </h3>
                         {items.length > 0 && (
                            <button onClick={() => setItems([])} className="text-xs text-red-500 hover:text-red-700 font-bold uppercase tracking-wider transition-colors">
                                ล้างรายการทั้งหมด
                            </button>
                         )}
                     </div>
                     
                     <div className="flex-1 overflow-auto p-2">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60 py-20">
                                <Package className="w-16 h-16 mb-4 stroke-1" />
                                <p className="text-lg font-medium">ยังไม่มีรายการสินค้า</p>
                                <p className="text-sm">เลือกสินค้าและจำนวนจากฟอร์มด้านซ้ายเพื่อเพิ่มลงรายการ</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="text-white uppercase font-black text-[10px] tracking-[0.1em] sticky top-0 z-20">
                                    <tr className="bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md">
                                        <th className="p-5 rounded-l-2xl">{t('product')}</th>
                                        <th className="p-5 text-right">{t('qty')}</th>
                                        <th className="p-5 text-right">ราคาอ้างอิง</th>
                                        <th className="p-5 text-center rounded-r-2xl">จัดการ</th>
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
                                            <td className="p-4 text-right font-mono text-indigo-600 font-bold text-lg">{parseInt(item.qty).toLocaleString()}</td>
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
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-lg"
                        >
                            {submitting ? (
                              <Loader2 className="animate-spin w-6 h-6" />
                            ) : (
                              <Send className="w-6 h-6" />
                            )}
                            {mode === 'ROLLTAG' 
                              ? `ส่งเข้าคิวจัดการออเดอร์ (${items.length} รายการ)` 
                              : `ยืนยันการส่งกลับสินค้า (${items.length} รายการ)`}
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
             <RecentTransactions type="OUT" onlyReturnOut={true} refreshTrigger={items.length} title="รายการส่งกลับล่าสุด (Recent Return Out)" />
        </motion.div>
      </div>
    </div>
  );
}
