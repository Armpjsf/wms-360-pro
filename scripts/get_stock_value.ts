
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const SPREADSHEET_ID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM"; 

async function getGoogleSheetsAuth() {
    const keyPath = path.join(process.cwd(), 'service-key.json');
    const auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    return { auth, client: await auth.getClient() };
}

async function getStockValue() {
    console.log("=== CALCULATING INVENTORY VALUE ===");
    try {
        const { auth } = await getGoogleSheetsAuth();
        const sheets = google.sheets({ version: 'v4', auth });

        // Fetch Product Report
        // Try '📊 รายงานสินค้าคงเหลือ' first
        let range = "'📊 รายงานสินค้าคงเหลือ'!A1:Z2000";
        let res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
        
        if (!res.data.values) {
             console.log("Fallback to 'ชื่อสินค้า'");
             range = "'ชื่อสินค้า'!A1:Z2000";
             res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
        }

        const rows = res.data.values;
        if (!rows || rows.length < 2) {
            console.log("No data found.");
            return;
        }

        const headers = rows[0];
        console.log("Headers:", headers);
        
        // Find indices
        const idxStock = headers.findIndex(h => h.includes('คงเหลือ') || h.includes('Stock'));
        const idxPrice = headers.findIndex(h => h.includes('ราคา') || h.includes('Price') || h.includes('ทุน'));
        const idxName = headers.findIndex(h => h.includes('ชื่อสินค้า') || h.includes('Name'));

        console.log(`Indices -> Name: ${idxName}, Stock: ${idxStock}, Price: ${idxPrice}`);

        if (idxStock === -1 || idxPrice === -1) {
            console.error("Cannot find Stock or Price column.");
            return;
        }

        let totalValue = 0;
        let validItems = 0;

        rows.slice(1).forEach(row => {
            if (!row[idxName]) return;

            const stockStr = (row[idxStock] || '0').replace(/,/g, '');
            const priceStr = (row[idxPrice] || '0').replace(/,/g, '');

            const stock = parseFloat(stockStr) || 0;
            const price = parseFloat(priceStr) || 0;

            if (stock > 0) {
                totalValue += stock * price;
                validItems++;
            }
        });

        console.log(`\n-----------------------------------`);
        console.log(`Total Active Items: ${validItems}`);
        console.log(`Total Inventory Value: ${totalValue.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}`);
        console.log(`-----------------------------------\n`);

    } catch (e) {
        console.error("Error:", e);
    }
}

getStockValue();
