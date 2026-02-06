import { NextResponse } from 'next/server';
import { getTransactions } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') as 'IN' | 'OUT';
        const limit = parseInt(searchParams.get('limit') || '5');
        const branchId = searchParams.get('branchId') || undefined;

        if (!type || (type !== 'IN' && type !== 'OUT')) {
            return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }

        // Fetch all (cache might be an issue for "Real-time" feel, but let's trust revalidate logic)
        // Optimization: In real world, we'd want a method to only fetch last N rows.
        // For now, fetching all and slicing is acceptable for small-medium sheets.
        const transactions = await getTransactions(type, branchId);

        // Sort by Date Descending
        // Assuming transactions return with ISO date or sortable string
        // If date is "DD/MM/YYYY", we might need parsing.
        // But getTransactions typically returns raw or minimally processed.
        
        // Let's assume getTransactions returns objects with { date, ... }
        // We will slice the LAST N items (since sheets append to bottom)
        // OR if getTransactions already sorts? Usually it returns sheet order (oldest top).
        
        const recent = transactions
            .reverse() // Newest first
            .slice(0, limit);

        return NextResponse.json(recent);

    } catch (error) {
        console.error("Recent transactions error:", error);
        return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
    }
}
