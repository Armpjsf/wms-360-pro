import { getGoogleSheets } from "../lib/googleSheets";

async function main() {
  const SSID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
  const { googleSheets, auth } = await getGoogleSheets();
  
  console.log("--- Inspecting '📊 รายงานสินค้าคงเหลือ' ---");
  const invRes = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'📊 รายงานสินค้าคงเหลือ'!A1:Z5",
  });
  console.log("Headers:", invRes.data.values?.[0]);
  console.log("Row 2:", invRes.data.values?.[1]);
  console.log("Row 3:", invRes.data.values?.[2]);

  console.log("\n--- Inspecting '💸 Transaction รับ' ---");
  const recvRes = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'💸 Transaction รับ'!A1:Z5",
  });
  console.log("Headers:", recvRes.data.values?.[0]);
  console.log("Row 2:", recvRes.data.values?.[1]);
  console.log("Row 3:", recvRes.data.values?.[2]);
}

main().catch(console.error);
