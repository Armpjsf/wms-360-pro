import { getGoogleSheets } from "../lib/googleSheets";

async function main() {
  const SSID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
  const { googleSheets, auth } = await getGoogleSheets();
  
  const invRes = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'📊 รายงานสินค้าคงเหลือ'!A1:Z200",
  });
  const recvRes = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'💸 Transaction รับ'!A1:Z500",
  });

  const allInvRows = invRes.data.values || [];
  const allRecvRows = recvRes.data.values || [];

  const invHeaders = allInvRows[0] || [];
  const products = allInvRows.slice(1).filter(p => p[0] && p[0].trim() !== ""); // Filter out blank rows

  const recvHeaders = allRecvRows[0] || [];
  const transactions = allRecvRows.slice(1).filter(t => t[1] && t[1].trim() !== "");

  console.log("Inventory headers:", invHeaders);
  console.log("Receive headers:", recvHeaders);
  console.log(`Total valid products: ${products.length}`);
  console.log(`Total valid transactions: ${transactions.length}`);

  // Let's find products where the days-since-sold column (Col I, index 8) is "no time limit"
  const neverSold = products.filter(p => p[8] === "no time limit");
  console.log(`\nProducts with 'no time limit' (never sold): ${neverSold.length}`);

  for (const p of neverSold) {
    const name = p[0];
    const colI = p[8];
    const colJ = p[9]; // Movement Status
    const recs = transactions.filter(t => t[1] === name);
    
    console.log(`- Product: "${name}" | Col I: "${colI}" | Col J: "${colJ}"`);
    if (recs.length === 0) {
      console.log(`  -> No receive transactions found in '💸 Transaction รับ'`);
    } else {
      recs.forEach(r => {
        console.log(`  -> Receive Date: "${r[0]}" | Qty: ${r[2]}`);
      });
    }
  }
}

main().catch(console.error);
