'use client';

import { getApiUrl } from '@/lib/config';
import { useState, useEffect } from 'react';
import { RefreshCw, User, Play, Undo2, CheckCircle2, Package, Inbox, Wifi, WifiOff, Check, Clock, MapPin } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import MobileNav from '@/components/MobileNav';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface RollTag { id: string; customer: string; itemCount: number; }
interface ActiveForm { docNum: string; customer: string; refDate?: string; status?: string; items?: any[]; signature?: string | null; }
interface WaitingJob { docNum: string; customer: string; orderNo?: string; }

export default function MobileOrdersPage() {
  const { t } = useLanguage();

  const [pending, setPending] = useState<RollTag[]>([]);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const [waiting, setWaiting] = useState<WaitingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null); // guards double-taps
  const [productLoc, setProductLoc] = useState<Map<string, string>>(new Map());

  const branchId = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('branchId') || 'hq')
    : 'hq';

  const fetchStatus = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/orders/status?branchId=${branchId}&t=${Date.now()}`), { cache: 'no-store' });
      if (res.ok) setIsConnected(true);
      const data = await res.json();
      setPending(data.pending || []);
      setActiveForm(data.activeForm || null);
      setWaiting(data.waiting || []);
    } catch (e) {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  // Load product locations for the item list
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/products'));
        const data = await res.json();
        if (Array.isArray(data)) {
          const map = new Map<string, string>();
          data.forEach((p: any) => map.set(p.name, p.location || '-'));
          setProductLoc(map);
        }
      } catch { /* offline: skip locations */ }
    })();
  }, []);

  const post = async (path: string, body: any, id: string) => {
    if (busyId) return;
    try {
      setBusyId(id);
      const res = await fetch(getApiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, branchId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      await fetchStatus();
    } catch (e: any) {
      alert('ผิดพลาด: ' + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleProcess = (tagId: string) => post('/api/orders/process', { tagId }, `process-${tagId}`);
  const handleRecall = (docNum: string) => {
    if (!confirm(`ดึงงาน ${docNum} กลับมาทำใหม่?`)) return;
    post('/api/orders/recall', { docNum }, `recall-${docNum}`);
  };
  const handleClear = () => {
    if (!confirm('ปิด/จัดเก็บงานที่กำลังทำอยู่?')) return;
    post('/api/orders/archive', {}, 'clear');
  };

  return (
    <div className="relative min-h-screen pb-24 bg-slate-50/50">
      <AmbientBackground />
      <div className="relative z-10 max-w-lg mx-auto p-4 md:p-6">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-white/50 shadow-sm sticky top-2 z-20">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('menu_orders')}</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${isConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? t('online') : t('offline')}
              </div>
            </div>
          </div>
          <button onClick={fetchStatus} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-500 shadow-sm active:scale-95">
            <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Active Job */}
        {activeForm && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3 px-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h2 className="text-emerald-600 font-bold uppercase tracking-wider text-xs">{t('active_job')}</h2>
            </div>
            <div className="bg-white border-2 border-indigo-100 rounded-[2rem] p-6 shadow-xl">
              <div className="text-3xl font-black text-slate-900 tracking-tighter mb-1">
                {(() => {
                  const orders = Array.from(new Set((activeForm.items || []).map((i: any) => i.orderNo).filter(Boolean)));
                  return orders.length ? orders.join(', ') : activeForm.docNum;
                })()}
              </div>
              <div className="text-[11px] text-slate-400 font-semibold mb-2">{t('doc_no')}: {activeForm.docNum}</div>
              <div className="flex items-center gap-2 text-indigo-600 font-medium text-sm bg-indigo-50 px-3 py-1.5 rounded-xl w-fit mb-4">
                <User className="w-4 h-4" /> {activeForm.customer}
              </div>

              {/* Item list */}
              {activeForm.items && activeForm.items.length > 0 && (
                <div className="space-y-2 mb-4 bg-slate-50 rounded-2xl p-3 border border-slate-100/50">
                  <div className="flex justify-between px-1">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{t('items_list')}</span>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{activeForm.items.length}</span>
                  </div>
                  {activeForm.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-900 font-bold text-sm truncate">{item.itemCode || item.description}</div>
                        {item.orderNo && <div className="text-slate-400 text-[11px]">Ref: {item.orderNo}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-slate-900 font-black text-lg leading-none">x{item.qty}</div>
                        <div className="text-orange-600 text-[10px] font-bold flex items-center justify-end gap-0.5 mt-1 bg-orange-50 px-1.5 py-0.5 rounded-lg border border-orange-100">
                          <MapPin className="w-3 h-3" /> {productLoc.get(item.itemCode || item.description) || '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Signature status (read-only) */}
              <div className={`mb-4 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border ${activeForm.signature ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                {activeForm.signature ? <><Check className="w-4 h-4" /> {t('signed_status')}</> : <><Clock className="w-4 h-4" /> รอลูกค้าเซ็นรับ</>}
              </div>

              <button
                onClick={handleClear}
                disabled={busyId === 'clear'}
                className="w-full min-h-[52px] bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                {busyId === 'clear' ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> {t('clear_btn')}</>}
              </button>
            </div>
          </div>
        )}

        {/* Pending roll tags -> Process to create a job */}
        <h2 className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-4 px-2">{t('menu_pending') || 'รอเปิดงาน'} ({pending.length})</h2>
        {pending.length === 0 && !loading ? (
          <div className="bg-white/80 border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center mb-8">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">ไม่มีรายการรอเปิดงาน</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {pending.map((tag) => (
              <div key={tag.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex justify-between items-center">
                <div className="min-w-0">
                  <div className="font-black text-slate-900 text-lg truncate">{tag.customer}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1"><Package className="w-3 h-3" /> {tag.itemCount} รายการ</div>
                </div>
                <button
                  onClick={() => handleProcess(tag.id)}
                  disabled={busyId === `process-${tag.id}`}
                  className="shrink-0 min-h-[48px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all"
                >
                  {busyId === `process-${tag.id}` ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Play className="w-4 h-4 fill-white" /> เปิดงาน</>}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Waiting jobs -> Recall */}
        {waiting.length > 0 && (
          <>
            <h2 className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-4 px-2">{t('ready_to_process') || 'รอโหลด'} ({waiting.length})</h2>
            <div className="space-y-3">
              {waiting.map((job) => (
                <div key={job.docNum} className="bg-white border-l-4 border-l-orange-400 border-y border-r border-slate-200 rounded-r-2xl p-4 shadow-sm flex justify-between items-center">
                  <div className="min-w-0">
                    <div className="font-black text-slate-900 text-lg truncate">{job.orderNo || job.docNum}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> {job.customer}</div>
                  </div>
                  <button
                    onClick={() => handleRecall(job.docNum)}
                    disabled={busyId === `recall-${job.docNum}`}
                    className="shrink-0 min-h-[48px] bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-60 px-5 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 active:scale-95"
                  >
                    {busyId === `recall-${job.docNum}` ? <div className="w-5 h-5 border-2 border-orange-300 border-t-orange-700 rounded-full animate-spin" /> : <><Undo2 className="w-4 h-4" /> ดึงกลับ</>}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
      <div className="fixed bottom-0 left-0 right-0 z-50"><MobileNav /></div>
    </div>
  );
}
