'use client';

import { useState, useEffect } from 'react';
import { FileText, RefreshCw, Printer, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

export default function OrderFulfillmentPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfResult, setPdfResult] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/orders/fulfillment?action=check_pending');
        const data = await res.json();
        setStatus(data);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleProcess = async (tagId: string) => {
      if (!confirm(`Are you sure you want to process ${tagId}?`)) return;
      
      setProcessing(true);
      try {
          const res = await fetch('/api/orders/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tagId })
          });
          const data = await res.json();
          if (res.ok) {
              alert(`Successfully processed order! (DocNum: ${data.docId})`);
              fetchStatus();
          } else {
              alert("Error processing: " + (data.error || 'Server error'));
          }
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setProcessing(false);
      }
  };

  const handleGeneratePDF = async () => {
      setProcessing(true);
      try {
          const res = await fetch('/api/orders/fulfillment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  action: 'generate_pdf',
                  docNum: status?.form_active_doc || 'DRAFT'
              })
          });
          const data = await res.json();
          if (data.viewLink) {
              setPdfResult(data);
          } else {
              alert("PDF Generation Failed: " + data.error);
          }
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setProcessing(false);
      }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-6xl space-y-8">
       <header className="relative overflow-hidden rounded-[1.75rem] border border-blue-200 bg-white/85 p-6 shadow-xl shadow-blue-900/10 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-teal-500 to-amber-500" />
          <h1 className="text-3xl font-bold text-slate-950 mb-2 flex items-center gap-3">
             <div className="p-3 bg-blue-50 rounded-xl ring-1 ring-blue-100">
               <Printer className="w-8 h-8 text-blue-700" />
             </div>
             Order Fulfillment Center
          </h1>
          <p className="text-slate-500">ระบบจัดการใบส่งสินค้าและ PDF (Legacy Parity)</p>
       </header>

       {/* Status Cards */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           
           {/* Section 1: Pending Jobs */}
           <div className="bg-white/90 border border-slate-200 rounded-2xl p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
               <div className="flex justify-between items-center mb-6">
                   <h2 className="text-xl font-bold text-slate-950">1. Pending Tasks (งานรอ)</h2>
                   <button onClick={fetchStatus} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                       <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                   </button>
               </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-6 text-slate-500">Loading tasks...</div>
                    ) : !status?.pending_tasks || status.pending_tasks.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">
                            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-slate-700" />
                            <p className="font-medium text-slate-500">No Pending Tasks</p>
                            <p className="text-xs text-slate-500 mt-1">All Roll Tags are clear</p>
                        </div>
                    ) : (
                        status.pending_tasks.map((task: any) => (
                            <div key={task.tagId} className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex justify-between items-center transition-all duration-200 hover:scale-[1.01]">
                                <div>
                                    <div className="text-xs text-emerald-400 uppercase font-bold tracking-wider mb-1">
                                        {task.name || `Roll Tag ${task.tagId.replace("RT", "")}`}
                                    </div>
                                    <div className="font-bold text-lg text-slate-950">
                                        Order: {task.customerId || task.customerName}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleProcess(task.tagId)}
                                    disabled={processing}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-950/20 transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                                >
                                    Create Note
                                </button>
                            </div>
                        ))
                    )}
                </div>
           </div>

           {/* Section 2: Active Form */}
           <div className="bg-white/90 border border-slate-200 rounded-2xl p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
               <h2 className="text-xl font-bold text-slate-950 mb-6">2. Active Form (งานปัจจุบัน)</h2>
               
               {status?.form_active_doc ? (
                   <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center space-y-6">
                       <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium border border-blue-200">
                           <FileText className="w-4 h-4" /> Editing: {status.form_active_doc}
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4">
                            <button className="py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 font-medium text-sm transition-colors">
                                View Form Sheet
                            </button>
                            <button 
                                onClick={handleGeneratePDF}
                                disabled={processing}
                                className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-900/20 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                            > 
                                {processing ? 'Generating...' : <><Printer className="w-4 h-4" /> Save & Print PDF</>}
                            </button>
                       </div>
                   </div>
               ) : (
                   <div className="h-40 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                       <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
                       <p>Form is Clear</p>
                       <p className="text-xs mt-1">Ready to create new document</p>
                   </div>
               )}

               {pdfResult && (
                   <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl animate-in fade-in slide-in-from-bottom-2">
                       <h3 className="font-bold text-emerald-700 flex items-center gap-2 mb-2">
                           <CheckCircle className="w-4 h-4" /> PDF Created!
                       </h3>
                       <div className="flex gap-2">
                           <a href={pdfResult.viewLink} target="_blank" className="flex-1 py-2 text-center bg-green-600 text-white rounded-lg font-bold text-sm">Open PDF</a>
                           <a href={pdfResult.downloadLink} target="_blank" className="flex-1 py-2 text-center bg-white text-emerald-700 border border-emerald-200 rounded-lg font-bold text-sm">Download</a>
                       </div>
                   </div>
               )}
           </div>

       </div>
      </div>
    </div>
  );
}
