import { NextResponse } from 'next/server';
import { sendFcmToDevices } from '@/lib/fcmSender';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const res = await fetch(`${baseUrl}/api/cycle-count/daily`);
    const items = await res.json();

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    const itemCount = items.length;

    if (itemCount === 0) {
      return NextResponse.json({ success: true, message: 'No items to count today.' });
    }

    const zoneCount: Record<string, number> = {};
    items.forEach((item: any) => {
      const zone = item.zone || 'Unknown';
      zoneCount[zone] = (zoneCount[zone] || 0) + 1;
    });

    const zoneText = Object.entries(zoneCount)
      .map(([zone, count]) => `Zone ${zone}: ${count}`)
      .join(' | ');

    const title = '🔔 ถึงเวลาตรวจนับสต็อก';
    const body = `📦 ${itemCount} รายการ | ${zoneText}`;

    // FCM — APK
    const { sent: fcmSent, failed: fcmFailed } = await sendFcmToDevices({
      title,
      body,
      data: { type: 'cycle_count', items: JSON.stringify(items.slice(0, 5).map((i: any) => i.sku || i.name)) },
    }, { tag: 'DailyNotif' });

    // Web Push — PWA
    let webPushSent = 0;
    try {
      const { sendWebPush } = await import('@/lib/webPushSender');
      const result = await sendWebPush({ title, body, url: '/cycle-count' });
      webPushSent = result.success;
    } catch (wpErr) {
      console.error('[DailyNotif] Web Push error:', wpErr);
    }

    return NextResponse.json({
      success: true,
      itemCount,
      zones: zoneCount,
      fcmSent,
      fcmFailed,
      webPushSent,
    });

  } catch (error) {
    console.error('Error sending daily notification:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
