
import { NextResponse } from 'next/server';
import { calculateHistoricalProfit } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const analysis = await calculateHistoricalProfit();

    // Aggregations
    const totalRevenue = analysis.reduce((sum, item) => sum + (item.transaction.qty * item.transaction.price), 0);
    const totalCOGS = analysis.reduce((sum, item) => sum + item.cogs, 0);
    const totalProfit = totalRevenue - totalCOGS;
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Top Products by Profit
    const profitByProduct: Record<string, number> = {};
    analysis.forEach(a => {
        profitByProduct[a.transaction.sku] = (profitByProduct[a.transaction.sku] || 0) + a.profit;
    });

    const topProducts = Object.entries(profitByProduct)
        .map(([sku, profit]) => ({ sku, profit }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5);

    return NextResponse.json({
        summary: {
            revenue: totalRevenue,
            cogs: totalCOGS,
            profit: totalProfit,
            margin: overallMargin
        },
        topProducts,
        history: analysis.reverse().slice(0, 100) // Sales stream (newest first)
    });
  } catch (error) {
    console.error("Profit Analytics Error:", error);
    return NextResponse.json({ error: 'Failed to calculate profit' }, { status: 500 });
  }
}
