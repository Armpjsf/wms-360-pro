import { NextResponse } from 'next/server';
import { getTransactionsUncached } from '@/lib/googleSheets';
import { sendFcmToDevices } from '@/lib/fcmSender';

export async function GET(req: Request) {
    // Check for authorization (Vercel Cron Header)
    if (process.env.NODE_ENV === 'production') {
        const authHeader = req.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
    }

    try {
        console.log('[CycleCount] Starting Daily Movement Check...');
        
        // 1. Get Today's Date (Thai Time)
        const now = new Date();
        const todayStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(now);
        
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
            const { sent } = await sendFcmToDevices({
                title: "📦 ถึงเวลาตรวจนับสต็อก (Cycle Count)",
                body: `วันนี้มีการเคลื่อนไหว ${itemsToCount.length} รายการ คลิกเพื่อดูรายละเอียด`,
                data: {
                    type: 'cycle_count',
                    items: JSON.stringify(itemsToCount.slice(0, 5)),
                },
                link: '/mobile/cycle-count',
            }, { tag: 'CycleCount' });

            return NextResponse.json({
                message: `Cycle Count Notification sent to ${sent} devices`,
                items: itemsToCount
            });
        }

        return NextResponse.json({ message: "No movement today. No Cycle Count needed." });

    } catch (error) {
        console.error('[CycleCount] Error:', error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
