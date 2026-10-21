'use client';

import { useState } from 'react';
import { X, Plus, Trash2, MapPin, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getApiUrl } from '@/lib/config';
import type { ExtraLocation } from '@/lib/warehouseLayoutMap';

/**
 * Split one product across bins without touching stock or history:
 * the user lists the EXTRA bins and their quantities; the product's own
 * location (main bin) automatically holds the rest of the total.
 */
export default function ExtraLocationsModal({
  product,
  extras,
  binOptions,
  branchId,
  onClose,
  onSaved,
}: {
  product: { name: string; stock: number; location: string; unit?: string };
  extras: ExtraLocation[];
  binOptions: string[];
  branchId: string;
  onClose: () => void;
  onSaved: (rows: ExtraLocation[]) => void;
}) {
  const [rows, setRows] = useState<{ location: string; qty: string }[]>(
    extras.length ? extras.map(e => ({ location: e.location, qty: String(e.qty) })) : [{ location: '', qty: '' }],
  );
  const [saving, setSaving] = useState(false);

  const total = Number(product.stock || 0);
  const main = String(product.location || '').trim().toUpperCase() || '-';
  const extraSum = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const mainQty = total - extraSum;
  const dupMain = rows.some(r => r.location.trim().toUpperCase() === main && main !== '-');

  const update = (i: number, patch: Partial<{ location: string; qty: string }>) =>
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (mainQty < 0) {
      toast.error(`ยอดโลเคชันเสริมรวม ${extraSum} มากกว่ายอดสต็อก ${total}`);
      return;
    }
    if (dupMain) {
      toast.error(`${main} เป็นโลเคชันหลักอยู่แล้ว`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(getApiUrl('/api/products/extra-locations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          product: product.name,
          mainLocation: main,
          locations: rows.map(r => ({ location: r.location, qty: Number(r.qty) || 0 })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        toast.success('บันทึกโลเคชันเสริมแล้ว');
        onSaved(Array.isArray(data.rows) ? data.rows : []);
        onClose();
      } else {
        toast.error(data?.error || 'บันทึกไม่สำเร็จ');
      }
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-black text-slate-900">แบ่งเก็บหลายโลเคชัน</h3>
            <p className="text-xs text-slate-500 truncate">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
            <span className="text-[10px] text-slate-500 block">ยอดสต็อกรวม (จากประวัติ)</span>
            <span className="font-mono font-black text-slate-900 text-base">{total.toLocaleString()}</span>
            <span className="text-slate-500"> {product.unit || ''}</span>
          </div>
          <div className={`rounded-xl border p-2.5 ${mainQty < 0 ? 'bg-rose-50 border-rose-200' : 'bg-teal-50 border-teal-200'}`}>
            <span className="text-[10px] text-slate-500 block">โลเคชันหลัก {main} (คำนวณให้)</span>
            <span className={`font-mono font-black text-base ${mainQty < 0 ? 'text-rose-600' : 'text-teal-700'}`}>
              {mainQty.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-600">โลเคชันเสริม</span>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="relative flex-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={r.location}
                  list="extra-location-bins"
                  onChange={e => update(i, { location: e.target.value.toUpperCase() })}
                  placeholder="เช่น C-002"
                  className="w-full pl-8 pr-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono font-bold focus:border-teal-500 outline-none"
                />
              </div>
              <input
                value={r.qty}
                onChange={e => update(i, { qty: e.target.value.replace(/[^\d.]/g, '') })}
                inputMode="decimal"
                placeholder="จำนวน"
                className="w-24 px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono font-bold text-right focus:border-teal-500 outline-none"
              />
              <button
                onClick={() => setRows(rs => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ location: '', qty: '' }]))}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                aria-label="ลบแถว"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <datalist id="extra-location-bins">
            {binOptions.map(b => <option key={b} value={b} />)}
          </datalist>
          <button
            onClick={() => setRows(rs => [...rs, { location: '', qty: '' }])}
            className="text-xs font-bold text-teal-700 flex items-center gap-1 hover:text-teal-800"
          >
            <Plus className="w-3.5 h-3.5" /> เพิ่มโลเคชัน
          </button>
        </div>

        {(mainQty < 0 || dupMain) && (
          <p className="text-[11px] text-rose-600 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {dupMain ? `${main} เป็นโลเคชันหลักอยู่แล้ว ไม่ต้องใส่ซ้ำ` : 'ยอดโลเคชันเสริมรวมมากกว่ายอดสต็อก'}
          </p>
        )}
        <p className="text-[10px] text-slate-400 leading-relaxed">
          ไม่แก้ยอดสต็อก สูตร หรือประวัติรับ-จ่าย • เก็บในชีตแท็บ Config_ProductLocations • เมื่อเบิกออก ยอดโลเคชันหลักจะลดลงเอง ถ้าเบิกจากโลเคชันเสริมให้มาแก้ยอดที่นี่
        </p>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200">
            ยกเลิก
          </button>
          <button
            onClick={save}
            disabled={saving || mainQty < 0 || dupMain}
            className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-black hover:bg-teal-500 disabled:opacity-40"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}
