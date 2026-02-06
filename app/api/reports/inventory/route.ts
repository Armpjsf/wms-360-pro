import { NextRequest, NextResponse } from 'next/server';
import { getTransactions, Transaction } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/inventory
 * Query params: dateFrom, dateTo, type, sku, owner, batch
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        const filterType = searchParams.get('type'); // 'IN' | 'OUT' | null (all)
        const filterSku = searchParams.get('sku')?.toLowerCase();
        const filterOwner = searchParams.get('owner')?.toLowerCase();
        const filterBatch = searchParams.get('batch')?.toLowerCase();

        // Fetch all transactions
        const [inbound, outbound] = await Promise.all([
            getTransactions('IN'),
            getTransactions('OUT')
        ]);

        let combined: Transaction[] = [];
        if (!filterType || filterType === 'IN') combined.push(...inbound);
        if (!filterType || filterType === 'OUT') combined.push(...outbound);

        // Apply filters
        let filtered = combined;

        // Date Range Filter
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filtered = filtered.filter(t => {
                const tDate = new Date(t.date);
                return tDate >= fromDate;
            });
        }
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59); // Include entire end day
            filtered = filtered.filter(t => {
                const tDate = new Date(t.date);
                return tDate <= toDate;
            });
        }

        // SKU Filter (partial match)
        if (filterSku) {
            filtered = filtered.filter(t => 
                (t.sku || t.product || '').toLowerCase().includes(filterSku)
            );
        }

        // Owner Filter (partial match)
        if (filterOwner) {
            filtered = filtered.filter(t => 
                (t.owner || '').toLowerCase().includes(filterOwner)
            );
        }

        // Batch Filter (partial match)
        if (filterBatch) {
            filtered = filtered.filter(t => 
                (t.batch || '').toLowerCase().includes(filterBatch)
            );
        }

        // Sort by date DESC (newest first)
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Map to response format
        const transactions = filtered.map(t => ({
            date: t.date,
            type: t.type,
            sku: t.sku || t.product,
            qty: t.qty,
            price: t.price,
            docRef: t.docRef || '',
            batch: t.batch || '',
            expiryDate: t.expiryDate || '',
            owner: t.owner || ''
        }));

        return NextResponse.json({
            transactions,
            count: transactions.length,
            filters: { dateFrom, dateTo, filterType, filterSku, filterOwner, filterBatch }
        });

    } catch (error: any) {
        console.error('Inventory Report Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
