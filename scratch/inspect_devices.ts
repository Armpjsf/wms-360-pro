import { getGoogleSheets } from "../lib/googleSheets";

async function main() {
  const SSID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
  const { googleSheets } = await getGoogleSheets();
  
  console.log("--- Inspecting '📱 Devices' ---");
  try {
    const res = await googleSheets.spreadsheets.values.get({
      spreadsheetId: SSID,
      range: "'📱 Devices'!A1:C10",
    });
    console.log("Values found:", res.data.values);
  } catch (err: any) {
    console.error("Failed to read '📱 Devices' sheet:", err.message);
  }
}

main().catch(console.error);
