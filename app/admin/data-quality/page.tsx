'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface Issue {
    type: string;
    source: string;
    row: number;
    description: string;
}

interface AnomalyIssue {
    id: string;
    type: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    description: string;
    entityId?: string;
    entityName?: string;
    value?: string | number;
    action?: 'FIX_STOCK' | 'REVIEW';
}

export default function DataQualityPage() {
  const { t } = useLanguage();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkQuality() {
        try {
            const [paramsRes, aiRes] = await Promise.all([
                fetch('/api/admin/data-quality'),
                fetch('/api/ai/anomaly')
            ]);
            
            const paramsData = await paramsRes.json();
            if (paramsData.issues) setIssues(paramsData.issues);

            const aiData = await aiRes.json();
            if (aiData.issues) setAnomalies(aiData.issues);

        } catch (error) {
            console.error("DQ Check Failed", error);
        } finally {
            setLoading(false);
        }
    }
    checkQuality();
  }, []);

  const unknownSkuCount = issues.filter(i => i.type === 'Unknown SKU').length;
  const invalidQtyCount = issues.filter(i => i.type === 'Invalid Qty').length;

  const dateErrorCount = issues.filter(i => i.type === 'Date Error').length;
  const reconcileErrorCount = issues.filter(i => i.type === 'Stock Mismatch').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
       <header>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
             <div className="p-2 bg-rose-500/10 rounded-lg">
                <ShieldAlert className="w-8 h-8 text-rose-500" />
             </div>
             {t('dq_title')}
          </h1>
          <p className="text-slate-500 mt-2">{t('dq_subtitle')}</p>
       </header>

       {/* Summary Cards */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className={`p-6 rounded-xl border ${unknownSkuCount > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white border-slate-200'}`}>
               <h3 className="text-slate-500 text-sm mb-2">{t('dq_unknown_sku')}</h3>
               <div className={`text-3xl font-bold ${unknownSkuCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                   {loading ? '...' : unknownSkuCount}
               </div>
               <p className="text-xs text-slate-500 mt-2">สินค้าที่ไม่มีใน Master List</p>
           </div>
           
           <div className={`p-6 rounded-xl border ${invalidQtyCount > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white border-slate-200'}`}>
               <h3 className="text-slate-500 text-sm mb-2">{t('dq_invalid_qty')}</h3>
               <div className={`text-3xl font-bold ${invalidQtyCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                   {loading ? '...' : invalidQtyCount}
               </div>
               <p className="text-xs text-slate-500 mt-2">จำนวนติดลบหรือเท่ากับ 0</p>
           </div>

           <div className={`p-6 rounded-xl border ${dateErrorCount > 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-white border-slate-200'}`}>
               <h3 className="text-slate-500 text-sm mb-2">{t('dq_date_error')}</h3>
               <div className={`text-3xl font-bold ${dateErrorCount > 0 ? 'text-blue-600' : 'text-slate-900'}`}>
                   {loading ? '...' : dateErrorCount}
               </div>
               <p className="text-xs text-slate-500 mt-2">วันที่ผิดรูปแบบหรือว่าง</p>
           </div>

           <div className={`p-6 rounded-xl border ${reconcileErrorCount > 0 ? 'bg-purple-500/10 border-purple-500/20' : 'bg-white border-slate-200'}`}>
               <h3 className="text-slate-500 text-sm mb-2">{t('dq_stock_mismatch')}</h3>
               <div className={`text-3xl font-bold ${reconcileErrorCount > 0 ? 'text-purple-600' : 'text-slate-900'}`}>
                   {loading ? '...' : reconcileErrorCount}
               </div>
               <p className="text-xs text-slate-500 mt-2">ยอด Log ไม่ตรงกับยอด Sheet</p>
           </div>
       </div>

       {/* AI Watchdog Section */}
       <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-700 text-white relative">
           <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
           
           <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
               <div className="flex items-center gap-3">
                   <div className="p-2 bg-indigo-500/20 rounded-lg">
                       <ShieldAlert className="w-6 h-6 text-indigo-400" />
                   </div>
                   <div>
                       <h3 className="text-lg font-bold">AI Watchdog</h3>
                       <p className="text-sm text-slate-400">Automated Integrity Checks</p>
                   </div>
               </div>
               <div className="text-sm text-slate-400 font-mono">
                   {anomalies.length} Issues Detected
               </div>
           </div>

           {loading ? (
             <div className="p-8 text-center text-slate-400 animate-pulse">Running diagnostics...</div>
           ) : anomalies.length === 0 ? (
             <div className="p-8 flex flex-col items-center gap-2">
                 <CheckCircle className="w-10 h-10 text-emerald-400" />
                 <p className="font-medium text-emerald-100">All Systems Healthy</p>
             </div>
           ) : (
             <div className="divide-y divide-slate-700/50 max-h-[400px] overflow-y-auto">
                 {anomalies.map((a) => (
                     <div key={a.id} className="p-4 hover:bg-white/5 transition-colors flex gap-4">
                         <div className="mt-1">
                             {a.type === 'CRITICAL' && <AlertTriangle className="w-5 h-5 text-rose-500" />}
                             {a.type === 'WARNING' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                             {a.type === 'INFO' && <AlertTriangle className="w-5 h-5 text-blue-500" />}
                         </div>
                         <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-1">
                                 <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                     a.type === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                                     a.type === 'WARNING' ? 'bg-amber-500/20 text-amber-300' :
                                     'bg-blue-500/20 text-blue-300'
                                 }`}>
                                     {a.type}
                                 </span>
                                 <span className="text-xs text-slate-300 font-mono truncate">{a.entityName}</span>
                             </div>
                             <h4 className="font-bold text-sm text-slate-100">{a.title}</h4>
                             <p className="text-xs text-slate-400 mt-0.5">{a.description}</p>
                         </div>
                         {a.action === 'FIX_STOCK' && (
                             <button className="self-center px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors">
                                 Fix
                             </button>
                         )}
                     </div>
                 ))}
             </div>
           )}
       </div>

       {/* Issues List */}
       <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
           <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="text-slate-800 font-medium">{t('dq_issues_found')}</h3>
               <div className="text-sm text-slate-500">
                   Total: {issues.length} Checkpoints
               </div>
           </div>
           
           {loading ? (
               <div className="p-12 text-center text-slate-500">{t('ai_analyzing')}</div>
           ) : issues.length === 0 ? (
               <div className="p-12 text-center flex flex-col items-center gap-4">
                   <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                       <CheckCircle className="w-8 h-8 text-green-500" />
                   </div>
                   <div className="text-green-400 font-medium">{t('dq_all_good')}</div>
                   <p className="text-slate-500 text-sm">No data quality issues found.</p>
               </div>
           ) : (
               <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                   {issues.map((issue, idx) => (
                       <div key={idx} className="p-4 hover:bg-slate-50 flex items-start gap-4 transition-colors">
                           <div className="mt-1">
                               {issue.type === 'Unknown SKU' && <AlertTriangle className="w-5 h-5 text-rose-500" />}
                               {issue.type === 'Invalid Qty' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                               {issue.type === 'Date Error' && <AlertTriangle className="w-5 h-5 text-blue-500" />}
                               {issue.type === 'Stock Mismatch' && <ShieldAlert className="w-5 h-5 text-purple-500" />}
                           </div>
                           <div className="flex-1">
                               <div className="flex items-center gap-2 mb-1">
                                   <span className={`text-xs font-bold px-2 py-0.5 rounded-full 
                                       ${issue.type === 'Unknown SKU' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 
                                         issue.type === 'Invalid Qty' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 
                                         issue.type === 'Stock Mismatch' ? 'bg-purple-50 text-purple-600 border border-purple-200' :
                                         'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                                       {issue.type}
                                   </span>
                                   <span className="text-slate-500 text-xs">Source: {issue.source} (Row ~{issue.row})</span>
                               </div>
                               <p className="text-slate-700 text-sm">{issue.description}</p>
                           </div>
                       </div>
                   ))}
               </div>
           )}
       </div>
    </div>
  );
}
