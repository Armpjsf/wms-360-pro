'use client';

import { getApiUrl } from "@/lib/config";

import { useState, useEffect, useRef } from 'react';
import { MapPin, Package, User, RefreshCw, X, Check, Wifi, WifiOff, Play } from 'lucide-react';
import { Skeleton } from "@/components/ui/Skeleton";
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { motion, AnimatePresence } from 'framer-motion';

import SignatureModal from '@/components/SignatureModal';
import MobileNav from '@/components/MobileNav';
import { useNotification } from "@/components/providers/GlobalNotificationProvider";
import { appAlert, appConfirm } from '@/components/ui/MobileDialog';
import { enqueue, flushQueue, queueLength } from '@/lib/offlineQueue';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface ProductLoc {
    name: string;
    location: string;
}

export default function MobileJobsPage() {
  const { t } = useLanguage();
  
  // Stale-While-Revalidate (SWR): Initialize states from localStorage if available to prevent skeletons
  const [activeJob, setActiveJob] = useState<any>(() => {
      if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('wms_cache_active_job');
          return cached ? JSON.parse(cached) : null;
      }
      return null;
  });
  const [pendingJobs, setPendingJobs] = useState<any[]>(() => {
      if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('wms_cache_pending_jobs');
          return cached ? JSON.parse(cached) : [];
      }
      return [];
  });
  const [waitingJobs, setWaitingJobs] = useState<any[]>(() => {
      if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('wms_cache_waiting_jobs');
          return cached ? JSON.parse(cached) : [];
      }
      return [];
  });
  const [loading, setLoading] = useState(() => {
      if (typeof window !== 'undefined') {
          const hasCache = localStorage.getItem('wms_cache_active_job') || localStorage.getItem('wms_cache_pending_jobs');
          return !hasCache; // Don't show skeleton if we have cached data!
      }
      return true;
  });

  const [productDetails, setProductDetails] = useState<Map<string, {location: string, image: string}>>(new Map());
  
  // Signature State
  const [showSigModal, setShowSigModal] = useState(false);
  const [signingDoc, setSigningDoc] = useState<string | null>(null);

  // Tracks which job is currently being switched to (guards double-taps)
  const [startingDoc, setStartingDoc] = useState<string | null>(null);

  // "Goods ready" confirmation state for the active job
  const [markingReady, setMarkingReady] = useState(false);
  const [readySent, setReadySent] = useState(false);

  // Pull-to-refresh gesture state
  const pullStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const PULL_THRESHOLD = 70;
  
  // Connection State
  const [isConnected, setIsConnected] = useState(true); // Assume true initially or check
  const [serverUrl, setServerUrl] = useState('');
  
  const { sendNotification } = useNotification();

  useEffect(() => {
     setServerUrl(getApiUrl(''));
  }, []);

  // Fetch Master Data (Products) for Location Lookup - Offline First Cache
  useEffect(() => {
      const loadProducts = async () => {
          try {
              // 1. Load from local IndexedDB instantly (under 10ms)
              const { db } = await import('@/lib/db');
              const cachedProducts = await db.products.toArray();
              if (cachedProducts && cachedProducts.length > 0) {
                  const map = new Map();
                  cachedProducts.forEach((p: any) => map.set(p.name, {
                      location: p.location || '-',
                      image: p.image || ''
                  }));
                  setProductDetails(map);
                  console.log(`[Cache] Loaded ${cachedProducts.length} products from Dexie IndexedDB`);
              }
          } catch (e) {
              console.warn("Failed to load products from Dexie:", e);
          }

          // 2. Fetch from server in background to refresh cache
          try {
              const res = await fetch(getApiUrl('/api/products'));
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                  const map = new Map();
                  data.forEach((p: any) => map.set(p.name, {
                      location: p.location || '-',
                      image: p.image || ''
                  }));
                  setProductDetails(map);

                  // Async update Dexie in background
                  const { db } = await import('@/lib/db');
                  await db.products.clear();
                  await db.products.bulkPut(data.map((p: any) => ({
                      id: p.name,
                      name: p.name,
                      category: p.category || '',
                      price: Number(p.price) || 0,
                      stock: Number(p.stock) || 0,
                      image: p.image || '',
                      updatedAt: Date.now()
                  })));
                  console.log("[Cache] Dexie IndexedDB updated with fresh server products");
              }
          } catch (err) {
              console.error("Product background sync error:", err);
          }
      };

      loadProducts();
  }, []);

  const fetchJobs = async () => {
      // Only set loading to true if we don't have any cached data to display
      const hasData = activeJob || pendingJobs.length > 0 || waitingJobs.length > 0;
      if (!hasData) {
          setLoading(true);
      }
      try {
          const res = await fetch(getApiUrl('/api/orders/status'), { cache: 'no-store' });
          if (res.ok) setIsConnected(true);
          const data = await res.json();
          
          if (data.activeForm) {
              setActiveJob(data.activeForm);
              localStorage.setItem('wms_cache_active_job', JSON.stringify(data.activeForm));
              // Notify about active job
              if (data.activeForm.docNum !== activeJob?.docNum) {
                 sendNotification(t('active_job_alert').replace('{0}', data.activeForm.docNum), {
                     body: t('customer_label').replace('{0}', data.activeForm.customer),
                     tag: 'new-job-active'
                 });
              }
          } else {
              setActiveJob(null);
              localStorage.removeItem('wms_cache_active_job');
          }
          
          if (data.pending) {
              setPendingJobs(data.pending);
              localStorage.setItem('wms_cache_pending_jobs', JSON.stringify(data.pending));
          } else {
              setPendingJobs([]);
              localStorage.removeItem('wms_cache_pending_jobs');
          }
          
          if (data.waiting) {
              setWaitingJobs(data.waiting);
              localStorage.setItem('wms_cache_waiting_jobs', JSON.stringify(data.waiting));
          } else {
              setWaitingJobs([]);
              localStorage.removeItem('wms_cache_waiting_jobs');
          }
          
      } catch (e) {
          console.error("Job Fetch Error", e);
          setIsConnected(false);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      // Load once on mount
      // Initialize Push Notifications
      import('@/lib/notificationService').then(({ notificationService }) => {
          notificationService.initialize();
      });

      fetchJobs();
      // No more auto-polling to save Google API quota

      // Replay any actions queued while offline (now and when we come back online)
      const flush = async () => {
          if (queueLength() === 0) return;
          const sent = await flushQueue(getApiUrl);
          if (sent > 0) {
              appAlert(`ส่งรายการที่ค้างไว้ตอนออฟไลน์แล้ว ${sent} รายการ`);
              fetchJobs();
          }
      };
      flush();
      window.addEventListener('online', flush);
      return () => window.removeEventListener('online', flush);
  }, []);

  // --- Auto-Trigger Signature for Customer ---
  const viewedDocs = useRef<Set<string>>(new Set());

  // --- Pull-to-refresh handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
      // Only arm the gesture when scrolled to the very top and not already refreshing
      if (window.scrollY <= 0 && !refreshing) {
          pullStartY.current = e.touches[0].clientY;
      } else {
          pullStartY.current = null;
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (pullStartY.current === null) return;
      const delta = e.touches[0].clientY - pullStartY.current;
      // Apply resistance so the pull feels natural and is capped
      if (delta > 0) setPullDistance(Math.min(delta * 0.5, 100));
  };

  const handleTouchEnd = async () => {
      if (pullStartY.current === null) return;
      const shouldRefresh = pullDistance > PULL_THRESHOLD;
      pullStartY.current = null;
      if (shouldRefresh) {
          setRefreshing(true);
          setPullDistance(56); // hold the spinner in view while fetching
          try {
              await fetchJobs();
          } finally {
              setRefreshing(false);
              setPullDistance(0);
          }
      } else {
          setPullDistance(0);
      }
  };

  // Reset the "ready" confirmation whenever the active job changes
  useEffect(() => {
      setReadySent(false);
  }, [activeJob?.docNum]);

  // --- Prep done: notify admins AND clear the form (job moves to the
  // recall/waiting queue, still recallable until the customer signs) ---
  const handleMarkReady = async () => {
      if (markingReady || !activeJob) return;
      if (!(await appConfirm('ยืนยันว่าจัดเตรียมสินค้าเสร็จ?\nงานจะย้ายไปคิว "รอรับ" (เรียกกลับมาให้ลูกค้าเซ็นได้ตลอด)'))) return;
      try {
          setMarkingReady(true);
          const orders = Array.from(new Set((activeJob.items || []).map((i: any) => i.orderNo).filter(Boolean)));
          const orderText = orders.length ? orders.join(', ') : activeJob.docNum;

          // 1. Notify admins
          await fetch(getApiUrl('/api/orders/ready'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ docNum: activeJob.docNum, orderText, customer: activeJob.customer })
          });

          // 2. Clear the active form -> job stays in คลังข้อมูล and appears in the
          // waiting/recall queue until it gets signed & finalized
          const res = await fetch(getApiUrl('/api/orders/archive'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({})
          });
          if (!res.ok) throw new Error('failed');

          await fetchJobs(); // active clears; job shows up in the recall queue
      } catch (e: any) {
          // Network drop mid-action: queue both steps for replay when back online
          if (!navigator.onLine || e instanceof TypeError) {
              const orders = Array.from(new Set((activeJob.items || []).map((i: any) => i.orderNo).filter(Boolean)));
              const orderText = orders.length ? orders.join(', ') : activeJob.docNum;
              enqueue('/api/orders/ready', { docNum: activeJob.docNum, orderText, customer: activeJob.customer });
              enqueue('/api/orders/archive', {});
              appAlert('ออฟไลน์อยู่ — บันทึกไว้แล้ว จะส่งอัตโนมัติเมื่อกลับมาออนไลน์');
          } else {
              appAlert('ดำเนินการไม่สำเร็จ กรุณาลองใหม่');
          }
      } finally {
          setMarkingReady(false);
      }
  };

  // --- Signature Logic ---
  const handleSignClick = (docId: string) => {
      setSigningDoc(docId);
      setShowSigModal(true);
  };

  // --- Restore/Start Job Logic ---
  const handleStartJob = async (docNum: string) => {
      // Guard: ignore repeat taps while a switch is already in flight
      if (startingDoc) return;
      if (!(await appConfirm(`สลับไปทำงาน ${docNum}?\nงานปัจจุบันจะถูกพักไว้ในคิว`))) return;

      try {
          setStartingDoc(docNum);
          setLoading(true);
          const res = await fetch(getApiUrl('/api/jobs/restore'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ docNum })
          });

          if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || "Failed to start job");
          }

          // Refresh to see new active job
          await fetchJobs();
          // Scroll to top
          window.scrollTo(0, 0);

      } catch (e: any) {
          appAlert('ผิดพลาด: ' + e.message);
          setLoading(false);
      } finally {
          setStartingDoc(null);
      }
  };

  const [successData, setSuccessData] = useState<{ pdfLink: string, docNum: string } | null>(null);

  const handleConfirmSignature = async (dataUrl: string) => {
      try {
          // REVERTED: Call finalize to Generate PDF + Archive immediately.
          const res = await fetch(getApiUrl('/api/orders/finalize'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  signature: dataUrl, 
                  docNum: signingDoc,
                  packs: 0, // Admin will fill later
                  location: "" // Admin will fill later
              })
          });
          
          if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.message || errData.error || "Server returned " + res.status);
          }
          
          // Handle PDF Blob response
          const blob = await res.blob();
          const pdfLink = URL.createObjectURL(blob);

          // Clear Modal
          setShowSigModal(false);
          
          // Show Success Screen
          setSuccessData({
              pdfLink: pdfLink,
              docNum: signingDoc || "Document"
          });
          
          // Refresh background data
          fetchJobs();
          
      } catch (e: any) {
          console.error("Signature Save Error", e);
          appAlert('บันทึกไม่สำเร็จ: ' + e.message);
      }
  };

  const handleDismissSuccess = () => {
        setSuccessData(null);
        setSigningDoc(null);
        // Maybe fetch again to be sure
        fetchJobs();
  };

  if (successData) {
      // Determine next job (Priority: Waiting (Oldest) -> Pending)
      // Waiting Jobs are usually sorted by latest first in API, so we might want the last one (oldest)?
      // Actually API calls them 'waitingJobs', let's assume index 0 is most relevant or recently added.
      // Usually LIFO (Last In First Out) for stacks, FIFO for queues.
      // Let's just pick the first one visible.
      const nextJob = waitingJobs.length > 0 ? waitingJobs[0] : (pendingJobs.length > 0 ? pendingJobs[0] : null);

      return (
          <div className="flex flex-col items-center justify-center min-h-screen p-6 text-slate-950 text-center relative overflow-hidden">
               <AmbientBackground />
              <div className="w-24 h-24 bg-emerald-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/30 relative z-10">
                  <Check className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-black mb-2 relative z-10">{t('mobile_job_complete')}</h1>
              <p className="text-slate-500 mb-8 max-w-xs mx-auto relative z-10">
                  {t('document_finalized').replace('{0}', successData.docNum)}<br/>
                  <span className="text-sm opacity-75">{t('pdf_sent_dashboard')}</span>
              </p>
              
              {nextJob && (
                  <button 
                      onClick={() => {
                          setSuccessData(null);
                          if (nextJob.docNum) handleStartJob(nextJob.docNum);
                      }}
                      className="w-full bg-white text-emerald-900 font-bold py-5 rounded-3xl flex items-center justify-center gap-2 shadow-xl hover:bg-emerald-50 transition-colors relative z-10 mb-4 active:scale-95"
                  >
                      <span>{t('start_next_job').replace('{0}', nextJob.docNum || nextJob.name)}</span> <Play className="w-5 h-5 fill-emerald-900" />
                  </button>
              )}
              
              <button 
                  onClick={handleDismissSuccess}
                  className="w-full bg-white/85 border border-emerald-200 text-emerald-700 font-bold py-4 rounded-3xl flex items-center justify-center gap-2 relative z-10 shadow-sm"
              >
                  {t('mobile_close_next')}
              </button>
          </div>
      );
  }

  return (
    <div
      className="relative min-h-screen pb-24 bg-slate-50/50"
      style={{ overscrollBehaviorY: 'contain' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AmbientBackground />

      {/* Pull-to-refresh indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-30"
        style={{ height: pullDistance, opacity: pullDistance > 10 ? 1 : 0 }}
      >
        <div className="mt-2 bg-white shadow-md rounded-full p-2 border border-slate-100">
          <RefreshCw
            className={`w-6 h-6 text-indigo-500 ${refreshing ? 'animate-spin' : ''}`}
            style={refreshing ? undefined : { transform: `rotate(${pullDistance * 3}deg)` }}
          />
        </div>
      </div>

      <div
        className="relative z-10 max-w-lg mx-auto p-4 md:p-6"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullStartY.current === null ? 'transform 0.2s ease-out' : undefined,
        }}
      >

        <div className="flex justify-between items-center mb-8 bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-white/50 shadow-sm sticky top-2 z-20">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    {t('mobile_my_jobs')}
                    <span className="text-xs bg-slate-900 text-white px-2 py-1 rounded-full font-bold">{pendingJobs.length + (activeJob ? 1 : 0) + waitingJobs.length}</span>
                </h1>
                
                <div className="flex items-center gap-2 mt-1">
                     <p className="text-slate-500 text-xs font-medium">{t('mobile_picking_tasks')}</p>
                     <div className={`flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${isConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {isConnected ? t('online') : t('offline')}
                    </div>
                </div>
            </div>
            
            <button onClick={fetchJobs} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-500 shadow-sm transition-all hover:shadow-md active:scale-95 hover:border-indigo-100">
                <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
            </button>
        </div>

        {loading && !activeJob && (
            <div className="space-y-6">
               <Skeleton className="h-64 w-full rounded-[2.5rem]" />
               <div className="space-y-4">
                   <Skeleton className="h-24 w-full rounded-2xl" />
                   <Skeleton className="h-24 w-full rounded-2xl" />
               </div>
            </div>
        )}

        {/* --- Active Job Section --- */}
        {!loading && activeJob ? (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex items-center gap-2 mb-3 px-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <h2 className="text-emerald-600 font-bold uppercase tracking-wider text-xs">{t('mobile_active_job')}</h2>
                </div>
                
                <div className="bg-white border-2 border-indigo-100 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-600 via-emerald-500 to-amber-500" />
                    
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div>
                            {(() => {
                                const orders = Array.from(new Set((activeJob.items || []).map((i: any) => i.orderNo).filter(Boolean)));
                                const orderText = orders.length ? orders.join(', ') : activeJob.docNum;
                                return (
                                    <>
                                        <div className="text-4xl font-black text-slate-900 tracking-tighter mb-1">{orderText}</div>
                                        <div className="text-[11px] text-slate-400 font-semibold mb-1.5">{t('doc_no')}: {activeJob.docNum}</div>
                                    </>
                                );
                            })()}
                            <div className="flex items-center gap-2 text-indigo-600 font-medium text-sm bg-indigo-50 px-3 py-1.5 rounded-xl w-fit">
                                <User className="w-4 h-4" /> {activeJob.customer}
                            </div>
                        </div>
                    </div>

                    {/* Items List with Locations & Images */}
                    <div className="space-y-3 mb-6 bg-slate-50 rounded-[1.5rem] p-4 border border-slate-100/50">
                        <div className="flex justify-between items-center mb-2 px-2">
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{t('items_list')}</span>
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{activeJob.items?.length || 0} {t('items_list')}</span>
                        </div>
                        
                        {activeJob.items && activeJob.items.length > 0 ? (
                            activeJob.items.map((item: any, idx: number) => {
                                const details = productDetails.get(item.itemCode || item.description);
                                return (
                                    <div key={idx} className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                                        {/* Image or Index */}
                                        {details?.image ? (
                                            <img src={`/api/proxy/image?url=${encodeURIComponent(details.image)}`} alt="prod" className="w-12 h-12 rounded-xl bg-slate-100 object-cover border border-slate-100" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold border border-indigo-100">
                                                {idx + 1}
                                            </div>
                                        )}
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="text-slate-900 font-bold text-sm truncate pr-2">{item.itemCode || item.description}</div>
                                            <div className="text-slate-400 text-xs flex gap-2 mt-0.5">
                                                <span>Ref: {item.orderNo}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-slate-900 font-black text-xl leading-none">x{item.qty}</div>
                                            <div className="text-orange-600 text-[10px] font-bold flex items-center justify-end gap-1 mt-1 bg-orange-50 px-1.5 py-0.5 rounded-lg border border-orange-100">
                                                <MapPin className="w-3 h-3" />
                                                {details?.location || '-'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                             <div className="text-center text-xs text-slate-400 py-4">
                                {t('no_items_added')}
                            </div>
                        )}
                    </div>

                    {/* Notify admin that goods are prepared/ready to ship */}
                    <button
                         onClick={handleMarkReady}
                         disabled={markingReady || readySent}
                         className={`w-full mb-3 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 text-lg active:scale-[0.98] transition-all border-2 ${
                             readySent
                                 ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                 : 'bg-white border-emerald-500 text-emerald-700 hover:bg-emerald-50 shadow-lg shadow-emerald-600/10'
                         }`}
                    >
                        {markingReady ? (
                            <div className="w-6 h-6 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin" />
                        ) : readySent ? (
                            <><Check className="w-6 h-6" /> <span>แจ้งเตรียมเสร็จแล้ว</span></>
                        ) : (
                            <><Package className="w-6 h-6" /> <span>จัดเตรียมสินค้าเสร็จ</span></>
                        )}
                    </button>

                    <button
                         onClick={() => handleSignClick(activeJob.docNum)}
                         className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/30 text-lg active:scale-[0.98] transition-all"
                    >
                        <span>{t('mobile_sign_complete')}</span> <Check className="w-6 h-6" />
                    </button>
                </div>
            </motion.div>
        ) : !loading && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-8 bg-white/80 backdrop-blur-sm border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center"
            >
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-600 font-bold text-lg">{t('mobile_no_active_jobs')}</h3>
                <p className="text-sm text-slate-400 mt-1">{t('mobile_check_back')}</p>
            </motion.div>
        )}

        {/* --- Waiting/Paused Queue (From Archive) --- */}
        {waitingJobs.length > 0 && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-6"
            >
                <h2 className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-4 px-2">{t('ready_to_process')} ({waitingJobs.length})</h2>
                <div className="space-y-3">
                    {waitingJobs.map((job) => (
                        <div key={job.docNum} className="bg-white border-l-4 border-l-orange-400 border-y border-r border-slate-200 rounded-r-2xl p-4 shadow-sm flex justify-between items-center">
                            <div>
                                <div className="font-black text-slate-900 text-lg tracking-tight">{job.orderNo || job.docNum}</div>
                                <div className="text-[11px] text-slate-400 font-semibold mb-0.5">{t('doc_no')}: {job.docNum}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                    <User className="w-3 h-3" /> {job.customer}
                                </div>
                            </div>
                            <button
                                onClick={() => handleStartJob(job.docNum)}
                                disabled={startingDoc === job.docNum}
                                className="bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-60 min-h-[48px] px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2 shrink-0"
                            >
                                {startingDoc === job.docNum ? (
                                    <div className="w-5 h-5 border-2 border-orange-300 border-t-orange-700 rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-orange-700" />
                                        {t('start_btn')}
                                    </>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </motion.div>
        )}

        {/* --- Pending Queue (Roll Tags) --- */}
        {pendingJobs.length > 0 && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <h2 className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-4 px-2">{t('mobile_pending_queue')} ({pendingJobs.length})</h2>
                <div className="space-y-4">
                    {pendingJobs.map((job) => (
                        <div key={job.id} className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm active:scale-[0.99] transition-transform">
                            <div className="flex justify-between items-start mb-4">
                                 <div>
                                    <div className="font-bold text-slate-800 text-lg mb-1">{job.name}</div>
                                    <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                        <User className="w-3 h-3" /> {job.customer}
                                    </div>
                                 </div>
                                 <button
                                    onClick={() => handleSignClick(job.id)}
                                    className="bg-slate-900 hover:bg-slate-800 text-white text-sm min-h-[48px] px-6 py-3 rounded-2xl font-bold shadow-lg shadow-slate-900/20 flex items-center gap-2 active:scale-95 transition-all shrink-0"
                                 >
                                    <Check className="w-4 h-4" />
                                    {t('sign_btn')}
                                 </button>
                            </div>
                            {/* Items Preview */}
                            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                               {job.items && job.items.slice(0, 3).map((it:any, idx:number) => {
                                   const details = productDetails.get(it.itemCode || it.description);
                                   return (
                                       <div key={idx} className="flex items-center gap-3 text-xs text-slate-500">
                                           {details?.image ? (
                                                <img src={`/api/proxy/image?url=${encodeURIComponent(details.image)}`} alt="tm" className="w-8 h-8 rounded-lg bg-slate-50 object-cover border border-slate-100" />
                                           ) : (
                                                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-500 font-bold">{idx+1}</span>
                                           )}
                                           
                                           <span className="text-slate-700 font-medium flex-1 truncate">{it.itemCode || it.description}</span>
                                           <span className="text-slate-400 font-mono">x{it.qty}</span>
                                           <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                             {details?.location || '-'}
                                           </span>
                                       </div>
                                   );
                               })}
                               {job.items && job.items.length > 3 && (
                                   <div className="text-center text-[10px] text-slate-400 font-bold pt-1">
                                       {t('more_items').replace('{0}', String(job.items.length - 3))}
                                   </div>
                               )}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        )}

        {/* Shared Signature Modal */}
        <SignatureModal 
            isOpen={showSigModal}
            onClose={() => setShowSigModal(false)}
            onSave={handleConfirmSignature}
            docNum={signingDoc || "Unknown"}
        />
        
        </div>
        
        {/* Mobile Navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-50">
            <MobileNav />
        </div>
    </div>
  );
}
