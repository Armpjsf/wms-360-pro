'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, ShoppingCart, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function ForecastPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
     async function load() {
         try {
             const res = await fetch('/api/analytics/forecast/advanced');
             const json = await res.json();
             if(Array.isArray(json)) setData(json);
         } catch (e) {
             console.error(e);
         } finally {
             setLoading(false);
         }
     }
     load();
  }, []);

  const highRisk = data.filter(i => i.riskLevel === 'Very High' || i.riskLevel === 'High');
  const reorderNeeded = data.filter(i => i.reorderAction === 'Reorder Now');

  return (
    <div className="relative min-h-screen px-4 py-6 sm:px-6 lg:p-8">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-[1500px] space-y-7">
        <Link href="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
            {t('back_to_analytics')}
        </Link>
        <div className="relative overflow-hidden rounded-[1.75rem] border border-violet-200 bg-white/85 p-6 shadow-xl shadow-violet-900/10 backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-600 via-blue-600 to-amber-500" />
          <div>
              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-700">Demand Signal</p>
              <h1 className="text-3xl font-black text-slate-950 mb-2">{t('forecast_title')}</h1>
              <p className="text-slate-500 font-semibold">{t('forecast_subtitle')}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="relative z-10 mx-auto mt-7 grid max-w-[1500px] grid-cols-1 gap-6 md:grid-cols-3">
          <div className="bg-white/90 border border-rose-200 p-6 rounded-2xl flex items-center justify-between shadow-lg shadow-rose-900/5">
               <div>
                   <div className="text-slate-400 text-sm mb-1">{t('high_risk_items')}</div>
                   <div className="text-3xl font-bold text-red-500">{highRisk.length}</div>
                   <div className="text-xs text-red-400 mt-2">{t('label_stock')} {"<"} 15-30 {t('ai_unit')}</div>
               </div>
               <AlertTriangle className="w-10 h-10 text-red-500/50" />
          </div>
          <div className="bg-white/90 border border-orange-200 p-6 rounded-2xl flex items-center justify-between shadow-lg shadow-orange-900/5">
               <div>
                   <div className="text-slate-400 text-sm mb-1">{t('reorder_suggestions')}</div>
                   <div className="text-3xl font-bold text-orange-400">{reorderNeeded.length}</div>
                   <div className="text-xs text-orange-400 mt-2">{t('ai_action_needed')}</div>
               </div>
               <ShoppingCart className="w-10 h-10 text-orange-400/50" />
          </div>
           <div className="bg-white/90 border border-blue-200 p-6 rounded-2xl flex items-center justify-between shadow-lg shadow-blue-900/5">
               <div>
                   <div className="text-slate-400 text-sm mb-1">{t('total_forecasted')}</div>
                   <div className="text-3xl font-bold text-blue-400">{data.length}</div>
                   <div className="text-xs text-blue-400 mt-2">{t('ai_total_items')}</div>
               </div>
               <TrendingUp className="w-10 h-10 text-blue-400/50" />
          </div>
      </div>

      {/* Main Content Grid */}
      <div className="relative z-10 mx-auto mt-8 grid max-w-[1500px] grid-cols-1 gap-8 lg:grid-cols-2">
          
          {/* Left: Risk Table */}
          <div className="bg-white/90 border border-slate-200 rounded-2xl overflow-hidden shadow-xl shadow-slate-900/5">
               <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                   <h3 className="font-black text-slate-950 flex items-center gap-2">
                       <AlertTriangle className="w-4 h-4 text-red-400" /> {t('stock_risk_monitor')}
                   </h3>
               </div>
               <div className="max-h-[500px] overflow-y-auto">
                   <table className="w-full text-left text-slate-600 text-sm">
                       <thead className="bg-slate-50 text-slate-500 sticky top-0">
                           <tr>
                               <th className="p-3">{t('product')}</th>
                               <th className="p-3 text-right">{t('label_stock')}</th>
                               <th className="p-3 text-right">{t('days_supply')}</th>
                               <th className="p-3">{t('risk_level')}</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {loading ? <tr><td colSpan={4} className="p-4 text-center">{t('ai_analyzing')}</td></tr> : 
                            data.slice(0, 50).map((item, i) => (
                               <tr key={i} className="hover:bg-violet-50/50">
                                   <td className="p-3 font-bold text-slate-950 max-w-[150px] truncate" title={item.name}>{item.name}</td>
                                   <td className="p-3 text-right">{item.stock}</td>
                                   <td className="p-3 text-right font-mono text-xs">
                                       {item.daysSupply > 365 ? '>1y' : item.daysSupply.toFixed(1) + 'd'}
                                   </td>
                                   <td className="p-3">
                                       <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold
                                           ${item.riskLevel.includes('High') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}
                                       `}>
                                           {item.riskLevel === 'Very High' ? t('risk_very_high') : 
                                            item.riskLevel === 'High' ? t('risk_high') : 
                                            item.riskLevel === 'Low' ? t('risk_low') : item.riskLevel}
                                       </span>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
          </div>

          {/* Right: PO Planner */}
           <div className="bg-white/90 border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-xl shadow-slate-900/5">
               <div className="p-4 border-b border-slate-100">
                   <h3 className="font-black text-slate-950 flex items-center gap-2">
                       <ShoppingCart className="w-4 h-4 text-orange-400" /> {t('automated_po_planner')}
                   </h3>
                   <p className="text-xs text-slate-500 mt-1">{t('avg_demand_desc')}</p>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
                   {loading ? <div className="text-center text-slate-500">{t('loading')}</div> :
                    reorderNeeded.length === 0 ? <div className="text-center text-green-500 py-10">{t('no_urgent_orders')}</div> :
                    reorderNeeded.map((item, i) => (
                       <div key={i} className="bg-orange-50/70 border border-orange-100 p-4 rounded-xl flex justify-between items-center group hover:border-orange-300 transition-colors">
                           <div>
                               <div className="font-bold text-slate-950 max-w-[200px] truncate" title={item.name}>{item.name}</div>
                               <div className="text-xs text-slate-400">
                                   {t('label_stock')}: {item.stock} | {t('ai_insight')}: {item.avgDemand.toFixed(1)}/mo
                               </div>
                           </div>
                           <div className="text-right">
                               <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t('ai_suggested_add')}</div>
                               <div className="text-xl font-bold text-orange-400">+{item.suggestedQty}</div>
                           </div>
                       </div>
                   ))}
               </div>
               <div className="p-4 border-t border-slate-100 bg-slate-50">
                   <button 
                       onClick={() => {
                           if (reorderNeeded.length === 0) return alert(t('no_urgent_orders'));
                           const items = reorderNeeded.map(i => `- ${i.name}: ${i.suggestedQty} units`).join('\n');
                           alert(`✅ ${t('ai_po_success')}:\n\n${items}`);
                       }}
                       className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold flex justify-center items-center gap-2 transition-transform active:scale-95"
                   >
                       {t('create_po_draft')} <ArrowRight className="w-4 h-4" />
                   </button>
               </div>
           </div>

      </div>
    </div>
  );
}
