'use client';

import { useState, useEffect } from 'react';
import { ProductModal } from '@/components/ProductModal';
import { Search, Plus, Filter, Download, MoreHorizontal, Moon, Sun, LayoutGrid, List, ArrowUpDown, RefreshCcw, X, ChevronLeft, ChevronRight, SlidersHorizontal, Package, Tag, MapPin, AlertCircle, ArrowRight, TrendingUp, History, Info, XCircle, Printer, Pencil, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import { useNotification } from '@/components/providers/GlobalNotificationProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function InventoryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
       <InventoryContent />
    </Suspense>
  );
}

function InventoryContent() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status')?.toUpperCase() || 'ALL';
  const [filterStatus, setFilterStatus] = useState(initialStatus); // ALL, LOW, OK
  const [filterMovement, setFilterMovement] = useState('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  // CRUD State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const openAddModal = () => {
      setEditingProduct(null);
      setIsModalOpen(true);
  };

  const openEditModal = (p: any, e: React.MouseEvent) => {
      e.preventDefault(); 
      e.stopPropagation();
      setEditingProduct(p);
      setIsModalOpen(true);
  };
  
  const { sendNotification } = useNotification();

  // Sync URL Params to State (Always) with Fallback
  useEffect(() => {
     let s = searchParams.get('status');
     let m = searchParams.get('movement');
     let q = searchParams.get('search'); // Capture search query

     // Fallback: Direct window location check (Client-side only)
     if (!s && !q && typeof window !== 'undefined') {
         const urlParams = new URLSearchParams(window.location.search);
         s = urlParams.get('status');
         if (!m) m = urlParams.get('movement');
         if (!q) q = urlParams.get('search');
     }

     // 1. Magic Search: "Low Stock" -> Switch to Filter Mode
     const magicKeywords = ['low stock', 'สินค้าหมด', 'low', 'out of stock'];
     if ((q && magicKeywords.includes(q.toLowerCase())) || (s === 'LOW')) {
         setFilterStatus('LOW');
         setSearch(''); // Clear search so filter works
     } else {
         setFilterStatus(s?.toUpperCase() || 'ALL'); 
         if (q) setSearch(q);
     }
     setFilterMovement(m || 'ALL');
  }, [searchParams]);

  const fetchData = () => {
    setLoading(true);
    const branchId = searchParams.get('branchId'); // Get selected branch
    // Append branchId if exists
    const url = getApiUrl(`/api/products${branchId ? `?branchId=${branchId}` : ''}`);
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);

        // Check for Low Stock and Notify
        const lowStockItems = data.filter((p: any) => p.stock <= p.minStock && p.status !== 'Inactive');
        if (lowStockItems.length > 0) {
            sendNotification(`Warning: Low Stock Detected`, {
                body: `${lowStockItems.length} items are below minimum stock level. Click to view.`,
                tag: 'low-stock-alert' // Prevent spamming
            });
        }
      })
      .catch(err => {
         console.error(err);
         setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to normalize status
  const isInactive = (status: string) => {
      if (!status) return false;
      const s = status.toLowerCase().trim();
      return s === 'inactive' || s === 'discontinued' || s === 'ยกเลิก';
  }

  // Filter Logic
  const filtered = products.filter(p => {
    if (!showInactive && isInactive(p.status)) return false;
    const normalize = (val: string) => val ? val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
    const term = normalize(search);

    const matchSearch = normalize(p.name).includes(term) || 
                        normalize(p.id).includes(term) ||
                        normalize(p.location).includes(term);
    const stockStatus = p.stock <= p.minStock ? 'LOW' : 'OK'; 
    const matchStatus = filterStatus === 'ALL' || (filterStatus === 'LOW' && stockStatus === 'LOW') || (filterStatus === 'OK' && stockStatus === 'OK');
    const matchMovement = filterMovement === 'ALL' || p.movementStatus === filterMovement;
    return matchSearch && matchStatus && matchMovement;
  });

  // Calculate Status dynamically for display
  const getStatus = (p: any) => {
    if (isInactive(p.status)) return { label: 'Inactive', color: 'text-slate-400', bg: 'bg-slate-100', border: 'border-slate-200' };
    if (p.stock <= p.minStock) return { label: 'Low Stock', color: 'text-rose-600', bg: 'bg-rose-100', border: 'border-rose-200' };
    if (p.stock === 0) return { label: 'Out of Stock', color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' };
    return { label: 'In Stock', color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' };
  };

  const exportCSV = () => {
    // Added BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF"; 
    const headers = ['ID,Name,Category,Location,Movement Status,Stock,MinStock,Price,Stock Status,Master Status'];
    const rows = filtered.map(p => 
        `"${p.id}","${p.name.replace(/"/g, '""')}","${p.category}","${p.location || '-'}","${p.movementStatus || 'Unknown'}",${p.stock},${p.minStock},${p.price},"${getStatus(p).label}","${p.status}"`
    );
    const csvContent = BOM + headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory_export.csv');
    document.body.appendChild(link);
    link.click();
  };

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen relative p-8 pb-32">
        <AmbientBackground />
        
        {/* Header */}
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white/50 backdrop-blur-sm p-6 rounded-3xl border border-white/20 shadow-xl shadow-indigo-500/5 max-w-7xl mx-auto"
        >
           <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2 flex items-center gap-3">
                <span className="bg-indigo-600 text-white p-2 rounded-xl">
                    <Package className="w-8 h-8" />
                </span>
                {t('inventory_title')}
              </h1>
              <p className="text-slate-500 font-medium text-lg">{t('inventory_subtitle')}</p>
           </div>
           
           <div className="flex gap-3">
              <button 
                  onClick={openAddModal}
                  className="hidden md:flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-indigo-600/20"
              >
                  <Plus className="w-5 h-5" />
                  {t('add_product')}
              </button>

              <button 
                onClick={fetchData} 
                className={cn("p-3 rounded-xl transition-all hover:scale-105 active:scale-95", loading ? "bg-slate-100 text-slate-400" : "bg-white text-indigo-600 shadow-lg shadow-indigo-500/10 border border-indigo-100")}
              >
                  <RefreshCcw className={cn("w-6 h-6", loading && "animate-spin")} />
              </button>
              
               <button 
                  onClick={exportCSV}
                  className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/20"
               >
                  <Download className="w-5 h-5" />
                  {t('export_csv')}
               </button>
           </div>
        </motion.div>

        {/* Filters */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col md:flex-row gap-4 mb-8 max-w-7xl mx-auto"
        >
           {/* ... filters ... */}
           <div className="flex-1 relative group">
               <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
               <input 
                  type="text" 
                  placeholder={t('search_placeholder')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
               />
           </div>
           
           <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                {/* Mobile Add Button */}
                <button 
                  onClick={openAddModal}
                  className="md:hidden px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold whitespace-nowrap"
                >
                    <Plus className="w-5 h-5 inline mr-1" /> Add
                </button>

                <select 
                    value={filterMovement}
                    onChange={e => setFilterMovement(e.target.value)}
                    className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-medium outline-none focus:border-indigo-500/50 hover:bg-white transition-colors cursor-pointer"
                >
                    <option value="ALL">{t('filter_all_movements')}</option>
                    <option value="Fast Moving">{t('filter_fast_moving')}</option>
                    <option value="Normal Moving">{t('filter_normal_moving')}</option>
                    <option value="Slow Moving">{t('filter_slow_moving')}</option>
                    <option value="Deadstock">{t('filter_deadstock')}</option>
                </select>

                <select 
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-medium outline-none focus:border-indigo-500/50 hover:bg-white transition-colors cursor-pointer"
                >
                    <option value="ALL">{t('filter_all_status')}</option>
                    <option value="LOW">{t('filter_low_stock')}</option>
                    <option value="OK">{t('filter_in_stock')}</option>
                </select>
                
                <button 
                  onClick={() => setShowInactive(!showInactive)}
                  className={cn(
                    "px-4 py-3 rounded-xl border font-bold text-sm whitespace-nowrap transition-all",
                    showInactive 
                        ? "bg-slate-800 text-white border-slate-800" 
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                  )}
                >
                    {showInactive ? t('show_active_only') : t('show_inactive')}
                </button>
           </div>
        </motion.div>

        {/* Content */}
        {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {[...Array(12)].map((_, i) => (
                   <Skeleton key={i} className="h-[280px] w-full rounded-[2rem]" />
               ))}
            </div>
        ) : (
           <motion.div 
             variants={container}
             initial="hidden"
             animate="show"
             className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
           >
              <AnimatePresence mode='popLayout'>
              {filtered.map((product) => {
                  const status = getStatus(product);
                  return (
                    <motion.div
                        key={product.id}
                        variants={item}
                        layout
                        className="group bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                    >
                        <div className="h-full relative z-10">
                            {/* Blob Effect on Hover */}
                            <Link href={`/stock-card?search=${encodeURIComponent(product.name)}`} className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors opacity-0 group-hover:opacity-100 duration-500 z-0" />
                            
                            <div className="relative z-10 h-full flex flex-col justify-between">
                                <div>
                                    {/* Top Row: Image & Status & Edit */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 p-1 relative group/image">
                                            {/* Desktop: Quick Actions Overlay (Hover) */}
                                            <div className="hidden md:flex absolute inset-0 bg-black/40 rounded-xl items-center justify-center gap-2 opacity-0 group-hover/image:opacity-100 transition-all duration-200 z-20 backdrop-blur-sm pointer-events-none">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setZoomedImage(product.image);
                                                    }}
                                                    className="p-2 bg-white/20 hover:bg-white text-white hover:text-indigo-600 rounded-lg transition-colors backdrop-blur-md pointer-events-auto"
                                                    title="Zoom Image"
                                                >
                                                    <Maximize2 className="w-4 h-4" />
                                                </button>
                                                <Link 
                                                    href={`/inventory/print-labels?sku=${product.id}&name=${encodeURIComponent(product.name)}&price=${product.price}&code=${encodeURIComponent(product.location || product.id)}`}
                                                    target="_blank"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-2 bg-white/20 hover:bg-white text-white hover:text-slate-900 rounded-lg transition-colors backdrop-blur-md pointer-events-auto"
                                                    title="Print Label"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation(); 
                                                        openEditModal(product, e);
                                                    }}
                                                    className="p-2 bg-white/20 hover:bg-white text-white hover:text-indigo-600 rounded-lg transition-colors backdrop-blur-md pointer-events-auto"
                                                    title="Edit Product"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                            </div>



                                        {product.image ? (
                                            <div 
                                                className="w-full h-full cursor-zoom-in"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setZoomedImage(product.image);
                                                }}
                                            >
                                                <img src={`/api/proxy/image?url=${encodeURIComponent(product.image)}`} alt={product.name} className="w-full h-full object-cover rounded-xl" />
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <Package className="w-8 h-8" />
                                            </div>
                                        )}
                                        </div>
                                        <span className={cn("px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider border", status.bg, status.color, status.border)}>
                                            {status.label}
                                        </span>
                                    </div>

                                    {/* Info - Wrapped in Link for Navigation */}
                                    <Link href={`/stock-card?search=${encodeURIComponent(product.name)}`} className="block">
                                        <div className="mb-4 h-14">
                                            <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors" title={product.name}>
                                                {product.name}
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-4">
                                            <div className="bg-slate-50 p-2 rounded-lg">
                                                <span className="block text-slate-400 text-[10px] uppercase font-bold mb-0.5">{t('col_category')}</span>
                                                <span className="font-semibold text-slate-700 truncate block" title={product.category}>{product.category}</span>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-lg">
                                                <span className="block text-slate-400 text-[10px] uppercase font-bold mb-0.5">{t('no_loc')}</span>
                                                <span className="font-semibold text-slate-700 truncate block">{product.location || '-'}</span>
                                            </div>
                                        </div>
                                    </Link>
                                </div>

                                <Link href={`/stock-card?search=${encodeURIComponent(product.name)}`} className="block">
                                    <div className="space-y-2 mb-4">
                                        <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('label_stock')}</span>
                                            <span className="text-2xl font-black tabular-nums tracking-tight">
                                                {product.stock.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400 font-bold">{t('label_min')} {product.minStock}</span>
                                            <div className="flex items-center gap-1 font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                                <span>฿</span>
                                                <span>{product.price.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>

                            {/* Footer Action */}
                            <div className="mt-auto pt-3 pb-3 px-4 border-t border-slate-50 flex justify-between items-center bg-white">
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                                    {product.id}
                                </span>
                                
                                <div className="flex items-center gap-2">
                                    {/* Mobile Actions in Footer */}
                                    <div className="md:hidden flex items-center gap-2">
                                        <Link 
                                            href={`/inventory/print-labels?sku=${product.id}&name=${encodeURIComponent(product.name)}&price=${product.price}&code=${encodeURIComponent(product.location || product.id)}`}
                                            target="_blank"
                                            className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 active:scale-90 transition-all border border-slate-200"
                                        >
                                            <Printer className="w-4 h-4" />
                                        </Link>
                                        <button
                                            onClick={(e) => openEditModal(product, e)}
                                            className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 active:scale-90 transition-all border border-indigo-100"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </div>


                                </div>
                            </div>
                        </div>
                    </motion.div>
                  );
              })}
              </AnimatePresence>
           </motion.div>
        )}

        {/* Zoom Modal */}
        <AnimatePresence>
            {zoomedImage && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setZoomedImage(null)}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
                >
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <button 
                            onClick={() => setZoomedImage(null)}
                            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors z-50 backdrop-blur-md"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <div className="w-full h-full p-4 flex items-center justify-center overflow-auto" onClick={() => setZoomedImage(null)}>
                            <img 
                                src={`/api/proxy/image?url=${encodeURIComponent(zoomedImage)}`} 
                                alt="Zoomed" 
                                className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl cursor-default"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {filtered.length === 0 && !loading && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <Filter className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{t('no_products_found')}</h3>
                <p className="text-slate-500 max-w-sm">{t('try_adjusting_filters')}</p>
                <button onClick={() => {setSearch(''); setFilterStatus('ALL'); setFilterMovement('ALL'); }} className="mt-6 text-indigo-600 font-bold hover:underline">
                    Clear all filters
                </button>
            </div>
        )}

        {/* Product CRUD Modal */}
        <ProductModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            product={editingProduct}
            onSuccess={fetchData} 
        />
    </div>
  );
}
