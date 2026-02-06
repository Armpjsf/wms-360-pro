import { NextResponse } from 'next/server';
import { getSheetData, getTransactionsUncached, SPREADSHEET_ID } from '@/lib/googleSheets';
import { messaging } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
    // Check for authorization (Vercel Cron Header)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        // Optional: Secure it later. For now, open for testing.
        // return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        console.log('[CycleCount] Starting Daily Movement Check...');
        
        // 1. Get Today's Date (Thai Time)
        const now = new Date();
        const thaiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const todayStr = thaiTime.toISOString().split("T")[0]; // YYYY-MM-DD
        
        console.log(`[CycleCount] Checking for date: ${todayStr}`);
        
        const movedItems = new Set<string>();

        // 2. Fetch Transactions (Uncached for real-time accuracy)
        const [inbound, outbound] = await Promise.all([
            getTransactionsUncached('IN'),
            getTransactionsUncached('OUT')
        ]);

        // 3. Filter for Today
        inbound.forEach(tx => {
            if (tx.date === todayStr && tx.product) movedItems.add(tx.product);
        });
        
        outbound.forEach(tx => {
            if (tx.date === todayStr && tx.product) movedItems.add(tx.product);
        });

        const itemsToCount = Array.from(movedItems);
        console.log(`[CycleCount] Items moved today: ${itemsToCount.join(', ')}`);

        if (itemsToCount.length > 0) {
            
            // 1. Fetch Tokens from Sheet
            const deviceData = await getSheetData(SPREADSHEET_ID, "'📱 Devices'!A:A");
            const tokens = deviceData?.map((row: any[]) => row[0]).filter((t: any) => t && t.length > 10) || [];

            if (tokens.length === 0) {
                console.log('[CycleCount] No devices registered to send push.');
                 return NextResponse.json({ 
                    message: `Cycle Count Required for ${itemsToCount.length} items (No Devices Found In Sheet)`, 
                    items: itemsToCount 
                });
            }

            // 2. Send FCM Multicast
            let sentCount = 0;
            if (messaging) {
                console.log(`[CycleCount] Sending Push to ${tokens.length} devices...`);
                try {
                    const response = await messaging.sendEachForMulticast({
                        tokens: tokens,
                        notification: {
                            title: "📦 ถึงเวลาตรวจนับสต็อก (Cycle Count)",
                            body: `วันนี้มีการเคลื่อนไหว ${itemsToCount.length} รายการ คลิกเพื่อดูรายละเอียด`,
                        },
                        data: {
                            type: 'cycle_count',
                            items: JSON.stringify(itemsToCount.slice(0, 5)) // Send top 5 items in data payload limit
                        },
                        android: {
                            priority: 'high',
                            notification: {
                                sound: 'default',
                                clickAction: 'FCM_PLUGIN_ACTIVITY'
                            }
                        }
                    });
                    sentCount = response.successCount;
                    console.log('[CycleCount] FCM Response:', response.successCount + ' sent, ' + response.failureCount + ' failed.');
                } catch (fcmErr) {
                    console.error('[CycleCount] FCM Send Error:', fcmErr);
                }
            } else {
                console.warn('[CycleCount] Firebase Messaging not initialized.');
            }

            return NextResponse.json({ 
                message: `Cycle Count Notification sent to ${sentCount} devices`, 
                items: itemsToCount 
            });
        }

        return NextResponse.json({ message: "No movement today. No Cycle Count needed." });

    } catch (error) {
        console.error('[CycleCount] Error:', error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
