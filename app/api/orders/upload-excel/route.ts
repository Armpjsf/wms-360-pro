import { NextResponse } from 'next/server';
import { extractRollTagData } from '@/lib/emailParser';
import { createPendingRollTags } from '@/lib/rollTagImporter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const branchId = formData.get('branchId') as string | null;

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

    const created = await createPendingRollTags(extractedCustomers, branchId);

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
