import { NextResponse } from 'next/server';
import { sendFcmToDevices } from '@/lib/fcmSender';

export const dynamic = 'force-dynamic';

// ปุ่มทดสอบ FCM (APK) โดยตรง — ส่งข้อความทดสอบไปทุกเครื่องในชีต "📱 Devices" แบบไม่มีเงื่อนไข
// ใช้เช็คว่า push ส่งถึงจริงได้ทุกเมื่อ ไม่ต้องรอมีข้อมูล/รายการนับสต็อก
//
// เรียกจากเบราว์เซอร์ได้เลย (production ต้องแนบกุญแจ):
//   https://wms-360-pro.vercel.app/api/notifications/test-fcm?key=<CRON_SECRET>
// หรือแนบ header: Authorization: Bearer <CRON_SECRET>
async function handle(req: Request) {
    // กันคนอื่นสแปม push: ใน production ต้องมีกุญแจ (query ?key= หรือ header Bearer)
    if (process.env.NODE_ENV === 'production') {
        const url = new URL(req.url);
        const key = url.searchParams.get('key');
        const authHeader = req.headers.get('authorization');
        const secret = process.env.CRON_SECRET;
        const ok = !!secret && (key === secret || authHeader === `Bearer ${secret}`);
        if (!ok) {
            return NextResponse.json({ error: 'Unauthorized (missing/invalid key)' }, { status: 401 });
        }
    }

    const { sent, failed } = await sendFcmToDevices({
        title: '🔔 ทดสอบแจ้งเตือน WMS',
        body: 'ถ้าเห็นข้อความนี้ แปลว่าระบบ push (APK) ทำงานปกติแล้ว ✅',
        data: { type: 'test' },
        link: '/mobile/jobs',
    }, { tag: 'TestFCM' });

    return NextResponse.json({
        success: true,
        sent,
        failed,
        note: sent === 0
            ? 'ส่งได้ 0 เครื่อง — ตรวจว่าชีต "📱 Devices" มี token หรือยัง (เปิดแอปบนมือถือ 1 รอบ)'
            : `ส่งแจ้งเตือนทดสอบไป ${sent} เครื่อง`,
    });
}

export async function GET(req: Request) {
    return handle(req);
}

export async function POST(req: Request) {
    return handle(req);
}
