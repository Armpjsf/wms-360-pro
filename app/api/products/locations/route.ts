import { NextResponse } from 'next/server';
import { getEmptyProductMasterLocations } from '@/lib/googleSheets';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
    const targetSheetId = await resolveSpreadsheetId(branchId, 'inventory');
    const locations = await getEmptyProductMasterLocations(targetSheetId);

    return NextResponse.json({ locations });
  } catch (error: any) {
    console.error("Empty Product Location Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
