import { getSheetData, SPREADSHEET_ID } from '../lib/googleSheets';

async function main() {
    try {
        console.log("Reading 'Config_Branches'...");
        const data = await getSheetData(SPREADSHEET_ID, "'Config_Branches'!A1:Z50");
        console.log("Data from 'Config_Branches':");
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}
main();
