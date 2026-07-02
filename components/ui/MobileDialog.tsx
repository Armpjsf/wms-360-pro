'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

type DialogRequest = {
  type: 'alert' | 'confirm';
  message: string;
  resolve: (v: boolean) => void;
};

// Module-level bridge so plain functions (usable anywhere, incl. non-React
// code) can drive the host component. Falls back to native dialogs when no
// host is mounted (e.g. desktop pages).
let listener: ((r: DialogRequest) => void) | null = null;

export function appAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    if (!listener) { window.alert(message); resolve(); return; }
    listener({ type: 'alert', message, resolve: () => resolve() });
  });
}

export function appConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) { resolve(window.confirm(message)); return; }
    listener({ type: 'confirm', message, resolve });
  });
}

export default function MobileDialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(null);

  useEffect(() => {
    listener = setReq;
    return () => { listener = null; };
  }, []);

  if (!req) return null;

  const close = (v: boolean) => {
    req.resolve(v);
    setReq(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-6" onClick={() => close(false)}>
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
          req.type === 'confirm' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
        }`}>
          {req.type === 'confirm' ? <HelpCircle className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
        </div>
        <p className="text-slate-800 font-semibold text-center whitespace-pre-line leading-relaxed mb-6">
          {req.message}
        </p>
        {req.type === 'confirm' ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => close(false)}
              className="min-h-[52px] bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-2xl font-bold active:scale-95 transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => close(true)}
              className="min-h-[52px] bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl font-bold active:scale-95 transition-all"
            >
              ยืนยัน
            </button>
          </div>
        ) : (
          <button
            onClick={() => close(true)}
            className="w-full min-h-[52px] bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-2xl font-bold active:scale-95 transition-all"
          >
            ตกลง
          </button>
        )}
      </div>
    </div>
  );
}
