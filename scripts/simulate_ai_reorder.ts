
import { calculateTrend, calculateSafetyStock } from '../lib/forecast';

async function simulateAI() {
    console.log("🧠 SIMULATING AI LOGIC...");

    // Mock Data: 30 days of sales (trending up)
    const mockUsage = [
        2, 2, 3, 2, 4, 3, 5, 4, 6, 5,
        7, 6, 8, 7, 9, 8, 10, 9, 12, 10,
        14, 12, 15, 14, 18, 16, 20, 18, 22, 20
    ];

    console.log(`\nMock Data (Last 30 Days): ${mockUsage.join(', ')}`);

    // 1. Trend Analysis
    const trend = calculateTrend(mockUsage);
    console.log("\n[1] Trend Analysis:");
    console.log(`- Slope: ${trend.slope.toFixed(2)} (Expected > 0)`);
    console.log(`- Growth: ${trend.growthRate.toFixed(1)}%`);
    console.log(`- Direction: ${trend.trend}`);
    console.log(`- Next Day Prediction: ${trend.prediction.toFixed(2)}`);

    if (trend.trend !== 'UP') {
        console.error("❌ Trend Logic Failed: Should be UP");
    } else {
        console.log("✅ Trend Logic OK");
    }

    // 2. Safety Stock
    const safetyStock = calculateSafetyStock(mockUsage, 7); // Lead time 7 days
    console.log("\n[2] Safety Stock (Lead Time 7 Days):");
    console.log(`- Safety Stock Buffer: ${safetyStock}`);
    
    if (safetyStock <= 0) {
        console.error("❌ Safety Stock Failed: Should be > 0");
    } else {
        console.log("✅ Safety Stock Logic OK");
    }

    // 3. Reorder Point (ROP)
    const avgDaily = mockUsage.reduce((a, b) => a + b, 0) / 30;
    const leadTimeDemand = avgDaily * 7;
    const rop = Math.ceil(leadTimeDemand + safetyStock);

    console.log("\n[3] Reorder Point Calc:");
    console.log(`- Avg Daily: ${avgDaily.toFixed(2)}`);
    console.log(`- Lead Time Demand: ${leadTimeDemand.toFixed(2)}`);
    console.log(`- Calculated ROP: ${rop}`);

    console.log("\n==================================");
    console.log(" AI LOGIC VERIFICATION COMPLETE");
    console.log("==================================");
}

simulateAI();
