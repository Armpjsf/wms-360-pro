import { NextResponse } from 'next/server';
import { getTransactions, getProducts, getDamageRecords } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'IN' | 'OUT' | 'DAMAGE'

    if (type !== 'IN' && type !== 'OUT' && type !== 'DAMAGE') {
        return NextResponse.json({ error: "Invalid type. Use 'IN', 'OUT' or 'DAMAGE'" }, { status: 400 });
    }

    // Always fetch products to get Location Map
    // Normalize keys: Lowercase + Trim for robust matching
    const products = await getProducts();
    const locMap = new Map<string, string>();
    products.forEach(p => {
        if (p.name) locMap.set(p.name.toLowerCase().trim(), p.location);
    });

    let enrichedLogs: any[] = [];

    if (type === 'DAMAGE') {
        const records = await getDamageRecords();
        enrichedLogs = records.map(r => {
            const normalizedName = r.product_name ? r.product_name.toLowerCase().trim() : "";
            return {
                date: r.date,
                product: r.product_name,
                qty: r.quantity,
                location: locMap.get(normalizedName) || '-', // Actual Warehouse Location
                reason: r.reason, // Specific Damage Reason
                status: r.status
            };
        });
    } else {
        const logs = await getTransactions(type);
        enrichedLogs = logs.map(l => {
             const normalizedName = l.product ? l.product.toLowerCase().trim() : "";
             return {
                ...l,
                location: locMap.get(normalizedName) || '-'
             };
        });
    }
    
    // Sort by Date Descending
    enrichedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(enrichedLogs);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
