
export interface SlottingInsight {
    productId: string;
    productName: string;
    currentLocation: string;
    velocityScore: number; // Number of outbound items or transactions
    class: 'A' | 'B' | 'C' | 'D'; // A=Top20%, B=Next30%, C=Bottom50%, D=Deadstock
    idealZone: string;
    action: 'MOVE_FORWARD' | 'MOVE_BACK' | 'KEEP';
    reason: string;
}

export function performABCAnalysis(products: any[], transactions: any[]): SlottingInsight[] {
    // 1. Calculate Velocity (Total Outbound Qty) per Product
    const velocityMap = new Map<string, number>();
    
    transactions.forEach(t => {
        if (t.type === 'OUT' || t.transaction_type === 'OUT') {
            const pid = t.product_id || t.productId; // handle various data shapes
            // Fallback: match by name if ID missing (legacy data)
            const key = pid || t.product || t.product_name; 
            
            if (key) {
                const qty = Number(t.qty || t.quantity || 0);
                velocityMap.set(key, (velocityMap.get(key) || 0) + qty);
            }
        }
    });

    // 2. Rank Products
    const rankedProducts = products.map(p => {
        const key = p.id || p.name; // Match method above
        const velocity = velocityMap.get(key) || 0;
        return { ...p, velocity };
    }).sort((a, b) => b.velocity - a.velocity);

    const totalItems = rankedProducts.length;
    const insights: SlottingInsight[] = [];

    // 3. Assign Classes (A=Top 20%, B=Next 30%, C=Rest)
    // Note: D = Deadstock (Velocity = 0)
    let accumCount = 0;

    rankedProducts.forEach((p, index) => {
        let assignedClass: 'A' | 'B' | 'C' | 'D' = 'C';
        
        if (p.velocity === 0) {
            assignedClass = 'D';
        } else {
            const percentile = (index / totalItems) * 100;
            if (percentile <= 20) assignedClass = 'A';
            else if (percentile <= 50) assignedClass = 'B';
            else assignedClass = 'C';
        }

        // 4. Determine Action based on current location (Heuristic)
        // Heuristic: "Zone A" is front, "Zone B" middle, "Zone C" back.
        // If location string starts with 'A' but class is 'C', move back.
        const currentLoc = p.location || '';
        let action: 'MOVE_FORWARD' | 'MOVE_BACK' | 'KEEP' = 'KEEP';
        let idealZone = 'Any';
        let reason = 'Good placement.';

        // Simple Regex heuristic for Zone (assuming format "A-xx-xx")
        const currentZoneMatch = currentLoc.match(/^([A-Z])/); 
        const currentZone = currentZoneMatch ? currentZoneMatch[1] : null;

        if (assignedClass === 'A') {
            idealZone = 'Front / Zone A';
            if (currentZone && currentZone > 'A') { // e.g. B or C
                action = 'MOVE_FORWARD';
                reason = `High velocity item (Class A) found in Zone ${currentZone}. Move to front for faster picking.`;
            }
        } else if (assignedClass === 'C' || assignedClass === 'D') {
            idealZone = 'Back / Zone C';
            if (currentZone && currentZone < 'C') { // e.g. A or B
                action = 'MOVE_BACK';
                reason = `Low velocity item (Class ${assignedClass}) occupying premium space in Zone ${currentZone}.`;
            }
        } else {
            idealZone = 'Middle / Zone B';
        }

        insights.push({
            productId: p.id,
            productName: p.name,
            currentLocation: p.location || 'Unassigned',
            velocityScore: p.velocity,
            class: assignedClass,
            idealZone,
            action,
            reason
        });
    });

    return insights;
}
