import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // This endpoint would be called by a cron job or scheduler
    // For now, it's a manual trigger for testing

    // Fetch today's count items
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const res = await fetch(`${baseUrl}/api/cycle-count/daily`);
    const items = await res.json();

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    const itemCount = items.length;
    
    // Group by zone
    const zoneCount: Record<string, number> = {};
    items.forEach((item: any) => {
      const zone = item.zone || 'Unknown';
      zoneCount[zone] = (zoneCount[zone] || 0) + 1;
    });

    const zoneText = Object.entries(zoneCount)
      .map(([zone, count]) => `Zone ${zone}: ${count}`)
      .join(' | ');

    // Notification payload
    const notification = {
      title: '🔔 Cycle Count Today',
      body: `📦 ${itemCount} items need counting\n📍 ${zoneText}`,
      data: {
        type: 'cycle_count',
        count: itemCount,
        zones: zoneCount,
      }
    };

    // In production, send to FCM/APNS here
    // For now, just return the notification that would be sent
    console.log('Would send notification:', notification);

    return NextResponse.json({
      success: true,
      notification,
      itemCount,
      zones: zoneCount,
      message: 'Notification prepared (not sent - requires FCM/APNS setup)'
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}

export async function GET() {
  // Manual trigger for testing
  return POST(new Request('http://localhost:3000/api/notifications/send-daily'));
}
