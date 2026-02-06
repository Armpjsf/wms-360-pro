
import { getSheetData, SPREADSHEET_ID } from "../lib/googleSheets";

async function inspectHeaders() {
    console.log("Starting Header Inspection...");
    console.log(`Spreadsheet ID: ${SPREADSHEET_ID}`);

    try {
        // Check '📊 รายงานสินค้าคงเหลือ'
        console.log("\n--- Checking '📊 รายงานสินค้าคงเหลือ' ---");
        const reportData = await getSheetData(SPREADSHEET_ID, "'📊 รายงานสินค้าคงเหลือ'!A1:Z5");
        if (reportData && reportData.length > 0) {
            const headers = reportData[0];
            console.log("Headers found:", headers);
            
            // Simulate the logic from route.ts
            const getCol = (keywords: string[]) => headers.findIndex((h: any) => {
                if (typeof h !== 'string') return false;
                const val = h.toLowerCase().trim();
                return keywords.some(k => val.includes(k.toLowerCase()));
            });

            const idxStock = getCol(['จำนวนสินค้าคงเหลือ', 'stock', 'balance', 'คงเหลือ', 'qty']);
            console.log(`Matched Stock Column Index: ${idxStock} (Value: '${headers[idxStock]}')`);
            
            if (idxStock > -1) {
                console.log("Sample Row 1 Stock Value:", reportData[1]?.[idxStock]);
            }
        } else {
            console.log("Sheet not found or empty.");
        }

        // Check 'ชื่อสินค้า'
        console.log("\n--- Checking 'ชื่อสินค้า' (Fallback) ---");
        const masterData = await getSheetData(SPREADSHEET_ID, "'ชื่อสินค้า'!A1:Z5");
        if (masterData && masterData.length > 0) {
            const headers = masterData[0];
            console.log("Headers found:", headers);
             // Simulate Logic
             const getCol = (keywords: string[]) => headers.findIndex((h: any) => {
                if (typeof h !== 'string') return false;
                const val = h.toLowerCase().trim();
                return keywords.some(k => val.includes(k.toLowerCase()));
            });
             const idxStock = getCol(['จำนวนสินค้าคงเหลือ', 'stock', 'balance', 'คงเหลือ', 'qty']);
             console.log(`Matched Stock Column Index: ${idxStock} (Value: '${headers[idxStock]}')`);
             if (idxStock > -1) {
                console.log("Sample Row 1 Stock Value:", masterData[1]?.[idxStock]);
            }
        } else {
             console.log("Sheet not found or empty.");
        }

    } catch (error) {
        console.error("Error inspecting headers:", error);
    }
}

inspectHeaders();
