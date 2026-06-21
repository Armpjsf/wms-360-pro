import { NextResponse } from 'next/server';
import { getProductMasterCategories } from '@/lib/googleSheets';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
    const targetSheetId = await resolveSpreadsheetId(branchId, 'inventory');
    const categories = await getProductMasterCategories(targetSheetId);

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error("Product Category Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
