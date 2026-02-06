import { NextResponse } from 'next/server';
import { writeTransactionData } from '@/lib/transactionUtils';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let items = [];

    // Support both single item (legacy) and multi-item (new)
    if (body.items && Array.isArray(body.items)) {
        items = body.items;
    } else if (body.sku && body.qty) {
        // Legacy fallback
        items.push({
            sku: body.sku,
            qty: body.qty,
            docRef: body.docRef,
            salePrice: body.salePrice
        });
    }

    if (items.length === 0) {
        return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    // Map to TransactionItem format
    const transactionItems = items.map((i: any) => ({
        itemCode: i.sku,
        quantity: Number(i.qty),
        orderNumber: i.docRef || '',
        price: i.salePrice ? Number(i.salePrice) : undefined
    }));

    await writeTransactionData(transactionItems);

    // Automation & Audit
    try {
      const { logAction } = await import('@/lib/auditTrail');
      const { checkStockRules } = await import('@/lib/automation');
      const { getProducts } = await import('@/lib/googleSheets');
      
      // Fetch current stock to calculate projected stock after this outbound
      const products = await getProducts();

      // Parallelize rule checking
      await Promise.all(transactionItems.map(async (tx: { itemCode: string; quantity: number }) => {
          const product = products.find(p => p.name === tx.itemCode);
          if (product) {
              const newStock = product.stock - tx.quantity;
              await checkStockRules(tx.itemCode, newStock);
          }
      }));

      await logAction({
        userId: 'System', 
        userName: 'Outbound API',
        action: 'CREATE', 
        module: 'Outbound',
        description: `Issued ${items.length} items (Doc: ${items[0].docRef || 'N/A'})`,
        newValues: { items: items }
      });
    } catch (err) {
      console.warn("Automation/Audit Failed:", err);
    }

    return NextResponse.json({ success: true, message: `Captured ${items.length} items` });

  } catch (error: any) {
    console.error("Outbound API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
