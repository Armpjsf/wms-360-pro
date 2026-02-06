'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Printer, CheckCircle, Mail, RefreshCw, Truck, X, Loader2, Clock } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import SignatureModal from '@/components/SignatureModal';
import { useLanguage } from '@/components/providers/LanguageProvider';

// ============================================================================
// TYPES
// ============================================================================

interface POLogItem {
    orderNo: string;
    customer: string;
    date: string;
    item: string;
    itemCount?: number;
    items?: string[];
    status: string;
    pdfLink?: string;
    deliveryDate: string;
}

interface RollTag {
  id: string;
  customer: string;
  itemCount: number;
}

interface ActiveForm {
  docNum: string;
  customer: string;
  refDate: string;
  status: string;
  items?: { itemCode: string; orderNo: string; qty: number }[];
  signature?: string | null;
}

interface WaitingJob {
  docNum: string;
  customer: string;
  date: string;
  orderNo?: string;
}

interface CompletedJob {
  docNum: string;
  customer: string;
  date: string;
  pdfLink: string;
  orderNo?: string;
}

interface OrderStatus {
  pending: RollTag[];
  activeForm: ActiveForm | null;
  waiting: WaitingJob[];
  completed: CompletedJob[];
  recent?: POLogItem[];
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function OrdersPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen p-6 text-slate-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-600" />
            {t('orders_title')}
          </h1>
          <p className="text-slate-500">{t('orders_subtitle')}</p>
        </div>

        {/* Main Content */}
        <OrderManagement />
      </div>
    </div>
  );
}

// ============================================================================
// ORDER MANAGEMENT COMPONENT
// ============================================================================

