import { NextResponse } from 'next/server';
import { sendFcmToDevices } from '@/lib/fcmSender';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Warehouse staff press "พร้อมส่ง" when picking/packing is done.
// This pushes an FCM alert so admins know the goods are ready to ship.
export async function POST(req: Request) {
    try {
        const { docNum, orderText, customer } = await req.json().catch(() => ({}));
        const ref = orderText || docNum || '-';

        await sendFcmToDevices({
            title: `✅ เตรียมของเสร็จ: ${ref}`,
            body: customer ? `ลูกค้า: ${customer}\nสินค้าพร้อมส่งแล้ว` : 'สินค้าพร้อมส่งแล้ว',
            data: { type: 'ready', docNum: String(docNum || '') },
            link: '/mobile/jobs',
        }, { tag: 'Ready' });

        return NextResponse.json({ success: true }, { headers: corsHeaders });
    } catch (e: any) {
        console.error('[Ready] Failed to notify:', e);
        return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500, headers: corsHeaders });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { headers: corsHeaders });
}
