'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Calendar, ArrowDownLeft, ArrowUpRight, ClipboardList, Printer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

export default function SummaryPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    async function fetchData() {
        setLoading(true);
        try {
            const query = new URLSearchParams({ granularity });
            if (startDate) query.append('startDate', startDate);
            if (endDate) query.append('endDate', endDate);

            const res = await fetch(`/api/analytics/summary?${query.toString()}`);
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error("Failed to fetch summary", error);
        } finally {
            setLoading(false);
        }
    }
    fetchData();
  }, [granularity, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative min-h-screen p-6 max-w-7xl mx-auto space-y-8">
       <AmbientBackground />
       <div className="relative z-10">
       <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                 <div className="p-2 bg-emerald-100 rounded-lg">
                    <BarChart3 className="w-8 h-8 text-emerald-600" />
                 </div>
                 Transaction Summary
              </h1>
              <p className="text-slate-500 mt-2">สรุปภาพรวมการรับ-จ่ายสินค้า (Legacy: สรุป รับ-จ่าย)</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
              {/* Date Filter */}
              <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200">
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-slate-600 text-sm px-2 py-1 focus:outline-none" 
                  />
                  <span className="text-slate-600">-</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-slate-600 text-sm px-2 py-1 focus:outline-none"
                  />
              </div>

              {/* Granularity Toggle */}
              <div className="bg-white p-1 rounded-lg flex border border-slate-200">
                  <button 
                     onClick={() => setGranularity('day')}
                     className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${granularity === 'day' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                      Daily
                  </button>
                  <button 
                     onClick={() => setGranularity('month')}
                     className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${granularity === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                      Monthly
                  </button>
              </div>
              
              <button
                onClick={handlePrint}
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg flex items-center gap-2 transition-colors print:hidden"
              >
                <Printer className="w-5 h-5" />
                <span className="hidden md:inline text-sm font-bold">Print</span>
              </button>
          </div>
       </header>

       <style jsx global>{`
          @media print {
            /* Hide Sidebar, Header, etc provided by Layout */
            nav, aside, .fixed, .sticky {
              display: none !important;
            }
            /* Hide Buttons */
            button, .no-print {
              display: none !important;
            }
            /* Reset Colors for Paper */
            body, .bg-slate-900, .bg-slate-950 {
              background-color: white !important;
              color: black !important;
            }
            /* Fix Grid Layout for Print */
            .grid {
              display: block !important;
            }
            .grid > * {
              margin-bottom: 2rem;
              page-break-inside: avoid;
            }
            /* Chart backgrounds */
            .bg-slate-900 {
              border: 1px solid #ccc !important;
              background: white !important;
            }
            /* Text Colors */
            .text-white, .text-slate-300, .text-slate-400 {
              color: black !important;
            }
            /* Adjust Chart Size */
            .recharts-responsive-container {
               height: 300px !important;
            }
          }
       `}</style>

       {/* Comparison Chart */}
       <div className="bg-white border border-slate-200 p-6 rounded-xl h-[450px] shadow-sm">
           <h3 className="text-slate-800 font-bold mb-6">Inbound vs Outbound ({granularity})</h3>
           {loading || !data ? (
               <div className="h-full flex items-center justify-center text-slate-500">Loading Chart...</div>
           ) : (
               <ResponsiveContainer width="100%" height="85%">
                   <BarChart data={data.chartData}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                       <XAxis dataKey="name" stroke="#94a3b8" />
                       <YAxis stroke="#94a3b8" />
                       <Tooltip 
                           contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                           itemStyle={{ color: '#e2e8f0' }}
                       />
                       <Legend />
                       <Bar dataKey="in" name="รับเข้า (In)" fill="#10b981" radius={[4, 4, 0, 0]} />
                       <Bar dataKey="out" name="จ่ายออก (Out)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                   </BarChart>
               </ResponsiveContainer>
           )}
       </div>

       {/* Weekday Analysis (Legacy Parity) */}
       <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
           <h3 className="text-slate-800 font-bold mb-6 flex items-center gap-2">
               <Calendar className="w-5 h-5 text-indigo-500" />
               Weekday Analysis (พฤติกรรมการจ่ายออกรายวัน)
           </h3>
           <div className="h-[300px]">
               {loading || !data ? (
                   <div className="h-full flex items-center justify-center text-slate-500">Loading Analysis...</div>
               ) : (
                   <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.weekdayAnalysis} layout="vertical">
                             <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} opacity={0.5} />
                             <XAxis type="number" stroke="#94a3b8" />
                             <YAxis dataKey="day" type="category" stroke="#94a3b8" width={100} />
                             <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                                itemStyle={{ color: '#e2e8f0' }}
                             />
                             <Bar dataKey="qty" name="ยอดจ่ายรวม" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                   </ResponsiveContainer>
               )}
           </div>
           <p className="text-xs text-slate-500 mt-4 text-center">
               กราฟแสดงปริมาณงานจ่ายสินค้าแยกตามวันในสัปดาห์ ช่วยในการวางแผนกำลังคน (Workforce Planning)
           </p>
       </div>
       {/* Transaction Table */}
       <div className="bg-white border border-slate-200 rounded-xl overflow-hidden col-span-1 md:col-span-2 shadow-sm">
           <div className="p-6 border-b border-slate-200">
               <h3 className="text-slate-800 font-bold flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-slate-500" />
                  Recent Transactions Logger (100 รายการล่าสุด)
               </h3>
           </div>
           <div className="overflow-x-auto">
               <table className="w-full text-left text-sm text-slate-600">
                   <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                       <tr>
                           <th className="px-6 py-4">Date</th>
                           <th className="px-6 py-4">Type</th>
                           <th className="px-6 py-4">Product</th>
                           <th className="px-6 py-4 text-right">Qty</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                       {loading || !data?.recentTransactions ? (
                           <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading details...</td></tr>
                       ) : data.recentTransactions.map((t: any, i: number) => (
                           <tr key={i} className="hover:bg-slate-50 transition-colors">
                               <td className="px-6 py-4 font-mono text-xs">{t.date ? new Date(t.date).toLocaleDateString('th-TH') : '-'}</td>
                               <td className="px-6 py-4">
                                   <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                       t.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                   }`}>
                                       {t.type === 'IN' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                       {t.type}
                                   </span>
                               </td>
                               <td className="px-6 py-4 font-medium text-slate-800">{t.product}</td>
                               <td className="px-6 py-4 text-right font-mono text-slate-800">{t.qty}</td>
                           </tr>
                       ))}
                   </tbody>
               </table>
           </div>
       </div>
       </div>
    </div>
  );
}
