import { getGoogleSheets } from "../lib/googleSheets";

async function main() {
  const SSID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
  const { googleSheets, auth } = await getGoogleSheets();
  
  const recvRes = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'💸 Transaction รับ'!A1:Z1000",
  });

  const transactions = recvRes.data.values || [];
  console.log("--- Inspecting received transactions on the 21st ---");
  
  transactions.slice(1).forEach((row, i) => {
    const date = row[0] || "";
    const name = row[1] || "";
    if (date.includes("21")) {
      console.log(`Row ${i + 2}: Date: "${date}" | Product: "${name}" | Qty: "${row[2]}"`);
    }
  });
}

main().catch(console.error);
