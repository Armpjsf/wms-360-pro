import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  resolveSpreadsheetId,
  ensureSheetExists,
  getSheetData,
  updateSheetData,
  clearSheetRange,
} from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

/**
 * "Extra locations" — a product stored in more than one bin, e.g. 186 pcs as
 * C-001 (main) + C-002 = 128.
 *
 * Only the EXTRA bins and their quantities are stored here, in the branch's
 * inventory spreadsheet (tab "Config_ProductLocations"). The product's own
 * location column stays its main bin, and the main bin's quantity is always
 * total stock − extras. Total stock keeps coming from the existing formulas
 * and transaction history, so nothing there changes.
 */
const SHEET = 'Config_ProductLocations';
const HEADERS = ['ชื่อสินค้า', 'โลเคชันเสริม', 'จำนวน', 'อัปเดตเมื่อ', 'โดย'];

export interface ExtraLocationRow {
  product: string; // product name (the key the transaction history uses)
  location: string;
  qty: number;
}
type StoredRow = ExtraLocationRow & { updatedAt: string; by: string };

const norm = (s: unknown) => String(s ?? '').trim();
const normLoc = (s: unknown) => norm(s).toUpperCase();
// Keep Sheets from turning "001" into 1 or "=x" into a formula
const asText = (s: string) => `'${s}`;

async function readAll(ssid: string): Promise<StoredRow[]> {
  await ensureSheetExists(ssid, SHEET, HEADERS);
  const rows = await getSheetData(ssid, `'${SHEET}'!A2:E`);
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

export async function GET(req: NextRequest) {
  try {
    const branchId = new URL(req.url).searchParams.get('branchId');
    const ssid = await resolveSpreadsheetId(branchId, 'inventory');
    const rows: ExtraLocationRow[] = (await readAll(ssid)).map(({ product, location, qty }) => ({ product, location, qty }));
    return NextResponse.json({ success: true, rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/** Replace one product's extra locations: { branchId, product, mainLocation?, locations: [{ location, qty }] } */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (String(user.role || '') === 'Viewer') {
      return NextResponse.json({ success: false, error: 'สิทธิ์ Viewer แก้ไขโลเคชันไม่ได้' }, { status: 403 });
    }

    const body = await req.json();
    const product = norm(body.product);
    const mainLocation = normLoc(body.mainLocation);
    if (!product) return NextResponse.json({ success: false, error: 'ไม่ได้ระบุสินค้า' }, { status: 400 });

    // merge duplicates, drop blanks, never store the main bin as an "extra"
    const merged = new Map<string, number>();
    for (const l of Array.isArray(body.locations) ? body.locations : []) {
      const loc = normLoc(l?.location);
      const qty = Number(l?.qty) || 0;
      if (!loc) continue;
      if (qty < 0) return NextResponse.json({ success: false, error: `จำนวนที่ ${loc} ติดลบไม่ได้` }, { status: 400 });
      if (loc === mainLocation) {
        return NextResponse.json({ success: false, error: `${loc} เป็นโลเคชันหลักอยู่แล้ว — ยอดโลเคชันหลักคำนวณให้อัตโนมัติ` }, { status: 400 });
      }
      if (qty > 0) merged.set(loc, (merged.get(loc) || 0) + qty);
    }

    const ssid = await resolveSpreadsheetId(body.branchId, 'inventory');
    const now = new Date().toISOString();
    const by = norm(user.name || user.username || user.email);
    const others = (await readAll(ssid)).filter(r => r.product !== product);
    const mine: StoredRow[] = Array.from(merged, ([location, qty]) => ({ product, location, qty, updatedAt: now, by }));
    const all = [...others, ...mine];
    const values = all.map(r => [asText(r.product), asText(r.location), r.qty, r.updatedAt, r.by]);

    if (values.length > 0) await updateSheetData(ssid, `'${SHEET}'!A2:E${values.length + 1}`, values);
    await clearSheetRange(ssid, `'${SHEET}'!A${values.length + 2}:E`);

    return NextResponse.json({ success: true, rows: all.map(({ product, location, qty }) => ({ product, location, qty })) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
