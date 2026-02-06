import { NextResponse } from 'next/server';
import { archiveCurrentForm } from '@/lib/orderUtils';

export const dynamic = 'force-dynamic';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
  try {
    const { clearFormSheet } = await import('@/lib/orderUtils');
    await clearFormSheet();

    // Also clear Roll Tags
    const { clearSheetRange, PO_SPREADSHEET_ID } = await import('@/lib/googleSheets');
    await Promise.all([
         clearSheetRange(PO_SPREADSHEET_ID, "Roll Tag1!B4"),
         clearSheetRange(PO_SPREADSHEET_ID, "Roll Tag1!B6"),
         clearSheetRange(PO_SPREADSHEET_ID, "Roll Tag1!A9:E17"),
         
         clearSheetRange(PO_SPREADSHEET_ID, "Roll Tag2!B4"),
         clearSheetRange(PO_SPREADSHEET_ID, "Roll Tag2!B6"),
         clearSheetRange(PO_SPREADSHEET_ID, "Roll Tag2!A9:E17"),
    ]);

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Archive API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}
