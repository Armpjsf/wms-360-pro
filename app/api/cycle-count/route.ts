
import { NextResponse } from 'next/server';
import { getCycleCountLogs, addCycleCountEntry, type CycleCountRecord } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const records = await getCycleCountLogs();
    
    // Sort by Date Descending (Newest First)
    records.sort((a, b) => {
        const dateA = new Date(a.count_date).getTime();
        const dateB = new Date(b.count_date).getTime();
        return dateB - dateA;
    });

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cycle count logs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      product_name, 
      location, 
      system_qty, 
      actual_qty, 
      inspector, 
      notes,
      variance_reason,
      photo_url 
    } = body;

    if (!product_name || actual_qty === undefined) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const sysQty = parseFloat(system_qty || '0');
    const actQty = parseFloat(actual_qty);
    const variance = actQty - sysQty;
    const status = variance === 0 ? 'Match' : 'Discrepancy';

    // Combine notes with variance reason if provided
    let fullNotes = notes || '';
    if (variance_reason) {
      fullNotes = fullNotes ? `${fullNotes} | Reason: ${variance_reason}` : `Reason: ${variance_reason}`;
    }
    if (photo_url) {
      fullNotes = fullNotes ? `${fullNotes} | Photo: ${photo_url}` : `Photo: ${photo_url}`;
    }

    const newRecord: CycleCountRecord = {
        product_name,
        location: location || '-',
        due_date: new Date().toISOString().split('T')[0],
        count_date: new Date().toISOString().split('T')[0],
        inspector: inspector || 'System',
        notes: fullNotes,
        system_qty: sysQty,
        actual_qty: actQty,
        variance,
        status
    };

    const success = await addCycleCountEntry(newRecord);

    if (success) {
        return NextResponse.json({ 
          message: 'Count recorded successfully', 
          variance,
          has_variance: variance !== 0 
        });
    } else {
        return NextResponse.json({ error: 'Failed to record count' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error recording cycle count:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { clearSheetRange, SPREADSHEET_ID } = await import('@/lib/googleSheets');
    
    // Clear everything from A2 (keep headers) down to J2000
    await clearSheetRange(SPREADSHEET_ID, "'CycleCount_Log'!A2:J2000"); // Note: Single quotes for sheet name in range if it has underscore? Google Sheets handles it, but safety is good.
    // 'CycleCount_Log' does not strictly typically need quotes unless spaces, but good practice.
    // Wait, in lib/googleSheets.ts it uses SPREADSHEET_ID from process.env usually, but also exports a constant. 
    // The export in lib/googleSheets.ts line 408 is what I should rely on or the helper's internal logic.
    // Actually `clearSheetRange` takes an ID. 
    
    return NextResponse.json({ message: 'Cycle Count Log cleared successfully' });
  } catch (error) {
    console.error('Error clearing cycle count log:', error);
    return NextResponse.json({ error: 'Failed to clear log' }, { status: 500 });
  }
}
