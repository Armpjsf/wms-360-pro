import { NextResponse } from 'next/server';
import { getDeliveryHistory, addDeliveryHistory } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const history = await getDeliveryHistory();
    return NextResponse.json(history);
  } catch (error: any) {
    console.error("Delivery History GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Support both single object and array of objects
    const items = Array.isArray(body) ? body : [body];
    
    if (items.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    const rows = items.map(item => {
      const { 
        date, 
        customer, 
        location, 
        orderNo, 
        sku, 
        qty, 
        packs, 
        shippingCost, 
        notes, 
        pdfLink 
      } = item;

      // Prepare row for Sheets (10 columns matching DELIVERY_HISTORY_HEADERS)
      return [
        date || new Date().toLocaleDateString('th-TH'),
        customer || "Unknown",
        location || "",
        orderNo || "",
        sku || "Unknown",
        qty || 0,
        packs || 0,
        shippingCost || 0,
        notes || "",
        pdfLink || ""
      ];
    });

    await addDeliveryHistory(rows);
    return NextResponse.json({ success: true, count: rows.length });
  } catch (error: any) {
    console.error("Delivery History POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const customer = searchParams.get('customer');
    const orderNo = searchParams.get('orderNo');
    const sku = searchParams.get('sku');

    if (!date || !customer || !orderNo || !sku) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const { deleteDeliveryHistory } = await import('@/lib/googleSheets');
    const success = await deleteDeliveryHistory(date, customer, orderNo, sku);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
  } catch (error: any) {
    console.error("Delivery History DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
