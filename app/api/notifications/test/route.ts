import { NextResponse } from 'next/server';
import { sendNotificationToAll } from '@/lib/notifications-server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const count = await sendNotificationToAll(
            'Test Notification 🔔',
            'This is a test message from WMS 360!'
        );
        return NextResponse.json({ success: true, count });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
    }
}
