'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import type { ExtraLocationRow } from '@/lib/extraLocations';

/** Extra locations (Config_ProductLocations) for the forms that issue stock. */
export function useExtraLocations(branchId?: string | null) {
  const [rows, setRows] = useState<ExtraLocationRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    const q = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    fetch(getApiUrl(`/api/products/extra-locations${q}`))
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d?.success && Array.isArray(d.rows)) setRows(d.rows); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [branchId]);
  return rows;
}

/**
 * "Pick from which bin?" — only rendered when the product is split across bins.
 * Value "" = the main location (whose quantity is total − extras, so it needs no
 * bookkeeping); an extra bin's code = that bin gets reduced when the stock goes out.
 */
export default function PickLocationSelect({
  product,
  extras,
  value,
  onChange,
  className = '',
}: {
  product?: { name: string; location?: string; stock?: number } | null;
  extras: ExtraLocationRow[];
  value: string;
  onChange: (location: string) => void;
  className?: string;
}) {
  if (!product) return null;
  const mine = extras.filter(e => e.product === product.name);
  if (mine.length === 0) return null;

  const main = String(product.location || '').trim().toUpperCase() || 'โลเคชันหลัก';
  const mainQty = Math.max(0, Number(product.stock || 0) - mine.reduce((s, e) => s + e.qty, 0));

  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-xs font-bold text-teal-700 mb-1.5">
        <MapPin className="w-3.5 h-3.5" /> หยิบจากโลเคชัน
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm font-mono font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
      >
        <option value="">{main} — โลเคชันหลัก (~{mainQty.toLocaleString()})</option>
        {mine.map(e => (
          <option key={e.location} value={e.location}>
            {e.location} — โลเคชันเสริม ({e.qty.toLocaleString()})
          </option>
        ))}
      </select>
      <p className="text-[10px] text-slate-500 mt-1">สินค้านี้เก็บหลายโลเคชัน เลือกที่หยิบจริง ระบบจะตัดยอดโลเคชันนั้นให้</p>
    </div>
  );
}
