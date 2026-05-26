
import { NextResponse } from 'next/server';
import { getDamageRecords, addDamageRecord, updateDamageStatusByRow, type DamageRecord } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const records = await getDamageRecords();
    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch damage records' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, product_name, quantity, unit, reason, notes, reported_by } = body;

    // Validation
    if (!product_name || !quantity || !reason) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newRecord: DamageRecord = {
        date: date || new Date().toISOString().split('T')[0],
        product_name,
        quantity,
        unit: unit || 'ชิ้น',
        reason,
        notes: notes || '',
        reported_by: reported_by || 'System',
        status: 'รอดำเนินการ',
        approved_by: '',
        approved_date: ''
    };

    const success = await addDamageRecord(newRecord);

    // Audit Log
    if (success) {
      try {
        const { logAction } = await import('@/lib/auditTrail');
        await logAction({
          userId: reported_by || 'System',
          userName: reported_by || 'System',
          action: 'CREATE', // Uppercase to match type definitions
          module: 'Damage',
          description: `Reported damage: ${product_name} x${quantity} (${reason})`,
          newValues: newRecord as any
        });
      } catch (err) { console.warn("Audit Log Failed:", err); }
      
      return NextResponse.json({ message: 'Damage record added successfully' });
    } else {
        return NextResponse.json({ error: 'Failed to add record' }, { status: 500 });
    }

  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { rowIndex, status, approver, sent_to_hq } = body;

        // Note: rowIndex is 0-based array index from frontend
        if (rowIndex === undefined) {
            return NextResponse.json({ error: 'Missing rowIndex' }, { status: 400 });
        }

        const sheetRow = rowIndex + 2;

        if (sent_to_hq) {
            const { updateDamageHqStatusByRow } = await import('@/lib/googleSheets');
            const success = await updateDamageHqStatusByRow(sheetRow, sent_to_hq);
            if (success) {
                return NextResponse.json({ message: 'HQ status updated successfully' });
            } else {
                return NextResponse.json({ error: 'Failed to update HQ status' }, { status: 500 });
            }
        } else if (status) {
            const success = await updateDamageStatusByRow(sheetRow, status, approver || 'Admin');
            if (success) {
                return NextResponse.json({ message: 'Status updated' });
            } else {
                 return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
            }
        } else {
            return NextResponse.json({ error: 'Missing status or sent_to_hq' }, { status: 400 });
        }

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
