import { NextResponse } from 'next/server';
import { resolveSpreadsheetId, getSheetData } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

function isHeaderRow(colA: string, colB: string): boolean {
  const a = colA.toLowerCase();
  const b = colB.toLowerCase();
  const headerTerms = ['รหัส', 'id', 'customer', 'customer_id', 'customer id', 'code', 'ชื่อ', 'name', 'customer_name'];
  return headerTerms.some(term => a === term || b === term || a.includes('รหัสลูกค้า') || b.includes('ชื่อลูกค้า'));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    const ssId = await resolveSpreadsheetId(branchId, 'doc');
    const rawData = await getSheetData(ssId, "'Customer'!A1:B").catch(() => []);

    const customers: Array<{ id: string; name: string }> = [];
    const seenIds = new Set<string>();

    if (Array.isArray(rawData) && rawData.length > 0) {
      for (const row of rawData) {
        if (!row || !Array.isArray(row)) continue;
        const id = String(row[0] || '').trim();
        const name = String(row[1] || '').trim();

        if (!id && !name) continue;
        if (isHeaderRow(id, name)) continue;

        const customerId = id || name;
        const customerName = name || id;

        if (!seenIds.has(customerId)) {
          seenIds.add(customerId);
          customers.push({
            id: customerId,
            name: customerName
          });
        }
      }
    }

    return NextResponse.json({ customers });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch customers', customers: [] }, { status: 500 });
  }
}
