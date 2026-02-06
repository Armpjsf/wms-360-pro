'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, ShoppingCart, ArrowRight } from 'lucide-react';

export default function ForecastPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">Demand Forecast & Risk Analysis</h1>
            <p className="text-slate-400">ระบบพยากรณ์และวิเคราะห์ความเสี่ยง (Advanced Logic)</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-red-500/30 p-6 rounded-xl flex items-center justify-between">
               <div>
                   <div className="text-slate-400 text-sm mb-1">High Risk Items</div>
                   <div className="text-3xl font-bold text-red-500">{highRisk.length}</div>
                   <div className="text-xs text-red-400 mt-2">Stock {"<"} 15-30 Days</div>
               </div>
               <AlertTriangle className="w-10 h-10 text-red-500/50" />
          </div>
          <div className="bg-slate-900 border border-orange-500/30 p-6 rounded-xl flex items-center justify-between">
               <div>
                   <div className="text-slate-400 text-sm mb-1">Reorder Suggestions</div>
                   <div className="text-3xl font-bold text-orange-400">{reorderNeeded.length}</div>
                   <div className="text-xs text-orange-400 mt-2">Action Required</div>
               </div>
               <ShoppingCart className="w-10 h-10 text-orange-400/50" />
          </div>
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center justify-between">
               <div>
                   <div className="text-slate-400 text-sm mb-1">Total Forecasted</div>
                   <div className="text-3xl font-bold text-blue-400">{data.length}</div>
                   <div className="text-xs text-blue-400 mt-2">Products Analyzed</div>
               </div>
               <TrendingUp className="w-10 h-10 text-blue-400/50" />
          </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left: Risk Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
               <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                   <h3 className="font-bold text-white flex items-center gap-2">
                       <AlertTriangle className="w-4 h-4 text-red-400" /> Stock Risk Monitor
                   </h3>
               </div>
               <div className="max-h-[500px] overflow-y-auto">
                   <table className="w-full text-left text-slate-300 text-sm">
                       <thead className="bg-slate-950 text-slate-500 sticky top-0">
                           <tr>
                               <th className="p-3">Product</th>
                               <th className="p-3 text-right">Stock</th>
                               <th className="p-3 text-right">Days Supply</th>
                               <th className="p-3">Risk</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-800">
                           {loading ? <tr><td colSpan={4} className="p-4 text-center">Analzying...</td></tr> : 
                            data.slice(0, 50).map((item, i) => (
                               <tr key={i} className="hover:bg-slate-800/50">
                                   <td className="p-3 font-medium text-white max-w-[150px] truncate" title={item.name}>{item.name}</td>
                                   <td className="p-3 text-right">{item.stock}</td>
                                   <td className="p-3 text-right font-mono text-xs">
                                       {item.daysSupply > 365 ? '>1y' : item.daysSupply.toFixed(1) + 'd'}
                                   </td>
                                   <td className="p-3">
                                       <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold
                                           ${item.riskLevel.includes('High') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}
                                       `}>
                                           {item.riskLevel}
                                       </span>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
          </div>

          {/* Right: PO Planner */}
           <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
               <div className="p-4 border-b border-slate-800">
                   <h3 className="font-bold text-white flex items-center gap-2">
                       <ShoppingCart className="w-4 h-4 text-orange-400" /> Automated PO Planner
                   </h3>
                   <p className="text-xs text-slate-500 mt-1">Recommended orders based on 3-month avg demand</p>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
                   {loading ? <div className="text-center text-slate-500">Calculating EOQ...</div> :
                    reorderNeeded.length === 0 ? <div className="text-center text-green-500 py-10">No urgent orders needed.</div> :
                    reorderNeeded.map((item, i) => (
                       <div key={i} className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg flex justify-between items-center group hover:border-orange-500 transition-colors">
                           <div>
                               <div className="font-bold text-white max-w-[200px] truncate" title={item.name}>{item.name}</div>
                               <div className="text-xs text-slate-400">
                                   Stock: {item.stock} | Demand: {item.avgDemand.toFixed(1)}/mo
                               </div>
                           </div>
                           <div className="text-right">
                               <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Suggest</div>
                               <div className="text-xl font-bold text-orange-400">+{item.suggestedQty}</div>
                           </div>
                       </div>
                   ))}
               </div>
               <div className="p-4 border-t border-slate-800 bg-slate-950">
                   <button 
                       onClick={() => {
                           if (reorderNeeded.length === 0) return alert("No items need reordering.");
                           const items = reorderNeeded.map(i => `- ${i.name}: ${i.suggestedQty} units`).join('\n');
                           alert(`✅ สร้างใบสั่งซื้อ (Mockup) สำหรับ ${reorderNeeded.length} รายการ:\n\n${items}\n\n(ระบบ PO จริงจะเชื่อมต่อในเฟสถัดไป)`);
                       }}
                       className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold flex justify-center items-center gap-2 transition-transform active:scale-95"
                   >
                       Create PO Draft <ArrowRight className="w-4 h-4" />
                   </button>
               </div>
           </div>

      </div>
    </div>
  );
}
