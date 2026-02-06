
import { getActiveItemsToday, getCycleCountLogs, getStockMovement } from '@/lib/googleSheets';

async function test() {
    console.log("--- Testing Cycle Count Logic ---");

    // 1. Test getActiveItemsToday
    try {
        console.log("Fetching Active Items Today...");
        const activeItems = await getActiveItemsToday();
        console.log("Active Items:", activeItems);
    } catch (e: any) {
        console.error("Error in getActiveItemsToday:", e.message);
    }

    // 2. Test getCycleCountLogs
    try {
        console.log("\nFetching Cycle Count Logs...");
        const logs = await getCycleCountLogs();
        console.log(`Found ${logs.length} logs.`);
        if (logs.length > 0) {
            console.log("First Log:", logs[0]);
        }
    } catch (e: any) {
        console.error("Error in getCycleCountLogs:", e.message);
    }

    // 3. Test getStockMovement (Stock Card)
    try {
        const testSku = "A09001NT082977E"; // From user's previous debug output
        console.log(`\nFetching Stock Movement for ${testSku}...`);
        const movements = await getStockMovement(testSku);
        console.log(`Found ${movements.length} movements.`);
        if (movements.length > 0) {
            console.log("Last 2 movements:", movements.slice(-2));
        }
    } catch (e: any) {
        console.error("Error in getStockMovement:", e.message);
    }
}

test();
