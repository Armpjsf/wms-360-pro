import { NextResponse } from 'next/server';
import { createPendingRollTags } from '@/lib/rollTagImporter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { customer, orderNo, items, branchId } = body;

    if (!customer || typeof customer !== 'string' || !customer.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อลูกค้า (customer is required)' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'กรุณาระบุรายการสินค้าอย่างน้อย 1 รายการ (items is required)' }, { status: 400 });
    }

    const normalizedItems = [];
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const itemCode = String(item?.itemCode || item?.sku || '').trim();
      const rawQty = item?.quantity ?? item?.qty;
      const quantity = Number(rawQty);

      if (!itemCode) {
        return NextResponse.json({ error: `รายการที่ ${idx + 1} ไม่มีรหัสสินค้า (SKU/ItemCode)` }, { status: 400 });
      }

      if (isNaN(quantity) || quantity <= 0) {
        return NextResponse.json({ error: `รายการที่ ${idx + 1} (${itemCode}) จำนวนไม่ถูกต้อง (${rawQty})` }, { status: 400 });
      }

      normalizedItems.push({
        orderNo: String(orderNo || '').trim(),
        itemCode,
        quantity
      });
    }

    // Call createPendingRollTags directly without writeTransactionData (no double stock deduction!)
    const created = await createPendingRollTags(
      [{ customerId: String(customer).trim(), items: normalizedItems }],
      branchId ? String(branchId) : undefined
    );

    return NextResponse.json({
      success: true,
      tagId: created[0]?.tagId,
      results: created
    });
  } catch (error: any) {
    console.error('Manual RollTag Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
