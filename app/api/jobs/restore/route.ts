import { NextResponse } from 'next/server';
import { resolveSpreadsheetId } from '@/lib/googleSheets';
import { withFormLock, restoreOrderToForm, lockErrorStatus } from '@/lib/orderUtils';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { docNum, branchId } = body;

        if (!docNum) {
            return NextResponse.json({ error: 'Missing docNum' }, { status: 400 });
        }

        const ssid = await resolveSpreadsheetId(branchId, 'doc');
        const result = await withFormLock(ssid, () => restoreOrderToForm(docNum, ssid));
        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Restore Job API Error:", error);
        return NextResponse.json({ error: error.message }, { status: lockErrorStatus(error) });
    }
}

export const maxDuration = 60;
