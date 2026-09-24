import { NextResponse } from 'next/server';
import { getSheetData, updateSheetData, PO_SPREADSHEET_ID } from '@/lib/googleSheets';
import { messaging } from '@/lib/firebaseAdmin';
import { TRANSACTION_SPREADSHEET_ID } from '@/lib/transactionUtils';
import { getActiveJobDocNum, readArchive, rowNumbersOf } from '@/lib/orderUtils';

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

        // 1. Fetch Active Job from คลังข้อมูล
        const currentActiveJob = await getActiveJobDocNum(PO_SPREADSHEET_ID);

        if (!currentActiveJob) {
            console.log('[Cron:Jobs] No active job found.');
            return NextResponse.json({ message: "No active job." });
        }

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

        // 4. Fetch Details for Notification from คลังข้อมูล
        let customerName = "Unknown Customer";
        try {
            const archiveData = await readArchive(PO_SPREADSHEET_ID);
            const rows = rowNumbersOf(archiveData, currentActiveJob).map(r => archiveData[r - 1]);
            if (rows.length > 0 && rows[0][1]) {
                customerName = rows[0][1];
            }
        } catch (e) {
            console.warn('[Cron:Jobs] Failed to read customer name from archive:', e);
        }

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

// Vercel: allow up to 60s (Hobby max) — this route does Sheets-heavy work.
export const maxDuration = 60;
