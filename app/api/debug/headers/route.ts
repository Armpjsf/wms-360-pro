import { NextResponse } from 'next/server';
import { getSheetData, SPREADSHEET_ID } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch first row of Inventory Sheet
    const data = await getSheetData(SPREADSHEET_ID, "'📊 รายงานสินค้าคงเหลือ'!A1:Z1");
    return NextResponse.json({ 
        headers: data ? data[0] : [],
        count: data ? data[0].length : 0 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