function OrderManagement() {
  const { t } = useLanguage();
  // State
  const [status, setStatus] = useState<OrderStatus>({ pending: [], activeForm: null, waiting: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Fetch status from API
  const fetchStatus = useCallback(async (isManual = false) => {
    if (isManual) setLoadingAction('refresh');

    try {
      const res = await fetch(getApiUrl(`/api/orders/status?t=${Date.now()}`), {
        cache: 'no-store'
      });
      
      if (!res.ok) return;
      
      const data = await res.json();
      if (data.error) return;

      // Always update to latest data from server
      const newStatus = {
        pending: data.pending || [],
        activeForm: data.activeForm || null,
        waiting: data.waiting || [],
        completed: data.completed || []
      };

      setStatus(newStatus);
      
      if (newStatus.activeForm?.signature) {
          setSignatureData(newStatus.activeForm.signature);
          if (isManual) alert(`${t('signed_status')}! ✅ (Signature Synced)`);
      } else {
          if (isManual) {
             if (newStatus.activeForm) alert('No signature found yet.');
             else alert('Refreshed.');
          }
      }
      
    } catch (error) {
      console.error('Status fetch error:', error);
      if (isManual) alert('Refresh Failed');
    } finally {
      setLoading(false);
      if (isManual) setLoadingAction(null);
    }
  }, [t]);

  // Initial load only
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ========== HANDLERS ==========

  const handleProcessRollTag = async (tagId: string) => {
    if (!confirm(t('confirm_prompt') + ' process?')) return;
    
    setLoadingAction('process');
    try {
      const res = await fetch(getApiUrl('/api/orders/process'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId })
      });

      if (res.ok) {
        await fetchStatus(); // Refresh immediately
      } else {
        alert('Error processing');
      }
    } catch (error) {
      console.error(error);
      alert('Error processing');
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePrint = (tagId: string) => {
    const url = getApiUrl(`/api/print/roll-tag?tagId=${tagId}`);
    window.open(url, '_blank');
  };

  const handleCopyLineMsg = async () => {
    if (!status.activeForm) return;
    
    // Helper: Format Item Code (Legacy Parity)
    const formatItemCode = (itemStr: string) => {
        if (!itemStr) return "";
        const originalItem = String(itemStr).trim();
        let suffix = "";
        
        if (originalItem.toUpperCase().endsWith('I')) {
            suffix = " I";
        }
        
        if (originalItem.length >= 8) {
            const part1 = originalItem.slice(2, 6);
            const part2 = originalItem.slice(6, 8);
            return `${part1} ${part2}${suffix}`;
        } else {
            return `${originalItem}${suffix}`;
        }
    };

    try {
      // Fetch full form data to get all items
      const res = await fetch(getApiUrl(`/api/orders/status?t=${Date.now()}`));
      const data = await res.json();
      
      let message = '';

      if (!data.activeForm || !data.activeForm.items) {
        // Fallback
        message = `จัดสินค้าเรียบร้อย\nเลขออเดอร์ ที่ : ${status.activeForm.docNum}\nชื่อร้านค้า : ${status.activeForm.customer}\n(ไม่พบรายการสินค้า)\n\nโปรดแจ้งเลขออเดอร์ทุกครั้ง เมื่อมารับสินค้าที่คลังสินค้า\nขอบคุณครับ`;
      } else {
          // Build message
          message = 'จัดสินค้าเรียบร้อย\n';
          
          const items = data.activeForm.items || [];
          const orderNumbers = [...new Set(items.map((item: any) => item.orderNo).filter((o: any) => o))];
          const orderNumText = orderNumbers.length > 0 ? orderNumbers.join(', ') : '-';
          
          message += `เลขออเดอร์ ที่ : ${orderNumText}\n`;
          message += `ชื่อร้านค้า : ${data.activeForm.customer}\n`;
          
          items.forEach((item: any) => {
            if (item.itemCode) {
              const formattedCode = formatItemCode(item.itemCode);
              message += `${formattedCode} = ${item.qty || 0}\n`;
            }
          });
          
          message += '\nโปรดแจ้งเลขออเดอร์ทุกครั้ง เมื่อมารับสินค้าที่คลังสินค้า\nขอบคุณครับ';
      }
      
      setPreviewMessage(message);

    } catch (error) {
      console.error('Error preparing LINE message:', error);
      alert('Error preparing message');
    }
  };


  const handleFinalize = async () => {
    if (!status.activeForm || !signatureData) {
      alert(t('mobile_sign_complete') + ' first'); // Reuse "Sign first" if needed or use mobile string
      return;
    }

    setLoadingAction('finalize');
    try {
      const res = await fetch(getApiUrl('/api/orders/finalize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docNum: status.activeForm.docNum,
          signature: signatureData
        })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Server error ' + res.status));
      }
    } catch (error) {
      console.error(error);
      alert('Error: ' + error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRecall = async (docNum: string) => {
    if (!confirm(`${t('recall_btn')} ${docNum}?`)) return;

    setLoadingAction('recall');
    try {
      const res = await fetch(getApiUrl('/api/orders/recall'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docNum })
      });

      if (res.ok) {
        alert(t('success_inbound') || 'Success'); // Generic success
        await fetchStatus();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Unknown'));
      }
    } catch (error) {
      console.error(error);
      alert('Network Error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleClear = async () => {
    if (!confirm(t('confirm_prompt') + ' clear?')) return;

    setLoadingAction('clear');
    try {
      const res = await fetch(getApiUrl('/api/orders/archive'), {
        method: 'POST'
      });

      if (res.ok) {
        alert('Cleared');
        setSignatureData(null);
        await fetchStatus();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Unknown'));
      }
    } catch (error) {
      console.error(error);
      alert('Connection Error');
    } finally {
      setLoadingAction(null);
    }
  };

  // ========== RENDER ==========

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Email Automation */}
      <EmailScanCard onComplete={fetchStatus} />

      {/* Pending Orders */}
      <PendingOrdersCard 
        tasks={status.pending}
        onProcess={handleProcessRollTag}
        onPrint={handlePrint}
        processing={!!loadingAction}
      />

      {/* Active Job */}
      <ActiveJobCard
        activeForm={status.activeForm}
        signatureData={signatureData}
        onCopyLine={handleCopyLineMsg}
        onSignature={() => setShowSignatureModal(true)}
        onFinalize={handleFinalize}
        onClear={handleClear}
        loadingAction={loadingAction}
        onRefresh={() => fetchStatus(true)}
      />

      {/* Waiting for Loading */}
      <WaitingJobsCard
        jobs={status.waiting}
        onRecall={handleRecall}
      />

      {/* Completed Jobs */}
      <CompletedJobsCard jobs={status.completed} />

      {/* Signature Modal */}
      {showSignatureModal && (
        <SignatureModal
          isOpen={showSignatureModal}
          docNum="ADMIN-SIGN"
          onClose={() => setShowSignatureModal(false)}
          onSave={async (sig) => {
            setSignatureData(sig);
            setShowSignatureModal(false);
          }}
        />
      )}

      {/* LINE Preview Modal */}
      {previewMessage && (
        <LinePreviewModal
          message={previewMessage}
          onClose={() => setPreviewMessage(null)}
        />
      )}

      {/* PDF Ready Modal */}
      {pdfUrl && (
        <PdfReadyModal 
            url={pdfUrl} 
            onClose={async () => {
                setPdfUrl(null);
                setSignatureData(null);
                await fetchStatus();
            }} 
        />
      )}

    </div>
  );
}



// ... existing cards ...

// ============================================================================
// LINE PREVIEW MODAL
// ============================================================================

function LinePreviewModal({ message, onClose }: { message: string; onClose: () => void }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      alert('Copied!');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to copy');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-green-400" />
            LINE Message Preview
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <textarea 
            className="w-full h-64 bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-300 font-mono text-sm resize-none focus:ring-1 focus:ring-green-500 outline-none"
            value={message}
            readOnly
          />
        </div>

        <div className="p-4 border-t border-slate-700 grid grid-cols-2 gap-3 bg-slate-800/30">
          <button 
            onClick={onClose}
            className="py-3 rounded-xl font-bold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <button 
            onClick={handleCopy}
            className="bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Copy Text
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EMAIL SCAN CARD
// ============================================================================

function EmailScanCard({ onComplete }: { onComplete: () => void }) {
  const { t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState('');

  const handleScan = async () => {
    setScanning(true);
    setMessage(t('scanning'));

    try {
      const res = await fetch(getApiUrl('/api/email/scan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => null);

      if (!res) {
        setMessage('Network Error');
        return;
      }

      const data = await res.json();

      if (data.success) {
        setMessage(`Success! Processed ${data.processed || 0}`);
        onComplete?.();
      } else {
        setMessage(`Error: ${data.error || 'Unknown Error'}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message || 'Connection Error'}`);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Mail className="w-5 h-5 text-purple-600" />
        {t('email_automation')}
      </h2>

      <div className="text-center py-8">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className={`w-8 h-8 text-purple-600 ${scanning ? 'animate-spin' : ''}`} />
        </div>
        <p className="text-slate-500 text-sm mb-4">{t('scan_from_email')}</p>
        
        <button
          onClick={handleScan}
          disabled={scanning}
          className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {scanning ? t('scanning') : t('start_scan')}
        </button>

        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            message.includes('Success') || message.includes('สำเร็จ') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PENDING ORDERS CARD
// ============================================================================

function PendingOrdersCard({ 
  tasks, 
  onProcess, 
  onPrint,
  processing 
}: { 
  tasks: RollTag[];
  onProcess: (id: string) => void;
  onPrint: (id: string) => void;
  processing: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <FileText className={`w-5 h-5 text-blue-600 ${processing ? 'animate-spin' : ''}`} />
        {t('pending_orders')}
        {tasks.length > 0 && (
          <span className="ml-auto bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded-full">
            {tasks.length}
          </span>
        )}
      </h2>

      {tasks.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('no_pending_orders')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-slate-800 font-semibold">{task.customer}</p>
                  <p className="text-slate-500 text-sm">{task.itemCount} Items</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onPrint(task.id)}
                  className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Printer className="w-3 h-3" />
                  {t('print_btn')}
                </button>
                <button
                  onClick={() => onProcess(task.id)}
                  disabled={processing}
                  className="bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  {processing ? t('processing') : t('process_btn')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ACTIVE JOB CARD
// ============================================================================

function ActiveJobCard({
  activeForm,
  signatureData,
  onCopyLine,
  onSignature,
  onFinalize,
  onClear,
  loadingAction,
  onRefresh
}: {
  activeForm: ActiveForm | null;
  signatureData: string | null;
  onCopyLine: () => void;
  onSignature: () => void;
  onFinalize: () => void;
  onClear: () => void;
  loadingAction: string | null;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const isFinalizing = loadingAction === 'finalize';
  const isClearing = loadingAction === 'clear';
  const isLoading = !!loadingAction;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {t('active_job')}
          </h2>
          {activeForm && (
             <button onClick={onRefresh} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors" title="Refresh Status">
                <RefreshCw className={`w-4 h-4 text-slate-400 ${loadingAction === 'refresh' ? 'animate-spin' : ''}`} />
             </button>
          )}
      </div>

      {!activeForm ? (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('ready_active')}</p>
        </div>
      ) : (
        <div>
          {/* Job Info */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 mb-4 border border-blue-100">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-slate-400 text-xs">{t('col_doc')}</p>
                <p className="text-slate-900 font-mono font-bold">{activeForm.docNum}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">{t('col_status')}</p>
                <p className="text-green-600 font-semibold">{activeForm.status}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Customer</p>
                <p className="text-slate-900 font-semibold">{activeForm.customer}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs text-right">{t('found_date')}</p>
                <p className="text-slate-700 font-mono text-right">{activeForm.refDate}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={onCopyLine}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              {t('copy_line')}
            </button>
            <button
              onClick={onSignature}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              {signatureData ? `✓ ${t('signed_status')}` : `✍️ ${t('sign_btn')}`}
            </button>
            <button
              onClick={onClear}
              disabled={isLoading}
              className="bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isClearing ? <Loader2 className="w-3 h-3 animate-spin"/> : <X className="w-3 h-3" />}
              {isClearing ? t('processing') : t('clear_btn')}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">

              <button
                onClick={onFinalize}
                disabled={isLoading}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                    ${!signatureData 
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700 hover:text-slate-300' 
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/20'
                    }
                    ${isLoading ? 'opacity-70 cursor-wait' : ''}
                `}
              >
                {isFinalizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                {isFinalizing ? t('processing') : t('finalize_print')}
              </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WAITING JOBS CARD
// ============================================================================

function WaitingJobsCard({
  jobs,
  onRecall
}: {
  jobs: WaitingJob[];
  onRecall: (docNum: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm lg:col-span-3">
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Truck className="w-5 h-5 text-orange-500" />
        {t('waiting_loading')}
        {jobs.length > 0 && (
          <span className="ml-2 bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full">
            {jobs.length}
          </span>
        )}
      </h2>

      {jobs.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Truck className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('no_waiting_jobs')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <div key={job.docNum} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-900 font-bold">{job.docNum}</p>
                <p className="text-slate-500 text-sm">{job.date}</p>
              </div>
              {job.orderNo && (
                 <div className="mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PO Ref:</span>
                    <p className="text-indigo-600 font-bold text-sm">{job.orderNo}</p>
                 </div>
              )}
              <p className="text-slate-600 text-sm mb-3">{job.customer}</p>
              <button
                onClick={() => onRecall(job.docNum)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-bold shadow-sm"
              >
                {t('recall_btn')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPLETED JOBS CARD
// ============================================================================

function CompletedJobsCard({ jobs }: { jobs: CompletedJob[] }) {
  const { t } = useLanguage();
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm lg:col-span-3">
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-green-500" />
        {t('completed_jobs')}
        {jobs.length > 0 && (
          <span className="ml-2 bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full">
            {jobs.length}
          </span>
        )}
      </h2>
      
      {/* List implementation similar to WaitingJobsCard but with PDF link */}
      {jobs.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('no_logs')}</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => (
                <div key={job.docNum} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                             <p className="text-slate-900 font-bold">{job.docNum}</p>
                             <p className="text-slate-500 text-xs">{job.date}</p>
                        </div>
                        <a href={job.pdfLink} target="_blank" className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded text-slate-700 font-bold transition-colors">
                            PDF
                        </a>
                    </div>
                    {job.orderNo && (
                        <div className="mb-2">
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PO Ref:</span>
                           <p className="text-indigo-600 font-bold text-sm">{job.orderNo}</p>
                        </div>
                     )}
                    <p className="text-slate-700 text-sm">{job.customer}</p>
                </div>
              ))}
          </div>
      )}
    </div>
  );
}

function PdfReadyModal({ url, onClose }: { url: string, onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center">
                 <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                     <CheckCircle className="w-8 h-8 text-green-600" />
                 </div>
                 <h2 className="text-xl font-bold text-slate-800 mb-2">PDF Ready!</h2>
                 <p className="text-slate-500 mb-6">Document has been finalized.</p>
                 
                 <div className="space-y-3">
                     <a href={url} target="_blank" className="block w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors">
                         Open PDF
                     </a>
                     <button onClick={onClose} className="block w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors">
                         Close
                     </button>
                 </div>
             </div>
        </div>
    )
}
