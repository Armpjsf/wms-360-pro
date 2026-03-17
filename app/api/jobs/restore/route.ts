
import { NextResponse } from 'next/server';
import { restoreOrderToForm } from '@/lib/orderUtils';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { docNum } = body;

        if (!docNum) {
            return NextResponse.json({ error: 'Missing docNum' }, { status: 400 });
        }

        const result = await restoreOrderToForm(docNum);
        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Restore Job API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
