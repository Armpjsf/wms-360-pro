'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, CheckCircle, XCircle, Search, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface DamageRecord {
  date: string;
  product_name: string;
  quantity: number;
  unit: string;
  reason: string;
  notes: string;
  reported_by: string;
  status: string;
  approved_by: string;
  approved_date: string;
}

export default function DamagePage() {
  const { t } = useLanguage();
  const [records, setRecords] = useState<DamageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [products, setProducts] = useState<any[]>([]); // Product Dropdown
  const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      product_name: '',
      quantity: 0,
      unit: '',
      reason: 'Production Defect', // Default internal value
      notes: ''
  });

  const fetchRecords = async () => {
      setLoading(true);
      try {
          const res = await fetch('/api/damage');
          const json = await res.json();
          if (Array.isArray(json)) setRecords(json);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const fetchProducts = async () => {
      try {
          const res = await fetch('/api/products');
          const json = await res.json();
          if (Array.isArray(json)) setProducts(json);
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
      fetchRecords();
      fetchProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.product_name || formData.quantity <= 0) return alert("Please fill incomplete fields.");

      try {
          const res = await fetch('/api/damage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(formData)
          });
          if (res.ok) {
              alert(t('success_inbound') || "Recorded"); // Reuse success message or generic
              setShowForm(false);
              fetchRecords();
              setFormData({ ...formData, product_name: '', quantity: 0, notes: '' });
          } else {
              alert("Error: " + res.statusText);
          }
      } catch (e) {
          alert("Error: " + e);
      }
  };

  const handleApprove = async (index: number, currentStatus: string) => {
      if (currentStatus === t('status_approved')) return;
      if (!confirm(t('confirm_approve'))) return;

      try {
          const res = await fetch('/api/damage', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  rowIndex: index, // 0-based index from list corresponds to row in sheet logic
                  status: 'อนุมัติแล้ว', // Keep internal status consistent if backend expects Thai, or switch to English if safe
                  approver: 'Admin' 
              })
          });
          if (res.ok) {
              fetchRecords();
          }
      } catch (e) {
          alert("Error updating status");
      }
  };

  const getReasonLabel = (r: string) => {
     // Map internal reason values to translation keys if possible
     // Or just return the string if it's custom.
     // Simple mapping for demo:
     if (r.includes("Production")) return t('cause_production');
     if (r === "Production Defect") return t('cause_production');
     if (r === "Transport Damage") return t('cause_transport');
     if (r === "Expired") return t('cause_expired');
     if (r === "Damaged during Use") return t('cause_damaged_use');
     if (r === "Other") return t('cause_other');
     
     // Fallback for Thai hardcoded values in DB
     if (r === "ของเสียจากการผลิต") return t('cause_production');
     if (r === "ของเสียจากการขนส่ง") return t('cause_transport');
     if (r === "ของหมดอายุ") return t('cause_expired');
     if (r === "ชำรุดเสียหายระหว่างการใช้งาน") return t('cause_damaged_use');
     if (r === "อื่นๆ") return t('cause_other');

     return r;
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-orange-500" />
                {t('damage_report_title')}
            </h1>
            <p className="text-slate-400">{t('damage_subtitle')}</p>
        </div>
        <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-orange-900/20"
        >
            <Plus className="w-5 h-5" />
            {showForm ? t('close_form') : t('report_damage_btn')}
        </button>
      </div>

      {/* Form Section */}
      {showForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800"
          >
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className="block text-slate-400 mb-2">{t('found_date')}</label>
                      <input 
                        type="date" 
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"
                      />
                  </div>
                  <div>
                      <label className="block text-slate-400 mb-2">{t('product')}</label>
                      <select 
                        value={formData.product_name}
                        onChange={e => {
                            const p = products.find(prod => prod.name === e.target.value);
                            setFormData({...formData, product_name: e.target.value, unit: p?.unit || 'pcs'});
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"
                      >
                          <option value="">-- {t('select_product')} --</option>
                          {products.map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                      </select>
                  </div>
                  <div>
                      <label className="block text-slate-400 mb-2">{t('qty')}</label>
                      <input 
                        type="number" 
                        min="0"
                        value={formData.quantity}
                        onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"
                      />
                  </div>
                  <div>
                      <label className="block text-slate-400 mb-2">{t('col_category')} (Reason)</label>
                      <select 
                        value={formData.reason}
                        onChange={e => setFormData({...formData, reason: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-orange-500"
                      >
                          <option value="Production Defect">{t('cause_production')}</option>
                          <option value="Transport Damage">{t('cause_transport')}</option>
                          <option value="Expired">{t('cause_expired')}</option>
                          <option value="Damaged during Use">{t('cause_damaged_use')}</option>
                          <option value="Other">{t('cause_other')}</option>
                      </select>
                  </div>
                  <div className="md:col-span-2">
                       <label className="block text-slate-400 mb-2">{t('notes')}</label>
                       <textarea 
                         value={formData.notes}
                         onChange={e => setFormData({...formData, notes: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-orange-500 h-24"
                       />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                      <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-8 rounded-xl transition-all">
                          {t('confirm_record')}
                      </button>
                  </div>
              </form>
          </motion.div>
      )}

      {/* Table Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
           <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                        <th className="p-4">{t('date')}</th>
                        <th className="p-4">{t('product')}</th>
                        <th className="p-4 text-right">{t('qty')}</th>
                        <th className="p-4">{t('col_category')}</th>
                        <th className="p-4">{t('reporter')}</th>
                        <th className="p-4 text-center">{t('col_status')}</th>
                        <th className="p-4 text-center">{t('edit')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {loading ? (
                         <tr><td colSpan={7} className="p-8 text-center animate-pulse">{t('processing')}</td></tr>
                    ) : records.length === 0 ? (
                         <tr><td colSpan={7} className="p-8 text-center">{t('no_logs')}</td></tr>
                    ) : (
                        records.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                                <td className="p-4">{r.date}</td>
                                <td className="p-4 font-medium text-white">{r.product_name}</td>
                                <td className="p-4 text-right text-red-400 font-bold">{r.quantity} {r.unit}</td>
                                <td className="p-4">{getReasonLabel(r.reason)}</td>
                                <td className="p-4">{r.reported_by}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        r.status === 'อนุมัติแล้ว' || r.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-500'
                                    }`}>
                                        {r.status === 'อนุมัติแล้ว' || r.status === 'Approved' ? t('status_approved') : t('status_pending')}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    {(r.status !== 'อนุมัติแล้ว' && r.status !== 'Approved') && (
                                        <button 
                                            onClick={() => handleApprove(i, r.status)}
                                            className="p-2 bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors group"
                                            title={t('approve_btn')}
                                        >
                                            <CheckCircle className="w-4 h-4 text-slate-400 group-hover:text-white" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
           </table>
      </div>
    </div>
  );
}
