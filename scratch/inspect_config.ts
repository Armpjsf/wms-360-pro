import { getGoogleSheets } from "../lib/googleSheets";

async function main() {
  const SSID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
  const { googleSheets, auth } = await getGoogleSheets();
  
  const res = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SSID,
    range: "'⚙️ Config'!H1:H2",
    valueRenderOption: "FORMULA",
  });
  console.log("Config H1 Formula/Value:", res.data.values?.[0]?.[0]);
}

main().catch(console.error);
