import { NextResponse } from 'next/server';
import { writeTransactionData } from '@/lib/transactionUtils';
import { resolveSpreadsheetId } from '@/lib/googleSheets';
import { consumeExtraLocation, normLoc } from '@/lib/extraLocations';

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
            salePrice: body.salePrice,
            location: body.location
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
        price: i.salePrice ? Number(i.salePrice) : undefined,
        location: i.location ? normLoc(i.location) : undefined,
    }));

    await writeTransactionData(transactionItems);

    // Extra locations: stock picked from an extra bin reduces that bin
    // (the main bin is total − extras, so it follows on its own).
    const extraWarnings: string[] = [];
    const picked = transactionItems.filter((t: { location?: string }) => t.location);
    if (picked.length > 0) {
      const ssid = await resolveSpreadsheetId(body.branchId || null, 'inventory');
      for (const t of picked) {
        try {
          const { taken, isExtra } = await consumeExtraLocation(ssid, t.itemCode, t.location!, t.quantity, 'Outbound');
          if (isExtra && taken < t.quantity) {
            extraWarnings.push(`${t.itemCode}: ${t.location} มีไม่พอ ตัดได้ ${taken}/${t.quantity}`);
          }
        } catch (e) {
          console.error('[Outbound] extra-location update failed:', e);
          extraWarnings.push(`${t.itemCode}: อัปเดตยอด ${t.location} ไม่สำเร็จ`);
        }
      }
    }

    // Automation & Audit
    try {
      const { logAction } = await import('@/lib/auditTrail');
      const { checkStockRules } = await import('@/lib/automation');
      const { getProducts } = await import('@/lib/googleSheets');
      const { getServerSession } = await import("next-auth/next");
      const { authOptions } = await import("@/lib/auth");

      // @ts-ignore
      const session = await getServerSession(authOptions);
      
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
        userId: session?.user?.email || 'System', 
        userName: session?.user?.name || 'Outbound API',
        action: 'CREATE', 
        module: 'Outbound',
        description: `Issued ${items.length} items (Doc: ${items[0].docRef || 'N/A'})`,
        newValues: { items: items }
      });
    } catch (err) {
      console.warn("Automation/Audit Failed:", err);
    }

    return NextResponse.json({ success: true, message: `Captured ${items.length} items`, warnings: extraWarnings });

  } catch (error: any) {
    console.error("Outbound API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
