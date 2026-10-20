import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  SPREADSHEET_ID,
  ensureSheetExists,
  getSheetData,
  updateSheetData,
  appendSheetRow,
} from '@/lib/googleSheets';
import { RackConfig, WarehouseLayout, validateLayout } from '@/lib/warehouseLayout';

export type { RackConfig, WarehouseLayout as WarehouseLayoutPayload } from '@/lib/warehouseLayout';

export const dynamic = 'force-dynamic';

/**
 * Branch warehouse layouts for the 2D/3D map, stored in the main spreadsheet:
 * one row per branch in "Config_WarehouseLayout". The racks are JSON; a cell
 * holds at most 50,000 characters, so long layouts continue in the next
 * columns (RacksJSON, then H, I, …) and are joined back on read.
 */
const SHEET = 'Config_WarehouseLayout';
const HEADERS = ['BranchID', 'Name', 'WidthM', 'LengthM', 'HeightM', 'UpdatedAt', 'UpdatedBy', 'RacksJSON'];
const JSON_COL = 7; // zero-based index of RacksJSON (column H)
const CHUNK = 45000;
const MAX_CHUNKS = 10;

const DEFAULT_BRANCH = 'hq';

function colLetter(n: number): string {
  let s = '';
  let x = n + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

async function readRows(): Promise<any[][]> {
  await ensureSheetExists(SPREADSHEET_ID, SHEET, HEADERS);
  return getSheetData(SPREADSHEET_ID, `'${SHEET}'!A:${colLetter(JSON_COL + MAX_CHUNKS - 1)}`);
}

function findRow(rows: any[][], branchId: string): number {
  // returns the 0-based index in `rows` (row 0 = header), or -1
  return rows.findIndex((r, i) => i > 0 && String(r[0] || '').trim().toLowerCase() === branchId.toLowerCase());
}

export async function GET(req: NextRequest) {
  try {
    const branchId = new URL(req.url).searchParams.get('branchId') || DEFAULT_BRANCH;
    const rows = await readRows();
    const idx = findRow(rows, branchId);
    const row = idx > 0 ? rows[idx] : null;

    let racks: RackConfig[] = [];
    if (row) {
      const json = row.slice(JSON_COL).map(c => String(c ?? '')).join('');
      try {
        const parsed = JSON.parse(json || '[]');
        if (Array.isArray(parsed)) racks = parsed;
      } catch {
        return NextResponse.json({ success: false, error: `อ่านผังของสาขา ${branchId} ไม่ได้ (ข้อมูลในชีต ${SHEET} เสีย)` }, { status: 500 });
      }
    }

    const data: WarehouseLayout & { saved: boolean; legacyFrom: null } = {
      branchId,
      name: String(row?.[1] || `คลังสินค้าสาขา ${branchId}`),
      widthM: Number(row?.[2]) || 60,
      lengthM: Number(row?.[3]) || 80,
      heightM: Number(row?.[4]) || 12,
      racks,
      saved: !!row,
      legacyFrom: null,
    };
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    const role = String(user?.role || '');
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (role === 'Viewer' || role === 'User') {
      return NextResponse.json({ success: false, error: 'ต้องเป็นผู้ดูแลหรือหัวหน้างานจึงจะบันทึกผังคลังได้' }, { status: 403 });
    }

    const body: Partial<WarehouseLayout> = await req.json();
    const branchId = String(body.branchId || DEFAULT_BRANCH).trim() || DEFAULT_BRANCH;
    const racks: RackConfig[] = Array.isArray(body.racks) ? body.racks : [];

    const problems = validateLayout(racks);
    if (problems.length) {
      return NextResponse.json({ success: false, error: problems.join(' • ') }, { status: 400 });
    }

    const json = JSON.stringify(racks);
    const chunks: string[] = [];
    for (let i = 0; i < json.length; i += CHUNK) chunks.push(json.slice(i, i + CHUNK));
    if (chunks.length === 0) chunks.push('[]');
    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json({ success: false, error: 'ผังใหญ่เกินกว่าที่ Google Sheet เก็บได้ — ลดจำนวนแร็กหรือช่องพิเศษ' }, { status: 400 });
    }
    // pad so stale chunks from a previously longer layout get cleared
    while (chunks.length < MAX_CHUNKS) chunks.push('');

    const rowValues = [
      branchId,
      String(body.name || `คลังสินค้าสาขา ${branchId}`),
      Number(body.widthM) || 60,
      Number(body.lengthM) || 80,
      Number(body.heightM) || 12,
      new Date().toISOString(),
      String(user?.name || user?.username || user?.email || ''),
      // a leading apostrophe keeps Sheets from interpreting the JSON
      ...chunks.map(c => (c ? `'${c}` : '')),
    ];

    const rows = await readRows();
    const idx = findRow(rows, branchId);
    const lastCol = colLetter(JSON_COL + MAX_CHUNKS - 1);
    if (idx > 0) {
      await updateSheetData(SPREADSHEET_ID, `'${SHEET}'!A${idx + 1}:${lastCol}${idx + 1}`, [rowValues]);
    } else {
      await appendSheetRow(SPREADSHEET_ID, `'${SHEET}'!A:${lastCol}`, rowValues);
    }

    const bins = racks.reduce((n, r) => n + Math.max(1, r.bays) * Math.max(1, r.levels), 0);
    return NextResponse.json({
      success: true,
      message: `บันทึกผังคลังสาขา ${branchId} แล้ว • ${racks.length} แร็ก • ~${bins.toLocaleString()} โลเคชัน`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
