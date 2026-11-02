import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveSpreadsheetId } from '@/lib/googleSheets';
import { readExtraRows, writeExtraRows, toPublicRows, normLoc, StoredExtraRow } from '@/lib/extraLocations';

export const dynamic = 'force-dynamic';

// Storage + semantics live in lib/extraLocations.ts (main bin = total − extras).
const norm = (s: unknown) => String(s ?? '').trim();

export async function GET(req: NextRequest) {
  try {
    const branchId = new URL(req.url).searchParams.get('branchId');
    const ssid = await resolveSpreadsheetId(branchId, 'inventory');
    return NextResponse.json({ success: true, rows: toPublicRows(await readExtraRows(ssid)) });
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
    const others = (await readExtraRows(ssid)).filter(r => r.product !== product);
    const mine: StoredExtraRow[] = Array.from(merged, ([location, qty]) => ({ product, location, qty, updatedAt: now, by }));
    const all = [...others, ...mine];
    await writeExtraRows(ssid, all);

    return NextResponse.json({ success: true, rows: toPublicRows(all) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
