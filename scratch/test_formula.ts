import { getGoogleSheets } from "../lib/googleSheets";

async function main() {
  const SSID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
  const { googleSheets, auth } = await getGoogleSheets();
  
  const invRes = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'📊 รายงานสินค้าคงเหลือ'!A1:K200",
  });
  const recvRes = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'💸 Transaction รับ'!A1:Z500",
  });

  const products = invRes.data.values || [];
  const transactions = recvRes.data.values || [];

  const headers = products[0];
  const items = products.slice(1).filter(p => p[0] && p[0].trim() !== "");

  const mockToday = new Date("2026-05-26"); // Today's date in local time

  console.log("--- Testing the new formula logic ---");
  
  // Let's test the specific products that have "no date" in Col H
  const neverSold = items.filter(p => p[7] === "no date");
  console.log(`Found ${neverSold.length} products with 'no date' in Column H`);

  neverSold.forEach(p => {
    const name = p[0];
    const status = p[4]; // Column E: Status (Active/InActive)
    const lastSold = p[7]; // Column H: "no date"
    const daysSinceSold = p[8]; // Column I: "0"

    // Simulate formula logic
    let simulatedStatus = "Deadstock";
    if (status === "InActive") {
      simulatedStatus = "InActive";
    } else if (lastSold === "no date" || lastSold === "") {
      // Find received transactions
      const recs = transactions.filter(t => t[1] === name);
      if (recs.length === 0) {
        simulatedStatus = "Normal Moving"; // Never received and never sold
      } else {
        // Find MIN date
        let firstRecvDate: Date | null = null;
        recs.forEach(r => {
          const d = new Date(r[0]);
          if (!isNaN(d.getTime())) {
            if (firstRecvDate === null || d < firstRecvDate) {
              firstRecvDate = d;
            }
          }
        });

        if (firstRecvDate !== null) {
          const diffTime = Math.abs(mockToday.getTime() - firstRecvDate.getTime());
          const daysSinceRecv = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (daysSinceRecv <= 90) {
            simulatedStatus = "Normal Moving";
          } else if (daysSinceRecv <= 180) {
            simulatedStatus = "Very Slow Moving";
          } else {
            simulatedStatus = "Deadstock";
          }
          console.log(`Product: "${name}" | First Receive: "${firstRecvDate.toISOString().split('T')[0]}" | Days Since Recv: ${daysSinceRecv} => Status: "${simulatedStatus}"`);
        } else {
          simulatedStatus = "Normal Moving";
        }
      }
    }

    // Compare with current status in Column J
    const currentStatus = p[9];
    // console.log(`Result: ${simulatedStatus} (Current J: ${currentStatus})`);
  });
}

main().catch(console.error);
