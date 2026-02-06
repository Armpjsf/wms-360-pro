import { NextResponse } from 'next/server';
import { getStockMovement } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!sku) {
      return NextResponse.json({ error: "SKU is required" }, { status: 400 });
    }

    console.log(`[StockCard] Fetching movement for ${sku} (Range: ${startDate} to ${endDate})`);
    let movements = await getStockMovement(sku);

    // Initial Balance Calculation (before the selected date range)
    let startingBalance = 0;
    
    // Parse dates safely
    const startTs = startDate ? new Date(startDate).getTime() : 0;
    const endTs = endDate ? new Date(endDate).getTime() + (24 * 60 * 60 * 1000) - 1 : Number.MAX_SAFE_INTEGER;

    if (startDate) {
        // Calculate movement before start date
        startingBalance = movements.reduce((acc, m) => {
            if (new Date(m.date).getTime() < startTs) {
                return acc + m.in - m.out;
            }
            return acc;
        }, 0);

        // Filter movements within range
        movements = movements.filter(m => {
            const d = new Date(m.date).getTime();
            return d >= startTs && d <= endTs;
        });
    }

    // Re-calculate running balance with starting balance
    let currentBalance = startingBalance;
    const finalMovements = movements.map(m => {
        currentBalance += (m.in - m.out);
        return { ...m, balance: currentBalance };
    });
    
    return NextResponse.json(finalMovements);

  } catch (error: any) {
    console.error("Stock Card API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
