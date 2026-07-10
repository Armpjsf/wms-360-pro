import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FORM_SHEET = "ส่งสินค้า";
const DATA_SHEET = "คลังข้อมูล";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
  try {
    const { branchId } = await request.json().catch(() => ({}));

    const { resolveSpreadsheetId, getSheetData, findAllRowIndices, getGoogleSheets } = await import('@/lib/googleSheets');
    const { clearFormSheet } = await import('@/lib/orderUtils');
    const ssid = await resolveSpreadsheetId(branchId, 'doc');

    // 1. "จัดสินค้าเสร็จ" -> อัปเดตสถานะของงานที่ active ในคลังข้อมูลเป็น "รอลูกค้า"
    //    (เดิม route นี้แค่ล้างฟอร์ม ไม่แตะสถานะ ทำให้งานค้างที่ "กำลังดำเนินการ"/"กำลังแก้ไข" ตลอด = ข้อ 5)
    try {
      const dNum = await getSheetData(ssid, `${FORM_SHEET}!G3`);
      const docNum = dNum?.[0]?.[0];
      if (docNum && String(docNum).trim() !== "") {
        const rowIndices = await findAllRowIndices(ssid, DATA_SHEET, 0, docNum);
        if (rowIndices.length > 0) {
          const { googleSheets, auth } = await getGoogleSheets();
          await googleSheets.spreadsheets.values.batchUpdate({
            auth: auth as any,
            spreadsheetId: ssid,
            requestBody: {
              valueInputOption: "USER_ENTERED",
              data: rowIndices.map((idx) => ({
                range: `'${DATA_SHEET}'!G${idx}`,
                values: [["รอลูกค้า"]],
              })),
            },
          });
          console.log(`[Archive] Marked ${rowIndices.length} rows of ${docNum} as 'รอลูกค้า'`);
        } else {
          console.warn(`[Archive] No คลังข้อมูล rows found for ${docNum} to mark 'รอลูกค้า'`);
        }
      }
    } catch (statusErr) {
      // อย่าให้การอัปเดตสถานะล้มเหลวมาบล็อกการล้างฟอร์ม (งานยังต้องถูกเคลียร์ออกจากจอ)
      console.error("[Archive] Failed to update status to 'รอลูกค้า':", statusErr);
    }

    // 2. ล้างฟอร์มงานที่ทำอยู่ (ไม่ล้าง Roll Tag source — process จัดการเองแล้ว
    //    การล้างทั้งสอง tag จะทำลาย Roll Tag อื่นที่ยังไม่ได้ประมวลผล)
    await clearFormSheet(ssid);

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Archive API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}
