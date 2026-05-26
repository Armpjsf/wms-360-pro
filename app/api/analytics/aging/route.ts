import { NextResponse } from 'next/server';
import { getProducts, getTransactions } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const products = await getProducts();
    const outbound = await getTransactions('OUT');
    const inbound = await getTransactions('IN'); // To calculate simple stock for value

    // 1. Calculate Stock Levels & Find First Received Dates
    const stockMap = new Map<string, number>();
    const firstReceivedMap = new Map<string, Date>(); // Track first received date
    products.forEach(p => stockMap.set(p.name, 0));
    
    inbound.forEach(t => {
        if (t.product) {
            const curr = stockMap.get(t.product) || 0;
            stockMap.set(t.product, curr + t.qty);
            
            const d = new Date(t.date);
            if (!isNaN(d.getTime())) {
                const existing = firstReceivedMap.get(t.product);
                if (!existing || d < existing) {
                    firstReceivedMap.set(t.product, d);
                }
            }
        }
    });
    outbound.forEach(t => {
        if (t.product) {
            const curr = stockMap.get(t.product) || 0;
            stockMap.set(t.product, curr - t.qty);
        }
    });

    // 2. Find Last Sold Date
    const lastSoldMap = new Map<string, Date>();
    outbound.forEach(t => {
        if (t.product) {
            const d = new Date(t.date);
            const existing = lastSoldMap.get(t.product);
            if (!existing || d > existing) {
                lastSoldMap.set(t.product, d);
            }
        }
    });

    // 3. Prepare Report Data
    const today = new Date();
    const report = products.map(p => {
        const lastSold = lastSoldMap.get(p.name);
        let daysSinceLastSale = -1;
        let isNeverSold = false;
        
        if (lastSold) {
            const diffTime = Math.abs(today.getTime() - lastSold.getTime());
            daysSinceLastSale = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        } else {
            // Never sold
            daysSinceLastSale = 9999;
            isNeverSold = true;
        }

        let movementStatus = "Deadstock";
        if (!isNeverSold) {
            if (daysSinceLastSale <= 15) movementStatus = "Fast Moving";
            else if (daysSinceLastSale <= 60) movementStatus = "Normal Moving";
            else if (daysSinceLastSale <= 90) movementStatus = "Slow Moving";
            else if (daysSinceLastSale <= 180) movementStatus = "Very Slow Moving";
        } else {
            // Never sold - check first receive date
            const firstReceived = firstReceivedMap.get(p.name);
            if (firstReceived) {
                const diffTime = Math.abs(today.getTime() - firstReceived.getTime());
                const daysSinceReceived = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (daysSinceReceived <= 90) {
                    movementStatus = "Normal Moving";
                } else if (daysSinceReceived <= 180) {
                    movementStatus = "Very Slow Moving";
                } else {
                    movementStatus = "Deadstock";
                }
                daysSinceLastSale = daysSinceReceived; // Set to reflect days since received
            } else {
                // Never received and never sold
                movementStatus = "Normal Moving";
                daysSinceLastSale = 0;
            }
        }

        const stockNode = p.stock;
        
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
