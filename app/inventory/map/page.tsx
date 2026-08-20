'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  LayoutGrid,
  MapPin,
  Search,
  RefreshCw,
  Box,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  Flame,
  Activity,
  Printer,
  ChevronRight,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import { toast } from 'react-hot-toast';
import {
  buildWarehouseMap,
  WarehouseZone,
  WarehouseBin,
  WarehouseRack,
  WarehouseMapStats,
} from '@/lib/warehouseMap';

export default function WarehouseMapPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View Controls
  const [selectedZoneId, setSelectedZoneId] = useState<string>('A');
  const [heatmapMode, setHeatmapMode] = useState<'STOCK' | 'VELOCITY'>('STOCK');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBin, setSelectedBin] = useState<WarehouseBin | null>(null);

  // Fetch Products and Transactions
  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, transRes] = await Promise.all([
        fetch(getApiUrl('/api/products')),
        fetch(getApiUrl('/api/transactions?limit=200')),
      ]);

      const prodData = await prodRes.json();
      const transData = await transRes.json();

      if (Array.isArray(prodData)) setProducts(prodData);
      if (transData?.transactions && Array.isArray(transData.transactions)) {
        setTransactions(transData.transactions);
      }
    } catch (e) {
      console.error('Failed to load map data:', e);
      toast.error('ไม่สามารถโหลดข้อมูลผังคลังได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Warehouse Map Data
  const { zones, unassignedProducts, stats } = useMemo(() => {
    return buildWarehouseMap(products, transactions);
  }, [products, transactions]);

  // Set default zone if available
  useEffect(() => {
    if (zones.length > 0 && !zones.some(z => z.zoneId === selectedZoneId)) {
      setSelectedZoneId(zones[0].zoneId);
    }
  }, [zones, selectedZoneId]);

  const activeZone = useMemo(() => {
    return zones.find(z => z.zoneId === selectedZoneId) || zones[0];
  }, [zones, selectedZoneId]);

  // Highlight matches from Search
  const matchingBinCodes = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase().trim();
    const matched = new Set<string>();

    zones.forEach(z => {
      z.aisles.forEach(a => {
        a.racks.forEach(r => {
          r.bins.forEach(b => {
            if (
              b.binCode.toLowerCase().includes(q) ||
              b.products.some(
                p =>
                  p.name.toLowerCase().includes(q) ||
                  p.id.toLowerCase().includes(q) ||
                  p.category.toLowerCase().includes(q)
              )
            ) {
              matched.add(b.binCode);
            }
          });
        });
      });
    });

    return matched;
  }, [zones, searchQuery]);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8 bg-slate-50">
      <AmbientBackground />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-[1.75rem] border border-teal-200 bg-white/90 p-6 shadow-xl shadow-teal-900/5 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/inventory"
                className="p-3 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-200 text-teal-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5">
                  <LayoutGrid className="w-8 h-8 text-teal-600" />
                  2D Warehouse Interactive Map
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  ผังคลังสินค้าจำลองเสมือนจริง • แผนผังชั้นวาง (Zone & Rack Heatmap) • พิกัดจัดเก็บ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl shadow-sm transition-colors"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-teal-50 text-teal-700 rounded-xl">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">พื้นที่ทั้งหมด</div>
              <div className="text-lg font-black text-slate-800">
                {stats.totalZones} โซน • {stats.totalBins} ช่อง
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">อัตราการใช้งาน (Occupancy)</div>
              <div className="text-lg font-black text-emerald-600">{stats.occupancyRate}%</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">สต็อกเหลือน้อย</div>
              <div className="text-lg font-black text-amber-600">{stats.lowStockBins} ช่อง</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">ยังไม่กำหนดพิกัด</div>
              <div className="text-lg font-black text-rose-600">{stats.unassignedProductsCount} รายการ</div>
            </div>
          </div>
        </div>

        {/* Control Bar: Search & Heatmap Switcher */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Zone Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {zones.map(z => (
              <button
                key={z.zoneId}
                onClick={() => setSelectedZoneId(z.zoneId)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0',
                  selectedZoneId === z.zoneId
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                )}
              >
                <MapPin className="w-3.5 h-3.5" />
                {z.name}
              </button>
            ))}
          </div>

          {/* Search & Heatmap Controls */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหา SKU หรือชื่อสินค้าเพื่อชี้เป้า..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Heatmap Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 flex-shrink-0 text-xs font-bold">
              <button
                onClick={() => setHeatmapMode('STOCK')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1',
                  heatmapMode === 'STOCK'
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                ระดับสต็อก
              </button>
              <button
                onClick={() => setHeatmapMode('VELOCITY')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1',
                  heatmapMode === 'VELOCITY'
                    ? 'bg-white text-violet-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                ABC หมุนเวียน
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-slate-700">สัญลักษณ์สี:</span>
            {heatmapMode === 'STOCK' ? (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> สต็อกปกติ (Normal)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-400 inline-block" /> สต็อกต่ำ (Low Stock)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-500 inline-block" /> สต็อกหมด (Empty)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300 inline-block" /> ช่องว่างพร้อมเก็บ
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-purple-600 inline-block" /> Class A (หมุนเร็วมาก Top 20%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Class B (หมุนปานกลาง)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-400 inline-block" /> Class C (หมุนช้า)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300 inline-block" /> Class D (Deadstock / ว่าง)
                </span>
              </>
            )}
          </div>
          {matchingBinCodes.size > 0 && (
            <span className="text-amber-600 font-bold">
              พบ {matchingBinCodes.size} พิกัดที่ตรงกับคำค้นหา
            </span>
          )}
        </div>

        {/* 2D Interactive Warehouse Floor Layout */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 space-y-8 relative overflow-hidden">
          {/* Subtle Grid Background Pattern */}
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="flex items-center justify-between border-b border-slate-800 pb-4 relative z-10">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-400" />
                {activeZone?.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                คลิกที่ชั้นวาง (Rack / Bin) เพื่อดูสต็อกสินค้าและรายละเอียดภายในช่อง
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">จำนวนสต็อกในโซนนี้:</span>
              <div className="text-lg font-black text-teal-400">
                {activeZone?.totalStock.toLocaleString()} ชิ้น
              </div>
            </div>
          </div>

          {/* Aisles Layout */}
          <div className="space-y-10 relative z-10">
            {activeZone?.aisles.map(aisle => (
              <div key={aisle.aisleNumber} className="space-y-3">
                {/* Aisle Corridor Header */}
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-teal-300 text-xs font-mono font-bold rounded-lg shadow-sm">
                    ทางเดินซอย (Aisle {aisle.aisleNumber})
                  </span>
                  <div className="h-px bg-slate-800 flex-1" />
                  <span className="text-[11px] text-slate-500 font-mono">
                    {aisle.racks.length} แร็ค • สต็อกรวม {aisle.totalStock.toLocaleString()}
                  </span>
                </div>

                {/* Racks Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {aisle.racks.map(rack => {
                    const primaryBin = rack.bins[0];
                    const isMatched = matchingBinCodes.has(primaryBin?.binCode || '');

                    // Color Determination
                    let colorClass = 'bg-slate-800 border-slate-700 text-slate-300';

                    if (heatmapMode === 'STOCK') {
                      if (rack.status === 'NORMAL')
                        colorClass = 'bg-emerald-950/70 border-emerald-500 text-emerald-200 hover:bg-emerald-900/80';
                      else if (rack.status === 'LOW_STOCK')
                        colorClass = 'bg-amber-950/70 border-amber-400 text-amber-200 hover:bg-amber-900/80';
                      else if (rack.status === 'EMPTY_CRITICAL')
                        colorClass = 'bg-rose-950/70 border-rose-500 text-rose-200 hover:bg-rose-900/80';
                      else
                        colorClass = 'bg-slate-800/40 border-slate-700/50 text-slate-500 hover:bg-slate-800';
                    } else {
                      // VELOCITY
                      const v = primaryBin?.dominantVelocityClass || 'D';
                      if (v === 'A') colorClass = 'bg-purple-950/80 border-purple-500 text-purple-200 hover:bg-purple-900';
                      else if (v === 'B') colorClass = 'bg-blue-950/80 border-blue-500 text-blue-200 hover:bg-blue-900';
                      else if (v === 'C') colorClass = 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700';
                      else colorClass = 'bg-slate-800/40 border-slate-700 text-slate-500 hover:bg-slate-800';
                    }

                    return (
                      <motion.button
                        key={rack.rackNumber}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedBin(primaryBin)}
                        className={cn(
                          'p-3 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between min-h-[90px]',
                          colorClass,
                          isMatched &&
                            'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900 border-amber-300 animate-pulse'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-mono font-black text-xs">
                            {primaryBin?.binCode || `R-${rack.rackNumber}`}
                          </span>
                          {rack.status === 'LOW_STOCK' && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          {isMatched && (
                            <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 rounded text-[9px] font-black uppercase">
                              ตรงผลค้นหา
                            </span>
                          )}
                        </div>

                        <div className="mt-2">
                          <div className="text-[10px] text-slate-400 truncate">
                            {primaryBin?.products[0]?.name || (rack.totalStock > 0 ? 'สินค้าในสต็อก' : 'ช่องว่าง')}
                          </div>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-base font-black">
                              {rack.totalStock.toLocaleString()}
                            </span>
                            <span className="text-[10px] opacity-75">
                              {primaryBin?.products.length || 0} SKUs
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drawer / Modal: Bin Product Details */}
        <AnimatePresence>
          {selectedBin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedBin(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto text-slate-800"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-teal-50 text-teal-700 rounded-2xl border border-teal-200">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 font-mono">
                        {selectedBin.binCode}
                      </h3>
                      <p className="text-xs text-slate-400">
                        โซน {selectedBin.zone} • ซอย {selectedBin.aisle} • แร็ค {selectedBin.rack}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBin(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Summary Info */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">สต็อกรวมในช่องนี้:</span>
                    <div className="text-base font-black text-slate-800 mt-0.5">
                      {selectedBin.totalStock.toLocaleString()} ชิ้น
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">การหมุนเวียน (Velocity):</span>
                    <div className="text-base font-black text-purple-700 mt-0.5">
                      Class {selectedBin.dominantVelocityClass}
                    </div>
                  </div>
                </div>

                {/* Products in Bin List */}
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center justify-between">
                    <span>รายการสินค้าในช่อง ({selectedBin.products.length})</span>
                  </h4>

                  {selectedBin.products.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      ช่องนี้ยังว่างอยู่ (ไม่มีสินค้าจัดเก็บ)
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedBin.products.map((prod, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs hover:border-teal-300 transition-colors"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{prod.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              SKU: {prod.id} • หมวด: {prod.category}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={cn(
                                'text-sm font-black',
                                prod.stock <= prod.minStock ? 'text-amber-600' : 'text-slate-800'
                              )}
                            >
                              {prod.stock.toLocaleString()} {prod.unit}
                            </div>
                            {prod.stock <= prod.minStock && (
                              <span className="text-[10px] text-amber-600 font-bold block">
                                ต่ำกว่าเกณฑ์ ({prod.minStock})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  <Link
                    href={`/inventory/print-labels?sku=${encodeURIComponent(
                      selectedBin.binCode
                    )}&name=${encodeURIComponent(`Location ${selectedBin.binCode}`)}&code=${encodeURIComponent(
                      selectedBin.binCode
                    )}`}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-4 h-4" /> พิมพ์สติ๊กเกอร์พิกัด
                  </Link>

                  <button
                    onClick={() => setSelectedBin(null)}
                    className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
