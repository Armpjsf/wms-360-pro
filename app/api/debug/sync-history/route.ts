
import { NextResponse } from 'next/server';
import { 
    getPOLogs, 
    getTransactions, 
    addTransaction, 
    getProducts, 
    Transaction 
} from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        console.log('[SyncHistory] Starting History Sync...');

        // 1. Fetch Source: All Completed Orders from Archive (คลังข้อมูล)
        const allLogs = await getPOLogs();
        // Filter for "Completed" (เสร็จสิ้น) only
        const completedOrders = allLogs.filter(l => l.status === 'เสร็จสิ้น');
        
        console.log(`[SyncHistory] Found ${completedOrders.length} completed item rows in Archive.`);

        // 2. Fetch Destination: Existing OUT Transactions to prevent duplicates
        // We look for 'docRef' containing "Order: XXXXX"
        const existingTxs = await getTransactions('OUT');
        const existingOrderRefs = new Set<string>();
        
        existingTxs.forEach(tx => {
            if (!tx) return;
            if (tx.docRef && tx.docRef.startsWith('Order: ')) {
                // Extract Order No "Order: ADMIN-123" -> "ADMIN-123"
                const orderNo = tx.docRef.replace('Order: ', '').trim();
                existingOrderRefs.add(orderNo);
            }
        });

        console.log(`[SyncHistory] Found ${existingOrderRefs.size} already recorded orders in Transactions.`);

        // 3. Identify Missing Orders
        const missingItems = completedOrders.filter(item => {
            // If this Order No is already in our Set, skip it
            return !existingOrderRefs.has(item.orderNo);
        });

        if (missingItems.length === 0) {
            return NextResponse.json({ success: true, message: 'All orders already awaiting or synced.', count: 0 });
        }

        console.log(`[SyncHistory] Identified ${missingItems.length} missing item rows to sync.`);

        // 4. Load Products for Pricing (Standard Price at time of sync - best effort)
        const products = await getProducts();
        
        // 5. Insert Transactions
        let addedCount = 0;
        
        // Process sequentially or batch? Sequentially is safer for rate limits though slower.
        // Parallel in chunks?
        
        const CHUNK_SIZE = 5;
        for (let i = 0; i < missingItems.length; i += CHUNK_SIZE) {
            const chunk = missingItems.slice(i, i + CHUNK_SIZE);
            
            await Promise.all(chunk.map(async (row) => {
                const product = products.find(p => p.name === row.item || p.name.includes(row.item));
                const price = product ? product.price : 0;
                
                // Use Delivery Date if available, else derived date
                const txDate = row.deliveryDate || row.date;

                await addTransaction('OUT', {
                    date: txDate, // YYYY-MM-DD
                    sku: row.item,
                    qty: row.qty,
                    price: price,
                    docRef: `Order: ${row.orderNo}`,
                    unit: 'unit' // Default unit as it's not always in Log
                });
                addedCount++;
            }));
            
            console.log(`[SyncHistory] Synced batch ${i} - ${i + chunk.length}`);
        }

        return NextResponse.json({ 
            success: true, 
            message: `Successfully synced ${addedCount} items.`,
            count: addedCount 
        });

    } catch (error: any) {
        console.error('[SyncHistory] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
