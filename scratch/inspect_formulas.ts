import { getGoogleSheets } from "../lib/googleSheets";

async function main() {
  const SSID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
  const { googleSheets, auth } = await getGoogleSheets();
  
  const formulaRes = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'📊 รายงานสินค้าคงเหลือ'!A1:K10",
    valueRenderOption: "FORMULA",
  });

  const rows = formulaRes.data.values || [];
  console.log("--- Inspecting actual cell formulas/values ---");
  rows.forEach((row, i) => {
    console.log(`Row ${i + 1}:`);
    console.log(`- Product Name (Col A): "${row[0] || ''}"`);
    console.log(`- Last Sold (Col H): "${row[7] || ''}"`);
    console.log(`- Days Inactive (Col I): "${row[8] || ''}"`);
    console.log(`- Movement Status (Col J): "${row[9] || ''}"`);
  });
}

main().catch(console.error);
