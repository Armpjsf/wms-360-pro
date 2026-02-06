'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle, Download } from 'lucide-react';

export default function AgingPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(90); // Default 3 months
  const [viewMode, setViewMode] = useState<'DEADSTOCK' | 'ALL'>('DEADSTOCK');

  useEffect(() => {
    async function fetchData() {
        try {
            const res = await fetch('/api/analytics/aging');
            const json = await res.json();
            if (Array.isArray(json)) setData(json);
        } catch (error) {
            console.error("Failed to fetch aging", error);
        } finally {
            setLoading(false);
        }
    }
    fetchData();
  }, []);

  // Filter Logic
  const deadstock = data.filter(item => item.daysSinceLastSale > period && item.stock > 0);
  const activeObs = data.filter(item => item.daysSinceLastSale <= period);
  
  const deadstockValue = deadstock.reduce((sum, item) => sum + item.value, 0);

  const tableData = viewMode === 'DEADSTOCK' ? deadstock : data;

  const exportCSV = () => {
    const BOM = "\uFEFF";
    const headers = ['Product Name,Location,Stock,Value (THB),Movement Status,Last Sold,Days Since Sale'];
    const rows = tableData.map(item => 
        `"${item.name.replace(/"/g, '""')}","${item.location || '-'}","${item.stock}","${item.value}","${item.movementStatus || 'Deadstock'}","${item.lastSoldDate || 'Never'}","${item.daysSinceLastSale}"`
    );
    const csvContent = BOM + headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `aging_report_${viewMode.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                 <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Clock className="w-8 h-8 text-amber-400" />
                 </div>
                 Inventory Aging & Deadstock
              </h1>
              <p className="text-slate-400 mt-2">วิเคราะห์สินค้าเคลื่อนไหวช้าและสินค้าค้างสต็อก</p>
           </div>
           
           <div className="bg-slate-900 border border-slate-800 p-1 rounded-lg flex">
               {[30, 60, 90, 180, 365].map((d) => (
                   <button
                      key={d}
                      onClick={() => setPeriod(d)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          period === d 
                          ? 'bg-amber-500 text-white shadow-lg' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                   >
                       {d > 300 ? '1 Year' : `${d} Days`}
                   </button>
               ))}
           </div>
       </div>

       {/* KPIs */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
               <h3 className="text-slate-400 text-sm mb-2">Deadstock Items</h3>
               <div className="text-3xl font-bold text-white flex items-center gap-2">
                   {loading ? '...' : deadstock.length}
                   <span className="text-xs font-normal text-slate-500">list items</span>
               </div>
               <div className="mt-4 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-1 rounded-full w-fit">
                   <AlertCircle className="w-3 h-3" />
                   สินค้าไม่เคลื่อนไหวเกิน {period} วัน
               </div>
           </div>

           <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
               <h3 className="text-slate-400 text-sm mb-2">Deadstock Value</h3>
               <div className="text-3xl font-bold text-white flex items-center gap-2">
                   ฿{loading ? '...' : deadstockValue.toLocaleString()}
                   <span className="text-xs font-normal text-slate-500">THB</span>
               </div>
               <div className="mt-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full w-fit">
                   <Clock className="w-3 h-3" />
                   มูลค่าเงินจมในสต็อก
               </div>
           </div>

           <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
               <h3 className="text-slate-400 text-sm mb-2">Active Items</h3>
               <div className="text-3xl font-bold text-white flex items-center gap-2">
                   {loading ? '...' : activeObs.length}
                   <span className="text-xs font-normal text-slate-500">SKUs</span>
               </div>
               <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full w-fit">
                   <CheckCircle className="w-3 h-3" />
                   เคลื่อนไหวปกติ
               </div>
           </div>
       </div>

       {/* Detailed Table */}
       <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
           <div className="p-6 border-b border-slate-800 flex justify-between items-center">
               <div className="flex items-center gap-4">
                   <h3 className="text-white font-medium">Inventory List</h3>
                   <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                       <button 
                         onClick={() => setViewMode('DEADSTOCK')}
                         className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${viewMode === 'DEADSTOCK' ? 'bg-red-500/20 text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
                       >
                         Deadstock Only
                       </button>
                       <button 
                         onClick={() => setViewMode('ALL')}
                         className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${viewMode === 'ALL' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                       >
                         Show All
                       </button>
                   </div>
               </div>
               <button onClick={exportCSV} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm">
                   <Download className="w-4 h-4" /> Export CSV
               </button>
           </div>
           
           <div className="overflow-x-auto">
               <table className="w-full text-left text-slate-300">
                   <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider">
                       <tr>
                           <th className="px-6 py-4">สินค้า (Product)</th>
                           <th className="px-6 py-4">Location</th>
                           <th className="px-6 py-4">คงเหลือ (Stock)</th>
                           <th className="px-6 py-4">มูลค่า (Value)</th>
                           <th className="px-6 py-4 text-center">Movement</th>
                           <th className="px-6 py-4">ขายล่าสุด (Last Sold)</th>
                           <th className="px-6 py-4">จำนวนวัน (Days)</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800">
                       {loading ? (
                           <tr><td colSpan={7} className="p-8 text-center text-slate-500">Calculating aging...</td></tr>
                       ) : tableData.length === 0 ? (
                           <tr><td colSpan={7} className="p-8 text-center text-slate-500">No data found.</td></tr>
                       ) : (
                           tableData.map((item) => (
                               <tr key={item.id} className="hover:bg-slate-800/50">
                                   <td className="px-6 py-4 font-medium text-white">{item.name}</td>
                                   <td className="px-6 py-4 font-mono text-indigo-400">{item.location || '-'}</td>
                                   <td className="px-6 py-4">{item.stock.toLocaleString()}</td>
                                   <td className="px-6 py-4">฿{item.value.toLocaleString()}</td>
                                   <td className="px-6 py-4 text-center">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${
                                            (item.movementStatus || 'Deadstock') === 'Fast Moving' ? 'bg-emerald-500/20 text-emerald-400' :
                                            (item.movementStatus || 'Deadstock') === 'Normal Moving' ? 'bg-blue-500/20 text-blue-400' :
                                            (item.movementStatus || 'Deadstock') === 'Slow Moving' ? 'bg-amber-500/20 text-amber-400' :
                                            (item.movementStatus || 'Deadstock') === 'Very Slow Moving' ? 'bg-orange-500/20 text-orange-400' :
                                            'bg-rose-500/20 text-rose-400'
                                        }`}>
                                            {item.movementStatus || 'Deadstock'}
                                        </span>
                                   </td>
                                   <td className="px-6 py-4 text-slate-400">
                                       {item.lastSoldDate || 'Never'}
                                   </td>
                                   <td className="px-6 py-4 text-red-400 font-bold">
                                       {item.daysSinceLastSale > 9000 ? 'Never' : `${item.daysSinceLastSale} days`}
                                   </td>
                               </tr>
                           ))
                       )}
                   </tbody>
               </table>
           </div>
       </div>
    </div>
  );
  }
