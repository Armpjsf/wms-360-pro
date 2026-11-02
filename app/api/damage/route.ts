
import { NextResponse } from 'next/server';
import {
  getDamageRecords,
  addDamageRecord,
  updateDamageStatusByRow,
  getDamageRecordByRow,
  setDamageExtraTaken,
  SPREADSHEET_ID,
  type DamageRecord,
} from '@/lib/googleSheets';
import { consumeExtraLocation, restoreExtraLocation } from '@/lib/extraLocations';

// The stock formula subtracts damage rows whose status is exactly this.
const APPROVED = 'อนุมัติแล้ว';

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
    const { date, product_name, quantity, unit, reason, notes, reported_by, location } = body;

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
        approved_date: '',
        location: location ? String(location).trim().toUpperCase() : '',
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
        const { rowIndex, approver, sent_to_hq } = body;
        // The stock formula only subtracts rows whose status is exactly "อนุมัติแล้ว";
        // the /damage page used to send "Approved", which never reduced stock.
        const status = body.status === 'Approved' ? APPROVED : body.status;

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
            const before = await getDamageRecordByRow(sheetRow);
            const success = await updateDamageStatusByRow(sheetRow, status, approver || 'Admin');
            if (success) {
                // Extra locations: approved damage taken from an extra bin reduces that bin;
                // un-approving puts back exactly what was taken. Main-bin damage needs nothing.
                let extraNote = '';
                try {
                    const wasApproved = before?.status === APPROVED;
                    const nowApproved = status === APPROVED;
                    if (before && before.location && nowApproved && !wasApproved) {
                        const { taken, isExtra } = await consumeExtraLocation(SPREADSHEET_ID, before.product_name, before.location, before.quantity, approver || 'Admin');
                        if (isExtra) {
                            await setDamageExtraTaken(sheetRow, taken);
                            extraNote = ` • ตัดโลเคชัน ${before.location} ${taken}`;
                        }
                    } else if (before && before.location && wasApproved && !nowApproved && (before.extra_taken || 0) > 0) {
                        await restoreExtraLocation(SPREADSHEET_ID, before.product_name, before.location, before.extra_taken || 0, approver || 'Admin');
                        await setDamageExtraTaken(sheetRow, 0);
                        extraNote = ` • คืนยอดโลเคชัน ${before.location} ${before.extra_taken}`;
                    }
                } catch (e) {
                    console.error('[Damage] extra-location update failed:', e);
                    extraNote = ' • อัปเดตยอดโลเคชันเสริมไม่สำเร็จ ตรวจที่หน้าผังคลัง';
                }
                return NextResponse.json({ message: `Status updated${extraNote}` });
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
