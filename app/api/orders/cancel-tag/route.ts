import { NextResponse } from 'next/server';
import { resolveSpreadsheetId, getSheetData, deleteSheetRows, batchClearSheetRanges } from '@/lib/googleSheets';
import { invalidateStatusCache } from '@/lib/orderStatusCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tagId, branchId } = body;

        if (!tagId) {
            return NextResponse.json({ error: 'Missing tagId' }, { status: 400, headers: corsHeaders });
        }

        const ssid = await resolveSpreadsheetId(branchId, 'doc');
        console.log(`[Cancel Tag] Request to cancel Roll Tag: ${tagId} on SSID: ${ssid}`);

        // 1. Scan คลังข้อมูล to find matching rows for this tagId
        const data = await getSheetData(ssid, "'คลังข้อมูล'!A:I").catch(() => []);
        const matchingIndices: number[] = [];
        let custName = '';

        if (data && data.length > 1) {
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                const docNum = String(row[0] || '').trim();
                const status = String(row[6] || '').trim();
                if (docNum.toUpperCase() === String(tagId).trim().toUpperCase() && (status === 'รอจัด RollTag' || status === 'RollTag')) {
                    matchingIndices.push(i + 1); // 1-based index
                    if (!custName && row[1]) {
                        custName = String(row[1]).trim();
                    }
                }
            }
        }

        // 2. Delete rows from คลังข้อมูล
        if (matchingIndices.length > 0) {
            console.log(`[Cancel Tag] Deleting ${matchingIndices.length} rows for ${tagId}...`);
            await deleteSheetRows(ssid, 'คลังข้อมูล', matchingIndices);
        }

        // 3. Clear legacy sheet if exists (Roll Tag1, Roll Tag2, etc.)
        const tagNum = String(tagId).replace(/^RT/i, '').trim();
        const sourceSheet = `Roll Tag${tagNum}`;
        try {
            await batchClearSheetRanges(ssid, [
                `${sourceSheet}!B4`,
                `${sourceSheet}!B6`,
                `${sourceSheet}!A9:A17`,
                `${sourceSheet}!B9:B17`,
                `${sourceSheet}!D9:D17`,
                `${sourceSheet}!E9:E17`,
            ]);
            console.log(`[Cancel Tag] Cleared legacy sheet: ${sourceSheet}`);
        } catch {
            // Sheet might not exist, ignore
        }

        // 4. Audit Log
        try {
            const { logAction } = await import('@/lib/auditTrail');
            await logAction({
                userId: 'Admin',
                userName: 'Order Admin',
                action: 'DELETE',
                module: 'Outbound',
                description: `Cancelled Roll Tag ${tagId} (${custName || 'Unknown'}) - ${matchingIndices.length} items`,
                newValues: { tagId, customer: custName, deletedRows: matchingIndices.length }
            });
        } catch (auditErr) {
            console.warn('[Cancel Tag] Audit log failed:', auditErr);
        }

        // 5. Invalidate status cache
        invalidateStatusCache(ssid);

        return NextResponse.json({
            success: true,
            tagId,
            deletedCount: matchingIndices.length,
            message: `ยกเลิก Roll Tag ${tagId} เรียบร้อยแล้ว`
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('[Cancel Tag] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to cancel Roll Tag' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}
