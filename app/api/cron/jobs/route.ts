import { NextResponse } from 'next/server';
import { getSheetData, updateSheetData, PO_SPREADSHEET_ID } from '@/lib/googleSheets';
import { messaging } from '@/lib/firebaseAdmin';
import { TRANSACTION_SPREADSHEET_ID } from '@/lib/transactionUtils';

// This endpoint is designed to be called by a Scheduler (Cron Job)
// e.g., every 5 minutes.

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // Check for Cron Secret (Vercel Cron sends Authorization: Bearer <CRON_SECRET>)
    if (process.env.NODE_ENV === 'production') {
        const authHeader = req.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
    }

    try {
        console.log('[Cron:Jobs] Checking for New Active Jobs...');

        // 1. Fetch Active Form from 'ส่งสินค้า' (Delivery Sheet)
        // Similar logic to 'api/orders/status'
        const FORM_SHEET = "ส่งสินค้า";
        // Check cell A1 for DocNum
        const formCheck = await getSheetData(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!G3:G3`);
        const docNumRaw = formCheck && formCheck[0] ? formCheck[0][0] : null;

        if (!docNumRaw || docNumRaw.trim() === "") {
            console.log('[Cron:Jobs] No active job found (A1 empty).');
            return NextResponse.json({ message: "No active job." });
        }

        const currentActiveJob = docNumRaw.trim();
        console.log(`[Cron:Jobs] Current Active Job: ${currentActiveJob}`);

        // 2. Fetch Last Notified Job from State Storage ('Devices' sheet, Cell Z1)
        // We use Z1 in 'Devices' sheet as a simple Key-Value store
        const DEVICES_SHEET = "'📱 Devices'";
        const STATE_CELL = "Z1";

        const stateData = await getSheetData(TRANSACTION_SPREADSHEET_ID, `${DEVICES_SHEET}!${STATE_CELL}`);
        const lastNotifiedJob = stateData && stateData[0] ? stateData[0][0] : "";

        console.log(`[Cron:Jobs] Last Notified: ${lastNotifiedJob}`);

        // 3. Compare
        if (currentActiveJob === lastNotifiedJob) {
            console.log('[Cron:Jobs] Job already notified. Skipping.');
            return NextResponse.json({ message: "Job already notified." });
        }

        // 4. Fetch Details for Notification
        // Get Customer Name from F6 (Index 5, 5)
        const formMeta = await getSheetData(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!F6:F6`);
        const customerName = formMeta && formMeta[0] ? formMeta[0][0] : "Unknown Customer";

        console.log(`[Cron:Jobs] New Job Detected! Sending Notification...`);

        // 5. Send Push Notification
        let sentCount = 0;
        
        // Fetch Tokens
        const deviceData = await getSheetData(TRANSACTION_SPREADSHEET_ID, `${DEVICES_SHEET}!A:A`);
        const tokens = deviceData?.map((row: any[]) => row[0]).filter((t: any) => t && t.length > 10) || [];

        if (tokens.length > 0 && messaging) {
             const response = await messaging.sendEachForMulticast({
                tokens: tokens,
                notification: {
                    title: `🆕 งานใหม่: ${currentActiveJob}`,
                    body: `ลูกค้า: ${customerName}\nคลิกเพื่อเปิดใบงาน`,
                },
                data: {
                    type: 'new_job',
                    docNum: currentActiveJob,
                    customer: customerName,
                    url: '/mobile/jobs'
                },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        clickAction: 'FCM_PLUGIN_ACTIVITY',
                        channelId: 'default'
                    }
                },
                webpush: {
                    fcmOptions: { link: 'https://wms-360-pro.vercel.app/mobile/jobs' }
                }
            });
            sentCount = response.successCount;
            console.log(`[Cron:Jobs] Sent to ${sentCount} devices.`);
        } else {
            console.warn('[Cron:Jobs] No tokens or Firebase not configured.');
        }

        // 6. Update State (Lock via Z1)
        await updateSheetData(TRANSACTION_SPREADSHEET_ID, `${DEVICES_SHEET}!${STATE_CELL}`, [[currentActiveJob]]);
        console.log('[Cron:Jobs] State updated to:', currentActiveJob);

        return NextResponse.json({ 
            success: true, 
            message: `New Job ${currentActiveJob} notified to ${sentCount} devices`,
            job: currentActiveJob
        });

    } catch (error: any) {
        console.error('[Cron:Jobs] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
