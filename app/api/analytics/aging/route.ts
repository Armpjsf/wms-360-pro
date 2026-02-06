import { NextResponse } from 'next/server';
import { getProducts, getTransactions } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const products = await getProducts();
    const outbound = await getTransactions('OUT');
    const inbound = await getTransactions('IN'); // To calculate simple stock for value

    // 1. Calculate Stock Levels (Simplified)
    const stockMap = new Map<string, number>();
    products.forEach(p => stockMap.set(p.name, 0));
    
    inbound.forEach(t => {
        const curr = stockMap.get(t.product) || 0;
        stockMap.set(t.product, curr + t.qty);
    });
    outbound.forEach(t => {
        const curr = stockMap.get(t.product) || 0;
        stockMap.set(t.product, curr - t.qty);
    });

    // 2. Find Last Sold Date
    const lastSoldMap = new Map<string, Date>();
    outbound.forEach(t => {
        const d = new Date(t.date);
        const existing = lastSoldMap.get(t.product);
        if (!existing || d > existing) {
            lastSoldMap.set(t.product, d);
        }
    });

    // 3. Prepare Report Data
    const today = new Date();
    const report = products.map(p => {
        const lastSold = lastSoldMap.get(p.name);
        let daysSinceLastSale = -1;
        
        if (lastSold) {
            const diffTime = Math.abs(today.getTime() - lastSold.getTime());
            daysSinceLastSale = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        } else {
            // Never sold
            daysSinceLastSale = 9999; 
        }

        let movementStatus = "Deadstock";
        if (daysSinceLastSale <= 15) movementStatus = "Fast Moving";
        else if (daysSinceLastSale <= 60) movementStatus = "Normal Moving";
        else if (daysSinceLastSale <= 90) movementStatus = "Slow Moving";
        else if (daysSinceLastSale <= 180) movementStatus = "Very Slow Moving";

        const stockNode = stockMap.get(p.name) || 0;
        
        return {
            id: p.id,
            name: p.name,
            category: p.category,
            location: p.location,
            stock: stockNode,
            price: p.price,
            value: stockNode * p.price,
            lastSoldDate: lastSold ? lastSold.toISOString().split('T')[0] : null,
            daysSinceLastSale,
            movementStatus
        };
    });

    return NextResponse.json(report);

  } catch (error: any) {
    console.error("Aging API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
