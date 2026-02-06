import { NextResponse } from 'next/server';
import { getSheetData, SPREADSHEET_ID } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [invRaw, issueRaw] = await Promise.all([
      getSheetData(SPREADSHEET_ID, "'📊 รายงานสินค้าคงเหลือ'!A:E"), 
      getSheetData(SPREADSHEET_ID, "'💰 Transaction จ่าย'!A:M")
    ]);

    // 1. Build Item -> Category Map
    const itemCategoryMap = new Map<string, string>();
    invRaw?.slice(1).forEach((row: any[]) => {
        const name = row[0];
        const category = row[3]; // Assuming Category is Col D (Index 3) - WAIT, in route.ts it was row[15] (Col P?)
        // Let's re-verify column index from route.ts
        // In route.ts: category: row[15] || "General"
        // But getSheetData for invRaw there was A:Z
        // Here I only fetched A:E. I need to fetch A:Z to be sure.
        itemCategoryMap.set(name, "Pending"); 
    });
    
    // FETCH FULL RANGE AGAIN CORRECTLY
    const invRawFull = await getSheetData(SPREADSHEET_ID, "'📊 รายงานสินค้าคงเหลือ'!A:Z");
    const safeInv = invRawFull || [];
    
    // Rebuild Map with correct index
    itemCategoryMap.clear();
    safeInv.slice(1).forEach((row: any[]) => {
        if(row[0]) itemCategoryMap.set(row[0], row[15] || "General");
    });
    
    const debugRows: any[] = [];
    let totalQty = 0;

    issueRaw?.slice(1).forEach((row: any[], index: number) => {
       const date = row[0];
       const name = row[1];
       if (!name) return;
       
       const category = itemCategoryMap.get(name) || "Uncategorized";
       
       // Filter for TOP BOARD (fuzzy match)
       if (category.toUpperCase().includes("TOP") || category.toUpperCase().includes("BORD")) {
           const qty = parseFloat(row[2]?.replace(/,/g, '') || "0");
           totalQty += qty;
           debugRows.push({
               row: index + 2,
               date: date,
               name: name,
               category: category,
               qty: qty,
               doc: row[6]
           });
       }
    });

    return NextResponse.json({
        total: totalQty,
        rows: debugRows
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
