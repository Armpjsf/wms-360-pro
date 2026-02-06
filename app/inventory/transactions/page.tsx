'use client';

import { useState, useEffect } from 'react';
import { Download, Search, ArrowDownLeft, ArrowUpRight, History, AlertTriangle } from 'lucide-react';

import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface Log {
  date: string;
  product: string;
  location: string;
  qty: number;
  reason?: string;
  status?: string; // For Damage
}

export default function TransactionsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'IN' | 'OUT' | 'DAMAGE'>('IN');
  const [data, setData] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs(activeTab);
  }, [activeTab]);

  async function fetchLogs(type: 'IN' | 'OUT' | 'DAMAGE') {
    setLoading(true);
    try {
        const res = await fetch(`/api/logs/transaction?type=${type}`);
        const json = await res.json();
        if (Array.isArray(json)) setData(json);
        else setData([]);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  }

  // Helper: Normalize for flexible search (remove special chars, lower case)
  const normalize = (val: string) => val ? val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';

  // Filter Logic: Includes Location Search with Normalization
  const filtered = data.filter(item => {
      const term = normalize(search);
      // If search has spaces, usually splitting by space is good, but for ID flexibility we focus on stripping.
      if (!term) return true;

      const matchProduct = normalize(item.product).includes(term);
      const matchDate = normalize(item.date).includes(term);
      const matchLocation = normalize(item.location).includes(term);
      
      return matchProduct || matchDate || matchLocation;
  });

  const exportCSV = () => {
    const BOM = "\uFEFF";
    const headers = ['Date,Product,Location,Quantity,Type,Status'];
    const rows = filtered.map(item => 
        `"${item.date}","${item.product}","${item.location}",${item.qty},"${activeTab}","${item.status || '-'}"`
    );
    const csvContent = BOM + headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transaction_${activeTab.toLowerCase()}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative min-h-screen p-8 max-w-[1600px] mx-auto space-y-6">
      <AmbientBackground />
      <div className="relative z-10">
      <header className="flex flex-col md:flex-row justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
              <History className="w-8 h-8 text-purple-600" />
              {t('logs_title')}
           </h1>
           <p className="text-slate-400">{t('logs_subtitle')}</p>
        </div>
        
        <div className="flex bg-white border border-slate-200 p-1 rounded-lg w-fit overflow-x-auto shadow-sm">
            <button
                onClick={() => setActiveTab('IN')}
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'IN' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'
                }`}
            >
                <ArrowDownLeft className="w-4 h-4" /> {t('tab_inbound')}
            </button>
            <button
                onClick={() => setActiveTab('OUT')}
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'OUT' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'
                }`}
            >
                <ArrowUpRight className="w-4 h-4" /> {t('tab_outbound')}
            </button>
            <button
                onClick={() => setActiveTab('DAMAGE')}
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'DAMAGE' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'
                }`}
            >
                <AlertTriangle className="w-4 h-4" /> {t('tab_damage')}
            </button>
        </div>
      </header>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div className="relative flex-1 max-w-md">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
             <input 
                type="text" 
                placeholder={t('search_logs_placeholder')} 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:border-purple-500 outline-none"
             />
         </div>
         <button 
                onClick={exportCSV}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-2 transition-colors border border-slate-200 font-bold"
            >
                <Download className="w-4 h-4" /> {t('export_current_view')}
         </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                      <th className="p-4">{t('date')}</th>
                      <th className="p-4">{t('col_product_name')}</th>
                      <th className="p-4">Location</th>
                      <th className="p-4 text-right">{t('qty')}</th>
                      <th className="p-4">{t('col_type')}</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {loading ? (
                      <tr><td colSpan={5} className="p-8 text-center">{t('processing')}</td></tr>
                  ) : filtered.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center">{t('no_logs')}</td></tr>
                  ) : (
                      filtered.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-mono text-slate-500">{item.date}</td>
                              <td className="p-4 font-medium text-slate-900">{item.product}</td>
                              <td className="p-4 text-slate-400">
                                  {item.location || '-'}
                              </td>
                              <td className={`p-4 text-right font-bold text-lg ${
                                  activeTab === 'IN' ? 'text-emerald-600' : 
                                  activeTab === 'OUT' ? 'text-rose-600' : 'text-amber-600'
                              }`}>
                                  {activeTab === 'IN' ? '+' : '-'}{item.qty.toLocaleString()}
                              </td>
                              <td className="p-4">
                                  <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                                      activeTab === 'IN' ? 'bg-emerald-100 text-emerald-600' : 
                                      activeTab === 'OUT' ? 'bg-rose-100 text-rose-600' : 
                                      'bg-amber-100 text-amber-600'
                                  }`}>
                                      {(activeTab === 'IN' || activeTab === 'OUT') && t(`legend_${activeTab.toLowerCase()}` as any) || t('tab_damage')}
                                  </span>
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
