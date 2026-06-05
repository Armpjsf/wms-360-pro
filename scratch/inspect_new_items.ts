import { getGoogleSheets } from "../lib/googleSheets";

async function main() {
  const SSID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
  const { googleSheets, auth } = await getGoogleSheets();
  
  // Fetch products and transactions
  const invRes = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'📊 รายงานสินค้าคงเหลือ'!A2:J200",
  });
  const recvRes = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'💸 Transaction รับ'!A2:C500",
  });

  const products = invRes.data.values || [];
  const transactions = recvRes.data.values || [];

  console.log(`Total Products: ${products.length}`);
  console.log(`Total Receive Transactions: ${transactions.length}`);

  // Find products that have "no time limit" in Col I (index 8) or empty Col H (index 7)
  const neverSoldProducts = products.filter(p => p[8] === "no time limit" || !p[7]);
  console.log(`\nProducts that have never been sold (no time limit): ${neverSoldProducts.length}`);

  // Let's print some of them and their receive transactions
  console.log("\nSample never sold products and their received records in '💸 Transaction รับ':");
  for (const p of neverSoldProducts.slice(0, 10)) {
    const name = p[0];
    const status = p[9]; // Column J: types of movement
    const recs = transactions.filter(t => t[1] === name);
    console.log(`- Product: "${name}", Current Status in Col J: "${status}"`);
    if (recs.length === 0) {
      console.log(`  -> No receive transactions found in '💸 Transaction รับ'!`);
    } else {
      recs.forEach(r => {
        console.log(`  -> Received Date: "${r[0]}", Qty: ${r[2]}`);
      });
    }
  }
}

main().catch(console.error);
