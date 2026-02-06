
import { NextResponse } from 'next/server';
import { getProducts, getCycleCountLogs } from '@/lib/googleSheets';
import { detectAnomalies } from '@/lib/anomaly';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch Data in Parallel
    // We need Products for Stock/Ghost checks.
    // We need Cycle Count logs for Variance checks.
    // We might need Audit logs for Future Date checks (let's use Cycle Count + simple Logs for now)
    
    // Note: getCycleCountLogs returns records with 'count_date', 'variance', etc.
    const [products, cycleCounts] = await Promise.all([
        getProducts(),
        getCycleCountLogs(),
    ]);

    // Transform CycleCounts to generic log format expected by anomaly detector
    const logs = cycleCounts.map(c => ({
        id: c.product_name + c.count_date, // composite id
        type: 'CYCLE_COUNT',
        date: c.count_date,
        product_name: c.product_name,
        variance: c.variance,
        system_qty: c.system_qty
    }));

    // 2. Run AI Analysis
    const anomalies = detectAnomalies(products, logs);

    return NextResponse.json({
        total: anomalies.length,
        critical: anomalies.filter(a => a.type === 'CRITICAL').length,
        warning: anomalies.filter(a => a.type === 'WARNING').length,
        issues: anomalies
    });

  } catch (error) {
    console.error('Error in Anomaly Detection:', error);
    return NextResponse.json({ error: 'Failed to detect anomalies' }, { status: 500 });
  }
}
