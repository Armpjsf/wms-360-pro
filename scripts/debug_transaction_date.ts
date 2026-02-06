
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

// --- CONFIG ---
const SPREADSHEET_ID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM"; 

// --- HELPERS ---

async function getGoogleSheetsAuth() {
    try {
        const keyPath = path.join(process.cwd(), 'service-key.json');
        if (!fs.existsSync(keyPath)) {
            throw new Error(`service-key.json not found at ${keyPath}`);
        }
        
        const auth = new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: [
                "https://www.googleapis.com/auth/spreadsheets.readonly"
            ],
        });
        const client = await auth.getClient();
        return { auth, client };
    } catch (e) {
        console.error("Auth Error:", e);
        throw e;
    }
}

async function getSheetData(range: string) {
    const { auth } = await getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range
        });
        return res.data.values || [];
    } catch (e: any) {
        console.error(`Error reading ${range}:`, e.message);
        return null;
    }
}

function parseDate(dateStr: string): string {
    if (!dateStr) return "";
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        if (year > 2400) year -= 543;
        const newDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        d = new Date(newDateStr);
        if (!isNaN(d.getTime())) return newDateStr;
    }
    return "";
}

async function getTransactions(type: 'IN' | 'OUT') {
    const sheetName = type === 'IN' ? '💸 Transaction รับ' : '💰 Transaction จ่าย';
    console.log(`\n[${type}] Fetching from: ${sheetName}`);
    
    let data = await getSheetData(`'${sheetName}'!A1:Z2000`);
    if (!data) {
        const cleanName = type === 'IN' ? 'Transaction รับ' : 'Transaction จ่าย';
        console.log(`Fallback to: ${cleanName}`);
        data = await getSheetData(`'${cleanName}'!A1:Z2000`);
    }

    if (!data || data.length < 2) {
        console.log("No data found.");
        return [];
    }

    const headers = data[0];
    const rows = data.slice(1);
    
    console.log("Headers:", headers);

    const idxDate = headers.findIndex(h => h.includes('วันที่'));
    const idxName = headers.findIndex(h => h.includes('ชื่อสินค้า') || h.includes('รายการ'));
    const idxQty = headers.findIndex(h => {
        const val = h.trim();
        const vLower = val.toLowerCase();
        return (val.includes('จำนวน') || vLower.includes('qty') || vLower.includes('quantity') || vLower.includes('count')) 
            && !val.includes('เงิน')
            && !val.includes('ราคา')
            && !val.includes('บาท');
    });

    console.log(`Indices -> Date: ${idxDate}, Name: ${idxName}, Qty: ${idxQty}`);

    if (idxDate === -1 || idxName === -1 || idxQty === -1) {
        console.error("Critical columns missing.");
        return [];
    }

    return rows.map((r, i) => {
        const qtyRaw = r[idxQty];
        const val = parseFloat(qtyRaw?.replace(/,/g, '') || '0');
        if (!r[idxName]) return null;
        const dateStr = r[idxDate] || "";
        const parsedDate = parseDate(dateStr);
        
        return {
            originalDate: dateStr,
            parsedDate: parsedDate,
            product: r[idxName],
            qty: val
        };
    }).filter(t => t !== null && t.qty !== 0) as { originalDate: string, parsedDate: string, product: string, qty: number }[];
}

// --- MAIN ---

// --- MAIN ---

async function run() {
    let output = "=== DEBUGGING TRANSACTIONS (CLEAN) ===\n";
    
    // Check Date
    const now = new Date();
    const thaiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const todayStr = thaiTime.toISOString().split("T")[0];
    output += `Target Date (Today): ${todayStr}\n`;

    // IN
    const inTxs = await getTransactions('IN');
    output += `Total IN Transactions: ${inTxs.length}\n`;
    
    if (inTxs.length > 0) {
        output += "Last 10 IN Transactions:\n";
        inTxs.slice(-10).forEach(t => {
            output += `  Raw: "${t.originalDate}" -> Parsed: "${t.parsedDate}" (Qty: ${t.qty})\n`;
        });
    }

    const todayIn = inTxs.filter(t => t.parsedDate === todayStr);
    output += `IN Transactions matching Today: ${todayIn.length}\n`;

    // OUT
    const outTxs = await getTransactions('OUT');
    output += `Total OUT Transactions: ${outTxs.length}\n`;
    
    if (outTxs.length > 0) {
        output += "Last 10 OUT Transactions:\n";
        outTxs.slice(-10).forEach(t => {
            output += `  Raw: "${t.originalDate}" -> Parsed: "${t.parsedDate}" (Qty: ${t.qty})\n`;
        });
    }

    const todayOut = outTxs.filter(t => t.parsedDate === todayStr);
    output += `OUT Transactions matching Today: ${todayOut.length}\n`;

    if (todayIn.length === 0 && todayOut.length === 0) {
        output += "\nCONCLUSION: No transactions found for today's date.\n";
    }

    fs.writeFileSync('debug_output.txt', output);
    console.log("Done writing to debug_output.txt");
}

run();
