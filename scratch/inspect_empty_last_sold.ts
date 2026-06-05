import { getGoogleSheets } from "../lib/googleSheets";

async function main() {
  const SSID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
  const { googleSheets, auth } = await getGoogleSheets();
  
  const invRes = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'📊 รายงานสินค้าคงเหลือ'!A1:Z200",
  });

  const allInvRows = invRes.data.values || [];
  const products = allInvRows.slice(1).filter(p => p[0] && p[0].trim() !== "");

  console.log(`Total active products in inventory: ${products.length}`);

  // Let's filter products where Col H (index 7) is empty or not a date, or see what values exist in Col H and I.
  const emptyLastSold = products.filter(p => !p[7] || p[7].trim() === "");
  console.log(`Products with blank last sold date (Col H): ${emptyLastSold.length}`);

  if (emptyLastSold.length > 0) {
    console.log("\nSample products with blank last sold date:");
    emptyLastSold.slice(0, 10).forEach(p => {
      console.log(`- Name: "${p[0]}" | Col H (Last Sold): "${p[7] || ''}" | Col I (Days Inactive): "${p[8] || ''}" | Col J (Movement): "${p[9] || ''}"`);
    });
  } else {
    console.log("\nAll products have a last sold date in Col H! Let's print the first 10 products' Col H and I:");
    products.slice(0, 10).forEach(p => {
      console.log(`- Name: "${p[0]}" | Col H (Last Sold): "${p[7] || ''}" | Col I (Days Inactive): "${p[8] || ''}" | Col J (Movement): "${p[9] || ''}"`);
    });
  }
}

main().catch(console.error);
