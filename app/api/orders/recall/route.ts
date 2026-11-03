import { NextResponse } from 'next/server';
import { resolveSpreadsheetId } from '@/lib/googleSheets';
import { invalidateStatusCache } from '@/lib/orderStatusCache';
import { withFormLock, restoreOrderToForm, lockErrorStatus } from '@/lib/orderUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// แอดมินเรียกงานจากคิวกลับขึ้นฟอร์ม (ใช้ logic เดียวกับ /api/jobs/restore ของมือถือ)
export async function POST(request: Request) {
  try {
      const { docNum, branchId } = await request.json();
      if (!docNum) return NextResponse.json({ error: "Missing DocNum" }, { status: 400, headers: corsHeaders });

      const ssid = await resolveSpreadsheetId(branchId, 'doc');
      invalidateStatusCache(ssid);
      const result = await withFormLock(ssid, () => restoreOrderToForm(docNum, ssid));

      return NextResponse.json(result, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Recall Error:", error);
    const status = /not found/i.test(error?.message || '') ? 404 : lockErrorStatus(error);
    return NextResponse.json({ error: error.message }, { status, headers: corsHeaders });
  }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export const maxDuration = 60;
