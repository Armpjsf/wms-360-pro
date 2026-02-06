
import { getSheetData, SPREADSHEET_ID, PO_SPREADSHEET_ID } from '../lib/googleSheets';

async function testPOLog() {
    console.log("--- Debugging PO Log ---");
    console.log(`Main Spreadsheet ID: ${SPREADSHEET_ID}`);
    console.log(`PO Spreadsheet ID: ${PO_SPREADSHEET_ID}`);

    // Test Main Sheet '🛒 PO'
    try {
        console.log("\nAttempting to read '🛒 PO' from Main Sheet...");
        const data = await getSheetData(SPREADSHEET_ID, "'🛒 PO'!A1:Z5");
        if (data && data.length > 0) {
            console.log("✅ Found '🛒 PO' data.");
            console.log("Headers:", data[0]);
            console.log("Row 1:", data[1]);
        } else {
            console.log("❌ '🛒 PO' empty or not found in Main Sheet.");
        }
    } catch (e) {
        console.error("Error reading Main '🛒 PO':", e);
    }

    // Test Separate PO Sheet
    try {
        console.log("\nAttempting to read 'คลังข้อมูล' from PO Spreadsheet...");
        const data = await getSheetData(PO_SPREADSHEET_ID, "'คลังข้อมูล'!A1:Z5");
        if (data && data.length > 0) {
            console.log("✅ Found 'คลังข้อมูล' data in PO Spreadsheet.");
            console.log("Headers:", data[0]);
            console.log("Row 1:", data[1]);
        } else {
            console.log("❌ 'คลังข้อมูล' empty or not found in PO Spreadsheet.");
        }
    } catch (e) {
        console.error("Error reading PO Spreadsheet:", e);
    }
}

testPOLog();
