'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Save, AlertCircle, CheckCircle, Clock, Check, History, ClipboardList, Lock } from 'lucide-react';
import { useSession } from 'next-auth/react';
import ProductSelector from '@/components/ProductSelector';

// Define Interfaces
interface DamageRecord {
    rowIndex: number;
    date: string;
    product_name: string;
    quantity: number;
    unit: string;
    reason: string;
    status: string;
    notes?: string;
    approver?: string;
}

interface Product {
    id: string;
    name: string;
    category: string;
    stock: number;
    price: number;
    image?: string;
    sku?: string; // Keeping sku as optional just in case, but ProductSelector doesn't use it.
}

export default function DamagePage() {
  const { data: session } = useSession();
  // Safe cast for custom role property
  const isViewer = (session?.user as { role?: string })?.role === 'Viewer';

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Form input
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [qty, setQty] = useState<number | ''>(1);
  const [reason, setReason] = useState('Damaged');
  const [deductStock, setDeductStock] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);

  // Lists State
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [allItems, setAllItems] = useState<DamageRecord[]>([]);
  const [filteredItems, setFilteredItems] = useState<DamageRecord[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    async function init() {
        try {
            const res = await fetch('/api/products');
            const data = await res.json();
            if (Array.isArray(data)) setProducts(data);
        } catch (e) { console.error(e); }

        await fetchRecords();
    }
    init();
  }, []);

  const fetchRecords = async () => {
    setLoadingItems(true);
    try {
        const res = await fetch('/api/damage');
        const data = await res.json();
        if (Array.isArray(data)) {
            // Sort by date desc (newest first)
            setAllItems(data.reverse());
        }
    } catch (e) {
        console.error("Failed to fetch records", e);
    } finally {
        setLoadingItems(false);
    }
  };

  useEffect(() => {
     if (activeTab === 'pending') {
         setFilteredItems(allItems.filter(i => i.status === 'Pending' || i.status === 'รอดำเนินการ'));
     } else {
         setFilteredItems(allItems);
     }
  }, [activeTab, allItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setIsSubmitting(true);
    setStatus(null);

    try {
        const res = await fetch('/api/damage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date,
                sku: selectedProduct.name,
                qty: Number(qty) || 0,
                reason,
                deductStock
            })
        });

        if (!res.ok) throw new Error('Failed to save report');

        setStatus({ type: 'success', msg: 'บันทึกแจ้งของเสียเรียบร้อย' });
        setQty(1);
        setReason('Damaged');
        setDate(new Date().toISOString().split('T')[0]); 
        
        await fetchRecords();

    } catch (error) {
        setStatus({ type: 'error', msg: (error as Error).message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleApprove = async (item: DamageRecord) => {
      if (!confirm(`Confirm approval for ${item.product_name}?`)) return;
      
      try {
          const res = await fetch('/api/damage', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  rowIndex: item.rowIndex, 
                  status: 'Approved', 
                  approver: 'Admin' 
              })
          });

          if (res.ok) {
              alert('Approved successfully');
              await fetchRecords();
          } else {
              throw new Error('Failed to approve');
          }
      } catch (e) {
          alert((e as Error).message);
      }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
       {/* Header */}
       <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
             <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-red-500" />
             </div>
             Report Damaged Goods
             {isViewer && <span className="text-sm bg-slate-100 text-slate-500 px-2 py-1 rounded ml-2 border border-slate-200 flex items-center gap-1"><Lock className="w-3 h-3"/> Read Only</span>}
          </h1>
          <p className="text-slate-500 mt-2">แจ้งสินค้าเสียหายและอนุมัติการตัดจ่าย</p>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Form Section */}
           {!isViewer && (
           <motion.div 
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             className="lg:col-span-2 space-y-8"
           >
               {/* Form Card */}
               <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                   <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                       <Save className="w-5 h-5 text-red-500" />
                       บันทึกรายการใหม่
                   </h2>
                   
                   <form onSubmit={handleSubmit} className="space-y-6">
                       <div>
                           <label className="block text-sm font-medium text-slate-500 mb-2">วันที่พบ (Date)</label>
                           <input 
                               type="date" 
                               value={date}
                               onChange={(e) => setDate(e.target.value)}
                               className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:ring-2 focus:ring-red-500 outline-none" 
                           />
                       </div>

                       <ProductSelector 
                           products={products}
                           onSelect={setSelectedProduct}
                           selectedId={selectedProduct?.id}
                       />

                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-sm font-medium text-slate-500 mb-2">จำนวนที่เสียหาย</label>
                               <input 
                                   type="number" 
                                   min="0" 
                                   value={qty}
                                   onChange={(e) => setQty(e.target.value === '' ? '' : Number(e.target.value))}
                                   className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:ring-2 focus:ring-red-500 outline-none" 
                               />
                           </div>
                           <div>
                               <label className="block text-sm font-medium text-slate-500 mb-2">สาเหตุ</label>
                               <select 
                                   value={reason} 
                                   onChange={(e) => setReason(e.target.value)}
                                   className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:ring-2 focus:ring-red-500 outline-none cursor-pointer"
                               >
                                   <option value="Damaged">แตกหัก/เสียหาย (Damaged)</option>
                                   <option value="Expired">หมดอายุ (Expired)</option>
                                   <option value="Lost">สูญหาย (Lost)</option>
                                   <option value="Other">อื่นๆ (Other)</option>
                               </select>
                           </div>
                       </div>

                       <div className="flex items-center gap-3 p-4 bg-red-50/50 rounded-lg border border-red-100">
                           <input 
                               type="checkbox" 
                               id="deduct"
                               checked={deductStock}
                               onChange={(e) => setDeductStock(e.target.checked)}
                               className="w-5 h-5 accent-red-500"
                           />
                           <label htmlFor="deduct" className="text-sm text-slate-600 font-medium">
                               ตัดสต็อกอัตโนมัติ (Create Outbound Transaction)
                           </label>
                       </div>

                       {status && (
                        <div className={`p-4 rounded-lg flex items-center gap-3 ${status.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            {status.msg}
                        </div>
                    )}

                       <button 
                            type="submit" 
                            disabled={isSubmitting || !selectedProduct}
                            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/20"
                        >
                            {isSubmitting ? <span className="animate-pulse">Saving...</span> : <Save className="w-5 h-5" />}
                            Confirm Report
                        </button>
                   </form>
               </div>
            </motion.div>
            )}

               {/* List Section with Tabs */}
               <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm ${isViewer ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
                   {/* Tabs */}
                   <div className="flex border-b border-slate-100 bg-slate-50">
                       <button 
                           onClick={() => setActiveTab('pending')}
                           className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors border-b-2 ${
                               activeTab === 'pending' 
                               ? 'border-yellow-500 text-yellow-600 bg-white' 
                               : 'border-transparent text-slate-400 hover:text-slate-600'
                           }`}
                       >
                           <Clock className="w-4 h-4" />
                           รออนุมัติ ({allItems.filter(i => i.status === 'Pending' || i.status === 'รอดำเนินการ').length})
                       </button>
                       <button 
                           onClick={() => setActiveTab('history')}
                           className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors border-b-2 ${
                               activeTab === 'history' 
                               ? 'border-blue-500 text-blue-600 bg-white' 
                               : 'border-transparent text-slate-400 hover:text-slate-600'
                           }`}
                       >
                           <History className="w-4 h-4" />
                           ประวัติทั้งหมด ({allItems.length})
                       </button>
                   </div>
                   
                   {loadingItems ? (
                       <div className="text-slate-500 text-center py-8">Loading...</div>
                   ) : filteredItems.length === 0 ? (
                       <div className="text-slate-500 text-center py-12 border-dashed border-slate-800 m-4 rounded-lg">
                           <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-20" />
                           <p>ไม่พบรายการ{activeTab === 'pending' ? 'รออนุมัติ' : ''}</p>
                       </div>
                   ) : (
                       <div className="overflow-x-auto">
                           <table className="w-full text-sm text-left text-slate-600">
                               <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                   <tr>
                                       <th className="px-4 py-3">Date</th>
                                       <th className="px-4 py-3">Product</th>
                                       <th className="px-4 py-3 text-center">Qty</th>
                                       <th className="px-4 py-3">Reason</th>
                                       <th className="px-4 py-3">Status</th>
                                       {activeTab === 'pending' && !isViewer && <th className="px-4 py-3 text-right">Action</th>}
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100">
                                   {filteredItems.map((item, idx) => {
                                        const isPending = item.status === 'Pending' || item.status === 'รอดำเนินการ';
                                        return (
                                           <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                               <td className="px-4 py-3 font-mono text-slate-500 text-xs">{item.date}</td>
                                               <td className="px-4 py-3">
                                                   <div className="font-medium text-slate-900">{item.product_name}</div>
                                                   {item.notes && <div className="text-xs text-slate-400">{item.notes}</div>}
                                               </td>
                                               <td className="px-4 py-3 text-center">
                                                   <span className="bg-red-500/10 text-red-400 px-2 py-1 rounded-md font-bold text-xs">
                                                       {item.quantity} {item.unit}
                                                   </span>
                                               </td>
                                               <td className="px-4 py-3 text-xs">{item.reason}</td>
                                               <td className="px-4 py-3">
                                                   <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                       isPending ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'
                                                   }`}>
                                                       {item.status}
                                                   </span>
                                               </td>
                                               {activeTab === 'pending' && !isViewer && (
                                                   <td className="px-4 py-3 text-right">
                                                       <button 
                                                           onClick={() => handleApprove(item)}
                                                           className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 ml-auto transition-colors"
                                                       >
                                                           <Check className="w-3 h-3" />
                                                           Approve
                                                       </button>
                                                   </td>
                                               )}
                                           </tr>
                                        )
                                   })}
                               </tbody>
                           </table>
                       </div>
                   )}
               </div>

           {/* Side Info */}
           <div className="space-y-4">
              <div className="bg-white border border-slate-200 p-6 rounded-xl sticky top-6 shadow-sm">
                 <h3 className="text-slate-800 font-medium mb-4">ข้อควรระวัง</h3>
                 <ul className="text-sm text-slate-500 space-y-2 list-disc pl-4">
                    <li>การแจ้งของเสียจะมีผลต่อต้นทุนขายทันที</li>
                    <li>หากตัดสต็อก ระบบจะสร้าง Transaction จ่ายออก ประเภท &apos;DAMAGE&apos;</li>
                    <li>ควรตรวจสอบสินค้าจริงก่อนบันทึก</li>
                    <li>รายการที่อนุมัติแล้วจะถูกบันทึกเข้าระบบบัญชี</li>
                 </ul>
              </div>
           </div>
       </div>
    </div>
  );
}
