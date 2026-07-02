'use client';

import { getApiUrl } from '@/lib/config';
import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, MapPin, Package, Wifi, WifiOff } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import MobileNav from '@/components/MobileNav';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface Product {
  name: string;
  category?: string;
  stock?: number;
  location?: string;
  image?: string;
  unit?: string;
}

export default function MobileInventoryPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  const fetchProducts = async () => {
    try {
      const res = await fetch(getApiUrl('/api/products'), { cache: 'no-store' });
      if (res.ok) setIsConnected(true);
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch (e) {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q)
    );
  }, [products, query]);

  return (
    <div className="relative min-h-screen pb-24 bg-slate-50/50">
      <AmbientBackground />
      <div className="relative z-10 max-w-lg mx-auto p-4 md:p-6">

        {/* Header */}
        <div className="mb-4 bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-white/50 shadow-sm sticky top-2 z-20">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('menu_inventory')}</h1>
              <div className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold border mt-1 ${isConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? t('online') : t('offline')}
              </div>
            </div>
            <button onClick={fetchProducts} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-500 shadow-sm active:scale-95">
              <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาสินค้า / ตำแหน่ง..."
              className="w-full h-12 pl-12 pr-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-indigo-400 focus:bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">กำลังโหลด...</div>
        ) : (
          <>
            <div className="text-xs text-slate-400 font-bold px-2 mb-3">{filtered.length} รายการ</div>
            <div className="space-y-2">
              {filtered.map((p, idx) => {
                const low = typeof p.stock === 'number' && p.stock <= 0;
                return (
                  <div key={p.name + idx} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center gap-3">
                    {p.image ? (
                      <img src={`/api/proxy/image?url=${encodeURIComponent(p.image)}`} alt="" className="w-12 h-12 rounded-xl bg-slate-100 object-cover border border-slate-100 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-900 font-bold text-sm truncate">{p.name}</div>
                      <div className="text-[11px] text-orange-600 font-bold flex items-center gap-1 mt-0.5 w-fit bg-orange-50 px-1.5 py-0.5 rounded-lg border border-orange-100">
                        <MapPin className="w-3 h-3" /> {p.location || '-'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-black text-xl leading-none ${low ? 'text-red-500' : 'text-slate-900'}`}>{p.stock ?? '-'}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{p.unit || t('stock_label') || 'คงเหลือ'}</div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center py-16 text-slate-400 text-sm">ไม่พบสินค้า</div>
              )}
            </div>
          </>
        )}

      </div>
      <div className="fixed bottom-0 left-0 right-0 z-50"><MobileNav /></div>
    </div>
  );
}
