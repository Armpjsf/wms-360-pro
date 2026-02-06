import { NextResponse } from 'next/server';
import { getProducts, getDamageRecords } from '@/lib/googleSheets';
import { getAllAlerts, getAlertSummary } from '@/lib/inAppAlerts';

export async function GET() {
  try {
    // Fetch products and damage records in parallel
    const [products, damageRecords] = await Promise.all([
      getProducts(),
      getDamageRecords()
    ]);

    // Generate alerts
    const alerts = getAllAlerts(products, damageRecords);
    const summary = getAlertSummary(products, damageRecords);

    return NextResponse.json({
      alerts: alerts.slice(0, 20), // Limit to 20 most recent
      summary
    });
  } catch (error) {
    console.error('[Alerts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}
