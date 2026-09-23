import { NextResponse } from 'next/server';
import { getSheetData, resolveSpreadsheetId } from '@/lib/googleSheets';
import {
    withFormLock,
    archiveCurrentForm,
    setDocsStatus,
    lockErrorStatus,
    FORM_SHEET,
    STATUS_PREPARED,
} from '@/lib/orderUtils';

export const dynamic = 'force-dynamic';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// "จัดสินค้าเสร็จ" -> สถานะงานเป็น "รอลูกค้า"
// body: { docNum } | { docNums: [...] } — ต้องระบุงานเสมอ
// (เดิมไม่รับ docNum แล้วไปปิดงานที่อยู่ใน G3 ตอนนั้น ซึ่งอาจเป็นงานใหม่ที่แอดมินเพิ่งกดเข้ามา)
// ไม่ระบุงาน = รูปแบบเก่า (คิวออฟไลน์ค้างในเครื่อง) -> ใช้งานที่อยู่บนฟอร์ม
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { branchId } = body;
    const requested: string[] = (Array.isArray(body.docNums) ? body.docNums : body.docNum ? [body.docNum] : [])
      .map((d: any) => String(d || '').trim())
      .filter(Boolean);

    const ssid = await resolveSpreadsheetId(branchId, 'doc');

    const result = await withFormLock(ssid, async () => {
      const active = String((await getSheetData(ssid, `${FORM_SHEET}!G3`))?.[0]?.[0] || '').trim();
      const targets = requested.length > 0 ? Array.from(new Set(requested)) : (active ? [active] : []);

      const updated: string[] = [];
      // งานที่อยู่บนฟอร์ม: เก็บกลับคลังข้อมูล (รวมที่แก้ในฟอร์ม) + ล้างฟอร์ม
      if (active && targets.includes(active)) {
        await archiveCurrentForm(STATUS_PREPARED, undefined, ssid);
        updated.push(active);
      }
      // งานอื่นๆ: เปลี่ยนสถานะในแถวเดิม ไม่แตะฟอร์ม
      const others = targets.filter((d) => d !== active);
      const res = others.length > 0
        ? await setDocsStatus(ssid, others, STATUS_PREPARED)
        : { updated: [], notFound: [], skipped: [] };

      return { updated: [...updated, ...res.updated], notFound: res.notFound, skipped: res.skipped };
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
