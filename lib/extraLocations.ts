/**
 * "Extra locations" — a product stored in more than one bin, e.g. 186 pcs as
 * C-001 (main) + C-002 = 128.
 *
 * Only the EXTRA bins and their quantities are stored, in the branch's
 * inventory spreadsheet (tab "Config_ProductLocations"). The product's own
 * location column stays its main bin, and the main bin's quantity is always
 * total stock − extras. Total stock keeps coming from the existing formulas
 * and transaction history, so nothing there changes.
 *
 * Outbound / approved damage that is picked from an extra bin reduces that
 * bin here (consumeExtraLocation); anything picked from the main bin needs
 * nothing, because the main bin is the remainder.
 */
import {
  ensureSheetExists,
  getSheetData,
  updateSheetData,
  clearSheetRange,
} from '@/lib/googleSheets';

export const EXTRA_LOCATIONS_SHEET = 'Config_ProductLocations';
const HEADERS = ['ชื่อสินค้า', 'โลเคชันเสริม', 'จำนวน', 'อัปเดตเมื่อ', 'โดย'];

export interface ExtraLocationRow {
  product: string; // product name (the key the transaction history uses)
  location: string;
  qty: number;
}
export type StoredExtraRow = ExtraLocationRow & { updatedAt: string; by: string };

const norm = (s: unknown) => String(s ?? '').trim();
export const normLoc = (s: unknown) => norm(s).toUpperCase();
// Keep Sheets from turning "001" into 1 or "=x" into a formula
const asText = (s: string) => `'${s}`;

export async function readExtraRows(ssid: string): Promise<StoredExtraRow[]> {
  await ensureSheetExists(ssid, EXTRA_LOCATIONS_SHEET, HEADERS);
  const rows = await getSheetData(ssid, `'${EXTRA_LOCATIONS_SHEET}'!A2:E`);
  return rows
    .map(r => ({
      product: norm(r[0]),
      location: normLoc(r[1]),
      qty: Number(String(r[2] ?? '').replace(/,/g, '')) || 0,
      updatedAt: norm(r[3]),
      by: norm(r[4]),
    }))
    .filter(r => r.product && r.location && r.qty > 0);
}

export async function writeExtraRows(ssid: string, rows: StoredExtraRow[]): Promise<void> {
  const keep = rows.filter(r => r.product && r.location && r.qty > 0);
  const values = keep.map(r => [asText(r.product), asText(r.location), r.qty, r.updatedAt, r.by]);
  if (values.length > 0) await updateSheetData(ssid, `'${EXTRA_LOCATIONS_SHEET}'!A2:E${values.length + 1}`, values);
  await clearSheetRange(ssid, `'${EXTRA_LOCATIONS_SHEET}'!A${values.length + 2}:E`);
}

export const toPublicRows = (rows: StoredExtraRow[]): ExtraLocationRow[] =>
  rows.map(({ product, location, qty }) => ({ product, location, qty }));

/**
 * Take `qty` of `product` out of an extra bin. A bin that isn't one of the
 * product's extras (i.e. its main bin, or blank) is a no-op. Never goes below 0;
 * returns how much was actually taken from the extra bin.
 */
export async function consumeExtraLocation(
  ssid: string, product: string, location: string, qty: number, by = '',
): Promise<{ taken: number; isExtra: boolean }> {
  const loc = normLoc(location);
  const name = norm(product);
  const want = Math.max(0, Number(qty) || 0);
  if (!loc || !name || want <= 0) return { taken: 0, isExtra: false };
  const rows = await readExtraRows(ssid);
  const row = rows.find(r => r.product === name && r.location === loc);
  if (!row) return { taken: 0, isExtra: false };
  const taken = Math.min(row.qty, want);
  row.qty -= taken;
  row.updatedAt = new Date().toISOString();
  row.by = by || row.by;
  await writeExtraRows(ssid, rows);
  return { taken, isExtra: true };
}

/** Put `qty` back into an extra bin (e.g. a damage approval was reverted). */
export async function restoreExtraLocation(
  ssid: string, product: string, location: string, qty: number, by = '',
): Promise<void> {
  const loc = normLoc(location);
  const name = norm(product);
  const add = Math.max(0, Number(qty) || 0);
  if (!loc || !name || add <= 0) return;
  const rows = await readExtraRows(ssid);
  const now = new Date().toISOString();
  const row = rows.find(r => r.product === name && r.location === loc);
  if (row) { row.qty += add; row.updatedAt = now; row.by = by || row.by; }
  else rows.push({ product: name, location: loc, qty: add, updatedAt: now, by });
  await writeExtraRows(ssid, rows);
}
