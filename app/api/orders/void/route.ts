import { NextResponse } from 'next/server';
import { resolveSpreadsheetId } from '@/lib/googleSheets';
import {
    withFormLock,
    readArchive,
    rowNumbersOf,
    setDocsStatus,
    lockErrorStatus,
    STATUS_CANCELLED,
    STATUS_DONE,
    getActiveJobDocNum,
    setActiveJobDocNum
} from '@/lib/orderUtils';
import { writeReversalTransaction } from '@/lib/transactionUtils';
import { sendFcmToDevices } from '@/lib/fcmSender';
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
        const { docNum, branchId, reason } = body;

        if (!docNum) {
            return NextResponse.json({ error: 'Missing docNum' }, { status: 400, headers: corsHeaders });
        }

        const targetDoc = String(docNum).trim();
        const ssid = await resolveSpreadsheetId(branchId, 'doc');
        const invSSID = await resolveSpreadsheetId(branchId, 'inventory');

        console.log(`[Void Order] Request to void docNum: ${targetDoc} on SSID: ${ssid}`);

        invalidateStatusCache(ssid);

        return await withFormLock(ssid, async () => {
            const data = await readArchive(ssid);
            if (!data || data.length <= 1) {
                return NextResponse.json({ error: 'ไม่พบข้อมูลในคลังข้อมูล' }, { status: 404, headers: corsHeaders });
            }

            // Find matching rows by docNum (Col A) or orderNo (Col D)
            let matchingRows: any[] = [];
            let resolvedDocNum = targetDoc;

            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                const dNum = String(row[0] || '').trim();
                const ordNo = String(row[3] || '').trim();

                if (dNum.toUpperCase() === targetDoc.toUpperCase()) {
                    matchingRows.push(row);
                    resolvedDocNum = dNum;
                } else if (ordNo.toUpperCase() === targetDoc.toUpperCase()) {
                    matchingRows.push(row);
                    resolvedDocNum = dNum;
                }
            }

            if (matchingRows.length === 0) {
                return NextResponse.json(
                    { error: `ไม่พบเอกสารหมายเลข ${targetDoc} ในระบบ` },
                    { status: 404, headers: corsHeaders }
                );
            }

            // Check if already completed
            const isAllCompleted = matchingRows.every(r => String(r[6] || '').trim() === STATUS_DONE);
            if (isAllCompleted) {
                return NextResponse.json(
                    { error: `เอกสาร ${resolvedDocNum} เสร็จสิ้นและมีใบเซ็นรับแล้ว ไม่สามารถยกเลิกได้` },
                    { status: 400, headers: corsHeaders }
                );
            }

            const custName = String(matchingRows[0][1] || 'Unknown').trim();
            const itemsToReverse = matchingRows.map(r => ({
                itemCode: String(r[4] || '').trim(),
                quantity: Number(r[5]) || 0,
                orderNumber: String(r[3] || '').trim(),
                docNumber: resolvedDocNum
            })).filter(it => it.itemCode && it.quantity > 0);

            // 1. Mark status in คลังข้อมูล as "ยกเลิก"
            await setDocsStatus(ssid, [resolvedDocNum], STATUS_CANCELLED);
            console.log(`[Void Order] Marked ${resolvedDocNum} as ${STATUS_CANCELLED}`);

            // 2. If active job, clear active job pointer
            const activeDoc = await getActiveJobDocNum(ssid);
            if (activeDoc === resolvedDocNum) {
                await setActiveJobDocNum(ssid, "");
                console.log(`[Void Order] Cleared active job cell for ${resolvedDocNum}`);
            }

            // 3. Write Reversal Transaction to restore stock in Transaction sheet
            if (itemsToReverse.length > 0) {
                try {
                    await writeReversalTransaction(
                        itemsToReverse,
                        invSSID,
                        `${resolvedDocNum} (${custName}): ${reason || 'ลูกค้าส่งออเดอร์มาผิด'}`
                    );
                    console.log(`[Void Order] Reversal transactions written for ${itemsToReverse.length} items`);
                } catch (txErr) {
                    console.error('[Void Order] Failed to write reversal transaction:', txErr);
                }
            }

            // 4. Send FCM Push Notification to warehouse APK devices
            try {
                await sendFcmToDevices({
                    title: `⚠️ ยกเลิกออเดอร์ ${resolvedDocNum}`,
                    body: `ออเดอร์ของ ${custName} (${resolvedDocNum}) ถูกยกเลิกแล้ว ไม่ต้องจัดสินค้า`,
                    data: { docNum: resolvedDocNum, status: 'CANCELLED' },
                    link: '/mobile/jobs'
                }, { tag: 'VoidOrder' });
            } catch (fcmErr) {
                console.warn('[Void Order] FCM push notification failed:', fcmErr);
            }

            // 5. Audit Log
            try {
                const { logAction } = await import('@/lib/auditTrail');
                await logAction({
                    userId: 'Admin',
                    userName: 'Order Admin',
                    action: 'DELETE',
                    module: 'Outbound',
                    description: `Voided order ${resolvedDocNum} for ${custName} (${itemsToReverse.length} items). Reason: ${reason || 'N/A'}`,
                    newValues: { docNum: resolvedDocNum, customer: custName, reason, items: itemsToReverse }
                });
            } catch (auditErr) {
                console.warn('[Void Order] Audit log failed:', auditErr);
            }

            // 6. Invalidate cache
            invalidateStatusCache(ssid);

            return NextResponse.json({
                success: true,
                docNum: resolvedDocNum,
                reversedItems: itemsToReverse.length,
                message: `ยกเลิกออเดอร์ ${resolvedDocNum} เรียบร้อยแล้ว ยอดสต็อกได้รับการคืนเข้าสู่ระบบแล้ว`
            }, { headers: corsHeaders });
        });

    } catch (error: any) {
        console.error('[Void Order] Error:', error);
        const status = lockErrorStatus(error);
        return NextResponse.json(
            { error: error.message || 'Failed to void order' },
            { status, headers: corsHeaders }
        );
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}
