
import { getGoogleSheets, SPREADSHEET_ID, PO_SPREADSHEET_ID } from '../lib/googleSheets';

async function listSheets() {
    const { googleSheets, auth } = await getGoogleSheets();

    async function printSheets(id: string, label: string) {
        console.log(`\n--- Sheets in ${label} (${id}) ---`);
        try {
            const res = await googleSheets.spreadsheets.get({
                auth: auth as any, // Cast to any to avoid complex type matching in script
                spreadsheetId: id
            });
            const sheets = res.data.sheets;
            if (sheets) {
                sheets.forEach(s => console.log(`- ${s.properties?.title}`));
            } else {
                console.log("No sheets found.");
            }
        } catch (e: any) {
            console.error(`Error fetching ${label}: ${e.message}`);
        }
    }

    await printSheets(SPREADSHEET_ID, "MAIN SPREADSHEET");
    await printSheets(PO_SPREADSHEET_ID, "PO SPREADSHEET");
}

listSheets();
