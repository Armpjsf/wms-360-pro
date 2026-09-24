import { NextResponse } from 'next/server';
import { resolveSpreadsheetId } from '@/lib/googleSheets';
import {
    withFormLock,
    setDocsStatus,
    lockErrorStatus,
    STATUS_PREPARED,
    getActiveJobDocNum,
    setActiveJobDocNum,
} from '@/lib/orderUtils';

export const dynamic = 'force-dynamic';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// "จัดสินค้าเสร็จ" -> สถานะงานเป็น "รอลูกค้า"
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { branchId } = body;
    const requested: string[] = (Array.isArray(body.docNums) ? body.docNums : body.docNum ? [body.docNum] : [])
      .map((d: any) => String(d || '').trim())
      .filter(Boolean);

    const ssid = await resolveSpreadsheetId(branchId, 'doc');

    const result = await withFormLock(ssid, async () => {
      const active = await getActiveJobDocNum(ssid);
      const targets = requested.length > 0 ? Array.from(new Set(requested)) : (active ? [active] : []);

      if (targets.length === 0) {
        return { updated: [], notFound: [], skipped: [] };
      }

      const res = await setDocsStatus(ssid, targets, STATUS_PREPARED);

      if (active && targets.includes(active)) {
        await setActiveJobDocNum(ssid, "");
      }

      return res;
    });

    console.log(`[Archive] Marked prepared:`, result);
    return NextResponse.json({ success: true, ...result }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Archive API Error:", error);
    return NextResponse.json({ error: error.message }, { status: lockErrorStatus(error), headers: corsHeaders });
  }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export const maxDuration = 60;
