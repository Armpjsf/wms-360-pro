
import { getSheetData, SPREADSHEET_ID } from '@/lib/googleSheets';

async function debugLocation() {
    console.log("--- Debugging Location Data ---");

    // 1. Check 'ชื่อสินค้า' (Product Master) Headers
    try {
        const productData = await getSheetData(SPREADSHEET_ID, "'ชื่อสินค้า'!A1:Z5");
        if (productData && productData.length > 0) {
            console.log("['ชื่อสินค้า' Headers]:", productData[0]);
        } else {
            console.log("'ชื่อสินค้า' sheet is empty or not found.");
        }
    } catch (e: any) {
        console.error("Error fetching 'ชื่อสินค้า':", e.message);
    }

    // 2. Check '📊 รายงานสินค้าคงเหลือ' (Inventory Report) Headers
    try {
        const reportData = await getSheetData(SPREADSHEET_ID, "'📊 รายงานสินค้าคงเหลือ'!A1:Q5");
        if (reportData && reportData.length > 0) {
            console.log("['📊 รายงานสินค้าคงเหลือ' Headers]:", reportData[0]);
            // Show a sample row to see where Location is
            if (reportData.length > 1) { 
                 console.log("Sample Row:", reportData[1]);
            }
        } else {
            console.log("'📊 รายงานสินค้าคงเหลือ' sheet is empty.");
        }
    } catch (e: any) {
        console.error("Error fetching '📊 รายงานสินค้าคงเหลือ':", e.message);
    }
}

debugLocation();
