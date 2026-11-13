import { NextResponse } from 'next/server';
import { extractRollTagData } from '@/lib/emailParser';
import { createPendingRollTags } from '@/lib/rollTagImporter';
import { RETURN_OUT_PREFIX } from '@/lib/transactionUtils';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const branchId = formData.get('branchId') as string | null;
    const isReturnOut = formData.get('isReturnOut') === 'true';

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'กรุณาเลือกไฟล์ที่ต้องการอัปโหลด' }, { status: 400 });
    }

    const fileName = file.name || '';
    const lowerName = fileName.toLowerCase();

    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'รูปแบบไฟล์ไม่ถูกต้อง รองรับเฉพาะไฟล์ .xlsx, .xls หรือ .csv' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extractedCustomers = extractRollTagData(buffer, fileName);

    if (!extractedCustomers || extractedCustomers.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลออเดอร์ในไฟล์ (กรุณาตรวจสอบว่าเป็นไฟล์รูปแบบเดียวกับอีเมล formica.com)' },
        { status: 400 }
      );
    }

    const customersToImport = isReturnOut
      ? extractedCustomers.map(cust => ({
          ...cust,
          items: cust.items.map(it => {
            const rawOrder = String(it.orderNo || '').trim();
            const finalOrderNo = rawOrder.startsWith(RETURN_OUT_PREFIX)
              ? rawOrder
              : (rawOrder ? `${RETURN_OUT_PREFIX} ${rawOrder}` : RETURN_OUT_PREFIX);
            return {
              ...it,
              orderNo: finalOrderNo
            };
          })
        }))
      : extractedCustomers;

    const created = await createPendingRollTags(customersToImport, branchId);

    return NextResponse.json({
      success: true,
      file: fileName,
      processed: created.length,
      results: created
    });
  } catch (error: any) {
    console.error('Upload Excel RollTag Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
