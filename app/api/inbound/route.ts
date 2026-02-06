import { NextResponse } from 'next/server';
import { addTransaction, getProducts } from '@/lib/googleSheets';
import { TransactionSchema } from '@/lib/schemas';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let items = [];

    // Support both single item (legacy) and multi-item (new)
    if (body.items && Array.isArray(body.items)) {
        items = body.items;
    } else if (body.sku && body.qty) {
        items.push(body);
    }

    if (items.length === 0) {
        return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    // Validate Items using Zod (Updated for Enterprise Fields)
    const ItemValidation = z.object({
        sku: z.string().min(1),
        qty: z.union([z.number().positive(), z.string().transform(v => parseFloat(v))]),
        docRef: z.string().optional(),
        date: z.string().optional(),
        salePrice: z.number().optional().or(z.string().transform(val => parseFloat(val))),
        // Enterprise Fields (Phase 14)
        batch: z.string().optional(),
        expiryDate: z.string().optional(),
        owner: z.string().optional(),
    });

    const results = z.array(ItemValidation).safeParse(items);
    if (!results.success) {
        return NextResponse.json({ 
            error: "Validation Failed", 
            details: results.error.format() 
        }, { status: 400 });
    }

    // Process each item using addTransaction (supports enterprise fields)
    const products = await getProducts();
    
    for (const item of items) {
        const product = products.find(p => p.name === item.sku);
        const cost = item.salePrice || (product?.price || 0); // Use provided price or lookup
        
        await addTransaction('IN', {
            date: item.date,
            sku: item.sku,
            qty: Number(item.qty),
            price: cost,
            unit: product?.unit || 'pcs',
            docRef: item.docRef || '',
            // Enterprise Fields
            batch: item.batch || '',
            expiryDate: item.expiryDate || '',
            owner: item.owner || ''
        });
    }

    // Automation & Audit
    try {
      const { logAction } = await import('@/lib/auditTrail');
      const { checkStockRules } = await import('@/lib/automation');

      // Parallelize rule checking
      const productsRefresh = await getProducts();
      await Promise.all(items.map(async (tx: any) => {
          const product = productsRefresh.find(p => p.name === tx.sku);
          if (product) {
              const newStock = product.stock + Number(tx.qty);
              await checkStockRules(tx.sku, newStock);
          }
      }));

      await logAction({
        userId: 'System', 
        userName: 'Inbound API',
        action: 'CREATE',
        module: 'Inbound',
        description: `Received ${items.length} items (Doc: ${items[0].docRef || 'N/A'})`,
        newValues: { items: items }
      });
    } catch (err) {
      console.warn("Automation/Audit Failed:", err);
    }

    return NextResponse.json({ success: true, message: `Captured ${items.length} items` });

  } catch (error: any) {
    console.error("Inbound API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

