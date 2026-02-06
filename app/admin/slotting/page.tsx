'use client';

import { useState, useEffect } from 'react';
import { 
  LayoutGrid, 
  MoveRight, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Box, 
  Zap,
  Warehouse
} from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface SlottingInsight {
    productId: string;
    productName: string;
    currentLocation: string;
    velocityScore: number;
    class: 'A' | 'B' | 'C' | 'D';
    idealZone: string;
    action: 'MOVE_FORWARD' | 'MOVE_BACK' | 'KEEP';
    reason: string;
}

export default function SlottingPage() {
  const { t } = useLanguage(); // Ensure this key exists or fallback
  const [data, setData] = useState<{
      classDistribution: any;
      recommendations: SlottingInsight[];
      all: SlottingInsight[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
     fetch('/api/ai/slotting')
        .then(res => res.json())
        .then(setData)
        .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
       {/* Header */}
       <header>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
             <div className="p-2 bg-indigo-500/10 rounded-lg">
                <LayoutGrid className="w-8 h-8 text-indigo-600" />
             </div>
             Smart Slotting (ABC Analysis)
          </h1>
          <p className="text-slate-500 mt-2">Optimize your warehouse layout based on product velocity.</p>
       </header>

       {/* ABC Distribution Cards */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <DistributionCard 
              label="Class A (Fast Movers)" 
              count={data?.classDistribution?.A} 
              desc="Top 20% - Keep near shipping"
              color="emerald"
              icon={Zap}
           />
           <DistributionCard 
              label="Class B (Medium)" 
              count={data?.classDistribution?.B} 
              desc="Next 30% - Middle rows"
              color="blue"
              icon={Box}
           />
           <DistributionCard 
              label="Class C (Slow)" 
              count={data?.classDistribution?.C} 
              desc="Bottom 50% - Back rows"
              color="amber"
              icon={Warehouse}
           />
            <DistributionCard 
              label="Class D (Deadstock)" 
              count={data?.classDistribution?.D} 
              desc="No movement - Consider liquidating"
              color="slate"
              icon={Box}
           />
       </div>

       {/* Recommendations */}
       {data?.recommendations && data.recommendations.length > 0 && (
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-100 bg-slate-50">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2">
                       <MoveRight className="w-5 h-5 text-indigo-600" />
                       Optimization Recommendations
                   </h3>
               </div>
               <div className="divide-y divide-slate-100">
                   {data.recommendations.map((item, idx) => (
                       <div key={idx} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                            <div className={`p-3 rounded-full ${item.action === 'MOVE_FORWARD' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                                {item.action === 'MOVE_FORWARD' ? (
                                    <ArrowUpCircle className="w-6 h-6 text-emerald-600" />
                                ) : (
                                    <ArrowDownCircle className="w-6 h-6 text-amber-600" />
                                )}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-900">{item.productName}</h4>
                                <p className="text-sm text-slate-500">
                                    Current: <span className="font-mono text-slate-700">{item.currentLocation}</span> 
                                    {' '} → {' '}
                                    Ideal: <span className="font-mono text-indigo-600 font-bold">{item.idealZone}</span>
                                </p>
                                <p className="text-xs text-slate-400 mt-1">{item.reason}</p>
                            </div>
                            <div className="text-right">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    item.class === 'A' ? 'bg-emerald-100 text-emerald-700' : 
                                    item.class === 'D' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                    Class {item.class}
                                </span>
                            </div>
                       </div>
                   ))}
               </div>
           </div>
       )}

       {/* Full List (Optional, or just top items) */}
       <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-4">Velocity Analysis</h3>
           {loading ? (
               <div className="text-center py-10 text-slate-400">Analyzing thousands of transactions...</div>
           ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-xs uppercase text-slate-400 font-bold border-b border-slate-100">
                            <tr>
                                <th className="pb-3 pl-4">Product</th>
                                <th className="pb-3">Class</th>
                                <th className="pb-3">Velocity (Qty)</th>
                                <th className="pb-3">Zone</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-50">
                            {data?.all.slice(0, 20).map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                    <td className="py-3 pl-4 font-medium text-slate-700">{row.productName}</td>
                                    <td className="py-3">
                                        <span className={`font-bold ${
                                            row.class === 'A' ? 'text-emerald-600' :
                                            row.class === 'B' ? 'text-blue-600' :
                                            row.class === 'C' ? 'text-amber-600' : 'text-slate-400'
                                        }`}>
                                            {row.class}
                                        </span>
                                    </td>
                                    <td className="py-3 text-slate-500">{row.velocityScore.toLocaleString()}</td>
                                    <td className="py-3 font-mono text-slate-500">{row.currentLocation}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="text-xs text-center text-slate-400 mt-4">Showing top 20 items by velocity</p>
                </div>
           )}
       </div>
    </div>
  );
}

function DistributionCard({ label, count = 0, desc, color, icon: Icon }: any) {
    const colors = {
        emerald: 'bg-emerald-50 text-emerald-600',
        blue: 'bg-blue-50 text-blue-600',
        amber: 'bg-amber-50 text-amber-600',
        slate: 'bg-slate-50 text-slate-600'
    } as any;

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${colors[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <span className="text-3xl font-black text-slate-900">{count}</span>
            </div>
            <div>
                <h4 className="font-bold text-slate-700">{label}</h4>
                <p className="text-xs text-slate-500 mt-1">{desc}</p>
            </div>
        </div>
    );
}
