'use client';

import { useState, useEffect } from 'react';
import { FileText, RefreshCw, Printer, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

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

  const handleProcess = async (type: string) => {
      // Placeholder for full logic
      alert("This would trigger the Roll Tag -> Form Data Copy process. (Requires full matrix mapping implementation)");
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
    <div className="p-8 max-w-6xl mx-auto space-y-8">
       <header>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
             <div className="p-3 bg-indigo-500/10 rounded-xl">
               <Printer className="w-8 h-8 text-indigo-400" />
             </div>
             Order Fulfillment Center
          </h1>
          <p className="text-slate-400">ระบบจัดการใบส่งสินค้าและ PDF (Legacy Parity)</p>
       </header>

       {/* Status Cards */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           
           {/* Section 1: Pending Jobs */}
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
               <div className="flex justify-between items-center mb-6">
                   <h2 className="text-xl font-bold text-white">1. Pending Tasks (งานรอ)</h2>
                   <button onClick={fetchStatus} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                       <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                   </button>
               </div>

               <div className="space-y-4">
                   {/* Roll Tag 1 */}
                   <div className={`p-4 rounded-xl border flex justify-between items-center ${status?.rt1_pending ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950 border-slate-800'}`}>
                       <div>
                           <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Roll Tag 1</div>
                           <div className={`font-bold text-lg ${status?.rt1_pending ? 'text-emerald-400' : 'text-slate-600'}`}>
                               {status?.rt1_pending ? `Order: ${status.rt1_pending}` : 'Empty'}
                           </div>
                       </div>
                       {status?.rt1_pending && (
                           <button onClick={() => handleProcess('Roll Tag1')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-900/20">
                               Create Note
                           </button>
                       )}
                   </div>

                    {/* Roll Tag 2 */}
                   <div className={`p-4 rounded-xl border flex justify-between items-center ${status?.rt2_pending ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950 border-slate-800'}`}>
                       <div>
                           <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Roll Tag 2</div>
                           <div className={`font-bold text-lg ${status?.rt2_pending ? 'text-emerald-400' : 'text-slate-600'}`}>
                               {status?.rt2_pending ? `Order: ${status.rt2_pending}` : 'Empty'}
                           </div>
                       </div>
                       {status?.rt2_pending && (
                           <button onClick={() => handleProcess('Roll Tag2')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-900/20">
                               Create Note
                           </button>
                       )}
                   </div>
               </div>
           </div>

           {/* Section 2: Active Form */}
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
               <h2 className="text-xl font-bold text-white mb-6">2. Active Form (งานปัจจุบัน)</h2>
               
               {status?.form_active_doc ? (
                   <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-6 text-center space-y-6">
                       <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm font-medium border border-indigo-500/30">
                           <FileText className="w-4 h-4" /> Editing: {status.form_active_doc}
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4">
                            <button className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 font-medium text-sm transition-colors">
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
                   <div className="h-40 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                       <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
                       <p>Form is Clear</p>
                       <p className="text-xs mt-1">Ready to create new document</p>
                   </div>
               )}

               {pdfResult && (
                   <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl animate-in fade-in slide-in-from-bottom-2">
                       <h3 className="font-bold text-green-400 flex items-center gap-2 mb-2">
                           <CheckCircle className="w-4 h-4" /> PDF Created!
                       </h3>
                       <div className="flex gap-2">
                           <a href={pdfResult.viewLink} target="_blank" className="flex-1 py-2 text-center bg-green-600 text-white rounded-lg font-bold text-sm">Open PDF</a>
                           <a href={pdfResult.downloadLink} target="_blank" className="flex-1 py-2 text-center bg-slate-800 text-green-400 border border-green-500/30 rounded-lg font-bold text-sm">Download</a>
                       </div>
                   </div>
               )}
           </div>

       </div>
    </div>
  );
}
