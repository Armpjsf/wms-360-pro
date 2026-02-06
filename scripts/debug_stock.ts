
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

// HARDCODE IDs for Debugging to avoid import issues
const SPREADSHEET_ID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM"; 
const SERVICE_KEY_PATH = path.join(process.cwd(), "service-key.json");

async function getGoogleSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as any });
}

async function debugSheet(sheetName: string) {
    console.log(`\n--- Debugging Sheet: ${sheetName} ---`);
    const sheets = await getGoogleSheets();
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetName}'!A1:Z20`, // Fetch top 20 rows
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log("No data found.");
            return;
        }

        const headers = rows[0];
        console.log("HEADERS:", JSON.stringify(headers));
        
        console.log("ROW 1 (Raw):", JSON.stringify(rows[1]));

        // Simulate logic
        const idxDate = headers.findIndex(h => h.includes('วันที่'));
        const idxName = headers.findIndex(h => h.includes('ชื่อสินค้า') || h.includes('รายการ'));
        const idxQty = headers.findIndex(h => {
             const val = h.trim();
             return (val === 'จำนวน' || val === 'จำนวนที่รับ' || val === 'จำนวนที่ซื้อ' || val === 'จำนวนที่ขาย' || val === 'Quantity' || val === 'Qty') && !val.includes('เงิน');
        });

        console.log(`Indices found -> Date: ${idxDate}, Name: ${idxName}, Qty: ${idxQty}`);

        if (rows.length > 1) {
            const r = rows[1];
            console.log("Mapped Row 1:");
            console.log("Date Column Value:", r[idxDate]);
            console.log("Name Column Value:", r[idxName]);
            console.log("Qty Column Value:", r[idxQty]);
        }

    } catch (e: any) {
        console.log("Error:", e.message);
    }
}

async function listAllSheets() {
    console.log(`\n--- Listing All Sheets ---`);
    const sheets = await getGoogleSheets();
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });
        
        const sheetList = response.data.sheets?.map(s => s.properties?.title) || [];
        console.log("Available Sheets:", JSON.stringify(sheetList, null, 2));
        return sheetList;
    } catch (e: any) {
        console.log("Error listing sheets:", e.message);
        return [];
    }
}

async function main() {
    const allSheets = await listAllSheets();
    const cycleSheet = allSheets.find(s => s && s.toLowerCase().includes('cycle')) || 'CycleCount_Log';
    console.log(`\nDerived Sheet Name: ${cycleSheet}`);
    await debugSheet(cycleSheet);
}

main();
