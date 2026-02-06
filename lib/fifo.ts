
interface StockLayer {
    date: string;
    qty: number;
    daysOld: number;
}

interface AgingResult {
    sku: string;
    totalStock: number;
    oldestDate: string | null;
    maxDaysOld: number;
    layers: StockLayer[];
}

/**
 * Calculates current stock composition based on FIFO assumption.
 * effectively "peels back" the outbound transactions to see which inbound batches remain.
 * 
 * @param currentStock The current total quantity on hand
 * @param inboundLogs List of all inbound transactions (must be sorted by Date DESC or we will sort them)
 */
export function calculateFIFOLayers(currentStock: number, inboundLogs: any[]): AgingResult {
    // 1. Sort logs by date NEWEST first (Descending)
    // We walk backwards: The stock we have now usually comes from the most recent deliveries 
    // (Wait, no. FIFO means we sell old stuff first. So the stuff REMAINING is the NEWEST stuff.)
    // Correct logic: The Remaining Stock = The most recent Inbound batches.
    const sortedInbound = [...inboundLogs].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    let remainingToAccountFor = currentStock;
    const layers: StockLayer[] = [];
    let oldestDate = null;
    let maxDaysOld = 0;

    const today = new Date();

    for (const log of sortedInbound) {
        if (remainingToAccountFor <= 0) break;

        const logQty = Number(log.qty) || 0;
        if (logQty <= 0) continue;

        // How much of this batch is still here?
        // If we need 15, and batch matches 10. We take all 10. Remaining 5.
        // If we need 5, and batch has 10. We take 5. Remaining 0.
        const taken = Math.min(remainingToAccountFor, logQty);

        const logDate = new Date(log.date);
        const diffTime = Math.abs(today.getTime() - logDate.getTime());
        const daysOld = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        layers.push({
            date: log.date,
            qty: taken,
            daysOld
        });

        oldestDate = log.date;
        maxDaysOld = daysOld;

        remainingToAccountFor -= taken;
    }

    // Edge Case: If we still have stock but ran out of logs (e.g., initial stock wasn't logged)
    if (remainingToAccountFor > 0) {
        layers.push({
            date: "Unknown (Legacy)",
            qty: remainingToAccountFor,
            daysOld: 999 // Very old
        });
        maxDaysOld = 999;
    }

    return {
        sku: "N/A", // Caller sets this
        totalStock: currentStock,
        oldestDate,
        maxDaysOld,
        layers
    };
}

/**
 * Allocates a quantity to sell using FIFO or FEFO method.
 * Returns which "layers" (dated batches) the outbound will come from.
 * 
 * @param quantityToSell How much we want to ship out
 * @param inboundLogs All inbound transactions for this SKU (includes date and expiryDate fields)
 * @param alreadySold Total quantity already sold (outbound) for this SKU
 * @param method 'FIFO' (oldest receive date first) or 'FEFO' (earliest expiry first)
 */
export interface FIFOAllocation {
    date: string;        // Date of inbound batch
    expiryDate?: string; // Expiry date if available
    qtyFromLayer: number; // How many units from this batch
    daysOld: number;     // How old this batch is
}

export type AllocationMethod = 'FIFO' | 'FEFO';

export function allocateFIFO(
    quantityToSell: number,
    inboundLogs: any[],
    alreadySold: number = 0,
    method: AllocationMethod = 'FIFO'
): FIFOAllocation[] {
    // Sort logs based on method
    const sortedInbound = [...inboundLogs].sort((a, b) => {
        if (method === 'FEFO') {
            // Sort by expiry date ASC (earliest expiry first)
            // Items without expiry go last
            const expiryA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
            const expiryB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
            if (expiryA !== expiryB) return expiryA - expiryB;
            // Tie-breaker: older receive date first
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        } else {
            // FIFO: Sort by receive date ASC (oldest first)
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
    });

    // First, skip batches that have already been sold
    let soldRemaining = alreadySold;
    const today = new Date();
    const allocations: FIFOAllocation[] = [];
    let needToAllocate = quantityToSell;

    for (const log of sortedInbound) {
        const logQty = Number(log.qty) || 0;
        if (logQty <= 0) continue;

        // Calculate remaining in this batch after previous sales
        let availableInBatch = logQty;
        if (soldRemaining > 0) {
            const usedFromBatch = Math.min(soldRemaining, logQty);
            soldRemaining -= usedFromBatch;
            availableInBatch = logQty - usedFromBatch;
        }

        if (availableInBatch <= 0) continue;
        if (needToAllocate <= 0) break;

        // Allocate from this batch
        const allocated = Math.min(needToAllocate, availableInBatch);
        const logDate = new Date(log.date);
        const diffTime = Math.abs(today.getTime() - logDate.getTime());
        const daysOld = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        allocations.push({
            date: log.date,
            expiryDate: log.expiryDate || undefined,
            qtyFromLayer: allocated,
            daysOld
        });

        needToAllocate -= allocated;
    }

    return allocations;
}

