
export function calculateRiskLevel(stock: number, avgDemand: number) {
    if (stock <= 0) return { level: 'Very High', score: 4 };
    
    // Days Supply
    const days = avgDemand > 0 ? stock / (avgDemand / 30) : 999;
    
    if (days < 7) return { level: 'High', score: 3 };
    if (days < 14) return { level: 'Medium', score: 2 };
    return { level: 'Low', score: 1 };
}

export function recommendReorder(stock: number, avgMonthlyDemand: number, leadTimeDays: number = 7, safetyStockDays: number = 7) {
    const dailyDemand = avgMonthlyDemand / 30;
    const reorderPoint = (dailyDemand * leadTimeDays) + (dailyDemand * safetyStockDays);
    
    if (stock < reorderPoint) {
        return {
            action: 'Reorder Now',
            qty: Math.ceil(reorderPoint - stock + (avgMonthlyDemand * 0.5)) // Top up to half month extra? Simplified logic.
        };
    }
    
    return { action: 'OK', qty: 0 };
}
