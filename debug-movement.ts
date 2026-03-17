
import { getProducts, getTransactionsUncached } from './lib/googleSheets';

async function test() {
    console.log("Testing Movement Calculation...");

    // 1. Fetch Transactions
    console.log("Fetching OUT Transactions...");
    const transactions = await getTransactionsUncached('OUT', '1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM');
    console.log(`Fetched ${transactions.length} transactions.`);
    
    if (transactions.length > 0) {
        console.log("Sample Transaction:");
        console.log(transactions[0]);
    }

    // 2. Fetch Products
    console.log("\nFetching Products...");
    const products = await getProducts();
    console.log(`Fetched ${products.length} products.`);

    // 3. Check Status
    const fast = products.filter(p => p.movementStatus === 'Fast Moving').length;
    const normal = products.filter(p => p.movementStatus === 'Normal Moving').length;
    const slow = products.filter(p => p.movementStatus === 'Slow Moving').length;
    const dead = products.filter(p => p.movementStatus === 'Deadstock').length;
    const unknown = products.filter(p => !p.movementStatus).length;

    console.log("\nMovement Status Distribution:");
    console.log(`Fast: ${fast}`);
    console.log(`Normal: ${normal}`);
    console.log(`Slow: ${slow}`);
    console.log(`Dead: ${dead}`);
    console.log(`Unknown: ${unknown}`);

    if (products.length > 0) {
        console.log("\nSample Product:");
        console.log(JSON.stringify(products[0], null, 2));
    }
}

test().catch(console.error);
