import { NextResponse } from 'next/server';
import { saveSubscription } from '@/lib/subscriptionRepository';

export async function POST(request: Request) {
    try {
        const sub = await request.json();
        if (!sub || !sub.endpoint) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }
        
        await saveSubscription(sub);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Subscribe error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
