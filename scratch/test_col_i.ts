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

  const items = products.slice(1).filter(p => p[0] && p[0].trim() !== "");
  const mockToday = new Date("2026-05-26"); // Today's date in local time

  console.log("--- Simulating Column I (จำนวนวันที่ไม่เคลื่อนไหว) ---");
  
  items.slice(0, 15).forEach(p => {
    const name = p[0];
    const status = p[4];
    const lastSold = p[7];
    const originalColI = p[8];

    let simulatedColI: string | number = 0;
    if (status === "InActive") {
      simulatedColI = "-";
    } else if (lastSold === "no date" || lastSold === "") {
      const recs = transactions.filter(t => t[1] === name);
      if (recs.length === 0) {
        simulatedColI = 0;
      } else {
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
          simulatedColI = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } else {
          simulatedColI = 0;
        }
      }
    } else {
      const d = new Date(lastSold);
      if (!isNaN(d.getTime())) {
        const diffTime = Math.abs(mockToday.getTime() - d.getTime());
        simulatedColI = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    console.log(`Product: "${name}" | Last Sold: "${lastSold}" | Original I: "${originalColI}" | New Sim I: "${simulatedColI}"`);
  });
}

main().catch(console.error);
