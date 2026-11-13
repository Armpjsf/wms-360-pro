import { NextResponse } from 'next/server';
import { getTransactions, resolveSpreadsheetId } from '@/lib/googleSheets';
import { isReturnOutOrder } from '@/lib/transactionUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') as 'IN' | 'OUT';
        const limit = parseInt(searchParams.get('limit') || '5');
        const branchId = searchParams.get('branchId') || undefined;
        const onlyReturnOut = searchParams.get('onlyReturnOut');

        if (!type || (type !== 'IN' && type !== 'OUT')) {
            return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }

        // Fetch all (cache might be an issue for "Real-time" feel, but let's trust revalidate logic)
        // Optimization: In real world, we'd want a method to only fetch last N rows.
        // For now, fetching all and slicing is acceptable for small-medium sheets.
        // branchId is a branch code ("fmc", "hq"); getTransactions wants the
        // branch's spreadsheet ID — passing the code read a non-existent file.
        const sheetId = await resolveSpreadsheetId(branchId || null, 'inventory');
        const transactions = await getTransactions(type, sheetId, undefined, true);

        let list = transactions;
        if (type === 'OUT' && onlyReturnOut === '1') {
            list = list.filter(t => Boolean((t as any).isReturnOut) || isReturnOutOrder(t.docRef));
        }

        const recent = list
            .reverse() // Newest first
            .slice(0, limit);

        return NextResponse.json(recent);

    } catch (error) {
        console.error("Recent transactions error:", error);
        return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
    }
}
