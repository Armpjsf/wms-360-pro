'use client';

import { getApiUrl } from "@/lib/config";

import { useState, useEffect, useRef } from 'react';
import { MapPin, Package, User, RefreshCw, X, Check, Wifi, WifiOff } from 'lucide-react';
import { Skeleton } from "@/components/ui/Skeleton";
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { motion, AnimatePresence } from 'framer-motion';

import SignatureModal from '@/components/SignatureModal';
import MobileNav from '@/components/MobileNav';
import { useNotification } from "@/components/providers/GlobalNotificationProvider";
import { useLanguage } from '@/components/providers/LanguageProvider';

interface ProductLoc {
    name: string;
    location: string;
}

export default function MobileJobsPage() {
  const { t } = useLanguage();
  const [activeJob, setActiveJob] = useState<any>(null);
  const [pendingJobs, setPendingJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productDetails, setProductDetails] = useState<Map<string, {location: string, image: string}>>(new Map());
  
  // Signature State
  const [showSigModal, setShowSigModal] = useState(false);
  const [signingDoc, setSigningDoc] = useState<string | null>(null);
  
  // Connection State
  const [isConnected, setIsConnected] = useState(true); // Assume true initially or check
  const [serverUrl, setServerUrl] = useState('');
  
  const { sendNotification } = useNotification();

  useEffect(() => {
     setServerUrl(getApiUrl(''));
  }, []);

  // Fetch Master Data (Products) for Location Lookup
  useEffect(() => {
      fetch(getApiUrl('/api/products'))
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                const map = new Map();
                data.forEach((p:any) => map.set(p.name, { 
                    location: p.location || '-',
                    image: p.image || ''
                }));
                setProductDetails(map);
            }
        })
        .catch(err => console.error("Product Load Error:", err));
  }, []);

  const fetchJobs = async () => {
      setLoading(true);
      try {
          const res = await fetch(getApiUrl('/api/orders/status'), { cache: 'no-store' });
          if (res.ok) setIsConnected(true);
          const data = await res.json();
          
          if (data.activeForm) {
              setActiveJob(data.activeForm);
              // Notify about active job
              if (data.activeForm.docNum !== activeJob?.docNum) {
                 sendNotification(`New Active Job: ${data.activeForm.docNum}`, {
                     body: `Customer: ${data.activeForm.customer}`,
                     tag: 'new-job-active'
                 });
              }
          } else {
              setActiveJob(null);
          }
          
          if (data.pending) {
              setPendingJobs(data.pending);
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
  }, []);

  // --- Auto-Trigger Signature for Customer ---
  const viewedDocs = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (activeJob?.docNum) {
        const docNum = activeJob.docNum;
        if (!viewedDocs.current.has(docNum)) {
            // New Job detected! Auto-open for customer
            setSigningDoc(docNum);
            setShowSigModal(true);
            viewedDocs.current.add(docNum);
        }
    }
  }, [activeJob?.docNum]); 

  // --- Signature Logic ---
  const handleSignClick = (docId: string) => {
      setSigningDoc(docId);
      setShowSigModal(true);
  };

  const [successData, setSuccessData] = useState<{ pdfLink: string, docNum: string } | null>(null);

  const handleConfirmSignature = async (dataUrl: string) => {
      try {
          // REVERTED: Call finalize to Generate PDF + Archive immediately.
          const res = await fetch(getApiUrl('/api/orders/finalize'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ signature: dataUrl, docNum: signingDoc })
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
          alert("Failed: " + e.message);
      }
  };

  const handleDismissSuccess = () => {
        setSuccessData(null);
        setSigningDoc(null);
        // Maybe fetch again to be sure
        fetchJobs();
  };

  if (successData) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-emerald-950 text-white text-center relative overflow-hidden">
               <AmbientBackground />
              <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/50 animate-bounce relative z-10">
                  <Check className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-black mb-2 relative z-10">{t('mobile_job_complete')}</h1>
              <p className="text-emerald-200 mb-8 max-w-xs mx-auto relative z-10">
                  Document <strong>{successData.docNum}</strong> finalized.<br/>
                  <span className="text-sm opacity-75">PDF sent to dashboard automatically.</span>
              </p>
              
              <button 
                  onClick={handleDismissSuccess}
                  className="w-full bg-white text-emerald-900 font-bold py-5 rounded-3xl flex items-center justify-center gap-2 shadow-xl hover:bg-emerald-50 transition-colors relative z-10 active:scale-95"
              >
                  {t('mobile_close_next')}
              </button>
          </div>
      );
  }

  return (
    <div className="relative min-h-screen pb-24 bg-slate-50/50">
      <AmbientBackground />
      
      <div className="relative z-10 max-w-lg mx-auto p-4 md:p-6">
      
        <div className="flex justify-between items-center mb-8 bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-white/50 shadow-sm sticky top-2 z-20">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    {t('mobile_my_jobs')}
                    <span className="text-xs bg-slate-900 text-white px-2 py-1 rounded-full font-bold">{pendingJobs.length + (activeJob ? 1 : 0)}</span>
                </h1>
                
                <div className="flex items-center gap-2 mt-1">
                     <p className="text-slate-500 text-xs font-medium">{t('mobile_picking_tasks')}</p>
                     <div className={`flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${isConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {isConnected ? 'Online' : 'Offline'}
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
                
                <div className="bg-white border-2 border-indigo-100 rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden group">
                    {/* Decorative Blob */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 -z-10" />
                    
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div>
                            <div className="text-4xl font-black text-slate-900 tracking-tighter mb-1">{activeJob.docNum}</div>
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

        {/* --- Pending Queue --- */}
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
                                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 py-2 rounded-xl font-bold shadow-lg shadow-slate-900/20"
                                 >
                                    Sign
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
                                       + {job.items.length - 3} more items
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
