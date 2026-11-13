import { NextResponse } from 'next/server';
import { writeTransactionData, RETURN_OUT_PREFIX } from '@/lib/transactionUtils';
import { resolveSpreadsheetId } from '@/lib/googleSheets';
import { consumeExtraLocation, normLoc } from '@/lib/extraLocations';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let rawItems: any[] = [];

    // Support both single item (legacy) and multi-item (new)
    if (body.items && Array.isArray(body.items)) {
      rawItems = body.items;
    } else if (body.sku && body.qty) {
      // Legacy fallback
      rawItems.push({
        sku: body.sku,
        qty: body.qty,
        docRef: body.docRef,
        salePrice: body.salePrice,
        location: body.location,
      });
    }

    if (rawItems.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    // Validate that each item has sku and positive qty
    const items = rawItems.filter((i: any) => i.sku && Number(i.qty) > 0);
    if (items.length === 0) {
      return NextResponse.json({ error: "No valid items with positive quantity provided" }, { status: 400 });
    }

    const defaultReason = String(body.reason || 'ส่งกลับ').trim();

    // Map to TransactionItem format with [ส่งกลับ] prefix
    const transactionItems = items.map((i: any) => {
      const baseRef = String(i.docRef || body.reason || defaultReason).trim();
      const orderNumber = baseRef.startsWith(RETURN_OUT_PREFIX)
        ? baseRef
        : `${RETURN_OUT_PREFIX} ${baseRef}`;

      return {
        itemCode: i.sku,
        quantity: Number(i.qty),
        orderNumber: orderNumber,
        price: i.salePrice ? Number(i.salePrice) : undefined,
        location: i.location ? normLoc(i.location) : undefined,
      };
    });

    await writeTransactionData(transactionItems);

    // Extra locations: stock picked from an extra bin reduces that bin
    const extraWarnings: string[] = [];
    const picked = transactionItems.filter((t: { location?: string }) => t.location);
    if (picked.length > 0) {
      const ssid = await resolveSpreadsheetId(body.branchId || null, 'inventory');
      for (const t of picked) {
        try {
          const { taken, isExtra } = await consumeExtraLocation(ssid, t.itemCode, t.location!, t.quantity, 'ReturnOut');
          if (isExtra && taken < t.quantity) {
            extraWarnings.push(`${t.itemCode}: ${t.location} มีไม่พอ ตัดได้ ${taken}/${t.quantity}`);
          }
        } catch (e) {
          console.error('[ReturnOut] extra-location update failed:', e);
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
      
      // Fetch current stock to calculate projected stock after this return-out
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
        userName: session?.user?.name || 'Return Out API',
        action: 'CREATE', 
        module: 'ReturnOut',
        description: `Returned out ${items.length} items (Doc: ${transactionItems[0].orderNumber}, Reason: ${body.reason || 'N/A'})`,
        newValues: { items: items, reason: body.reason }
      });
    } catch (err) {
      console.warn("Automation/Audit Failed:", err);
    }

    return NextResponse.json({
      success: true,
      message: `บันทึกส่งกลับสินค้า ${items.length} รายการสำเร็จ`,
      warnings: extraWarnings,
    });

  } catch (error: any) {
    console.error("Return Out API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
