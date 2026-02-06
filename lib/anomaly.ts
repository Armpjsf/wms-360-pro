
export interface AnomalyIssue {
    id: string;
    type: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    description: string;
    entityId?: string; // Product ID or Log ID
    entityName?: string;
    value?: string | number;
    action?: 'FIX_STOCK' | 'REVIEW';
}

export function detectAnomalies(products: any[], logs: any[] = []): AnomalyIssue[] {
    const issues: AnomalyIssue[] = [];
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Negative Stock (Critical)
    products.forEach(p => {
        if (p.stock < 0) {
            issues.push({
                id: `neg-${p.id}`,
                type: 'CRITICAL',
                title: 'Negative Inventory Detected',
                description: `Stock level is ${p.stock}. This is physically impossible and affects valuation.`,
                entityId: p.id,
                entityName: p.name,
                value: p.stock,
                action: 'FIX_STOCK'
            });
        }
    });

    // 2. High Value Variance (Critical)
    // Check recent cycle counts or adjustments
    // (Assuming logs have 'variance' and 'system_qty' fields)
    logs.forEach(log => {
        if (log.type === 'CYCLE_COUNT' && log.variance) {
            const variance = Math.abs(log.variance);
            const system = Math.abs(log.system_qty || 1);
            const percent = (variance / system) * 100;
            
            if (percent > 50 && system > 5) {
                issues.push({
                    id: `var-${log.id}`,
                    type: 'WARNING',
                    title: 'Suspicious Stock Adjustment',
                    description: `Stock adjusted by ${percent.toFixed(0)}% (Qty: ${log.variance}). Double check for counting errors.`,
                    entityId: log.id,
                    entityName: log.product_name,
                    value: `${percent.toFixed(0)}%`,
                    action: 'REVIEW'
                });
            }
        }
    });

    // 3. Ghost Inventory (Warning)
    // Stock exists but location is empty/null/dash
    products.forEach(p => {
        if (p.stock > 0 && (!p.location || p.location === '-' || p.location === '')) {
             issues.push({
                id: `ghost-${p.id}`,
                type: 'WARNING',
                title: 'Ghost Inventory',
                description: `Item has ${p.stock} units but no assigned location. It may be lost in the warehouse.`,
                entityId: p.id,
                entityName: p.name,
                value: p.stock,
                action: 'REVIEW'
            });
        }
    });

    // 4. Time Travelers (Info)
    // Dates in the future
    logs.forEach(log => {
        if (log.date) {
            const logDate = new Date(log.date);
            // Check if logDate is more than 2 days in future (timezone buffer)
            const futureBuffer = new Date(today);
            futureBuffer.setDate(futureBuffer.getDate() + 2);
            
            if (logDate > futureBuffer) {
                 issues.push({
                    id: `future-${log.id}`,
                    type: 'INFO',
                    title: 'Future Date Detected',
                    description: `Transaction recorded for ${log.date}. Ensure this is intended (e.g. pre-booking).`,
                    entityId: log.id,
                    entityName: log.product_name || 'Unknown',
                    value: log.date,
                    action: 'REVIEW'
                });
            }
        }
    });

    return issues.sort((a, b) => {
        const score = { CRITICAL: 3, WARNING: 2, INFO: 1 };
        return score[b.type] - score[a.type];
    });
}
