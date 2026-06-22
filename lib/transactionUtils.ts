import { getSheetData, appendSheetData } from './googleSheets';

// Transaction Spreadsheet ID
export const TRANSACTION_SPREADSHEET_ID = '1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM';
export const TRANSACTION_SHEET_NAME = '💰 Transaction จ่าย';

// Sheet for price lookup
export const PRODUCT_SHEET_NAME = 'ชื่อสินค้า';

interface TransactionItem {
    itemCode: string;
    quantity: number;
    orderNumber: string;
    price?: number; // Optional override
}

/**
 * Write transaction data to 💰 Transaction sheet
 * 1 Item = 1 Row
 */
export async function writeTransactionData(items: TransactionItem[], spreadsheetId?: string): Promise<void> {
    try {
        const ssid = spreadsheetId || TRANSACTION_SPREADSHEET_ID;
        console.log(`[Transaction] Starting write for ${items?.length || 0} items...`);
        if (!items || items.length === 0) {
            console.log('[Transaction] No items to write to Transaction sheet');
            return;
        }

        // Get current date
        const today = new Date();
        const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

        // Prepare row-agnostic formulas so append can write without reading the next row first.
        const rows = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const price = item.price ?? `=IFERROR(VLOOKUP(INDIRECT("B"&ROW()),'${PRODUCT_SHEET_NAME}'!B:D,3,FALSE),0)`;
            const formulaF = `=IF(LEN(INDIRECT("B"&ROW()))>0,INDIRECT("C"&ROW())*INDIRECT("D"&ROW()),"")`;
            const formulaG = `=IF(LEN(INDIRECT("B"&ROW()))>0,IFERROR(VLOOKUP(INDIRECT("B"&ROW()),'📊 รายงานสินค้าคงเหลือ'!A:G,6,FALSE)*INDIRECT("C"&ROW()),0),0)`;
            const formulaH = `=IF(LEN(INDIRECT("B"&ROW()))>0,INDIRECT("F"&ROW())-INDIRECT("G"&ROW()),0)`;
            const formulaI = `=IF(LEN(INDIRECT("B"&ROW()))>0,IF(INDIRECT("F"&ROW())<>0,INDIRECT("H"&ROW())/INDIRECT("F"&ROW()),0),0)`;
            const formulaJ = `=IFERROR(VLOOKUP(INDIRECT("B"&ROW()),'${PRODUCT_SHEET_NAME}'!B:G,6,FALSE),"")`;
            const formulaK = `=IFERROR(VLOOKUP(INDIRECT("B"&ROW()),'📊 รายงานสินค้าคงเหลือ'!A:Q,17,FALSE),"")`;

            rows.push([
                dateStr,              // A: วันที่
                item.itemCode,        // B: ชื่อสินค้า (Item Code)
                item.quantity,        // C: จำนวนที่ขาย
                price,                // D: ราคา
                'แผ่น',               // E: หน่วยนับ
                formulaF,             // F: มูลค่ารวม
                formulaG,             // G: ต้นทุนเฉลี่ยรวม
                formulaH,             // H: กำไรขั้นต้น
                formulaI,             // I: %กำไรขั้นต้น
                formulaJ,             // J: กลุ่มสินค้า
                formulaK,             // K: หมายเหตุ
                item.orderNumber      // L: Order
            ]);
        }

        // Append all rows in one request.
        try {
            console.log(`[Transaction] Attempting append to ${TRANSACTION_SHEET_NAME}...`);
            await appendSheetData(ssid, `${TRANSACTION_SHEET_NAME}!A:L`, rows);
        } catch (primaryErr) {
            const code = (primaryErr as any)?.code || (primaryErr as any)?.status;
            const message = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
            if (code === 429 || message.toLowerCase().includes('quota exceeded')) {
                throw primaryErr;
            }
            console.warn(`[Transaction] Failed to append to ${TRANSACTION_SHEET_NAME}. Trying fallback...`, primaryErr);
            await appendSheetData(ssid, `Transaction จ่าย!A:L`, rows);
        }

        console.log(`Successfully wrote ${rows.length} items to Transaction sheet`);

    } catch (error) {
        console.error('Error writing to Transaction sheet:', error);
        throw error;
    }
}

/**
 * Lookup Cost Price from ชื่อสินค้า sheet
 * Item Code is in Column B, Cost is in Column C
 */
async function lookupItemCost(itemCode: string, spreadsheetId?: string): Promise<number> {
    try {
        const ssid = spreadsheetId || TRANSACTION_SPREADSHEET_ID;
        // Read columns B:C from ชื่อสินค้า sheet
        const data = await getSheetData(ssid, `${PRODUCT_SHEET_NAME}!B:C`);
        
        if (!data || data.length === 0) return 0;

        for (const row of data) {
            if (row[0] === itemCode) {
                // Return Cost from Column C (index 1)
                const cost = parseFloat(row[1]?.replace(/,/g, ''));
                return isNaN(cost) ? 0 : cost;
            }
        }
        return 0;
    } catch (error) {
        console.error('Error looking up cost:', error);
        return 0;
    }
}

export const INBOUND_SHEET_NAME_CLEAN = 'Transaction รับ';
export const INBOUND_SHEET_NAME_EMOJI = '💸 Transaction รับ';

/**
 * Write inbound transaction data to Transaction รับ sheet
 */
export async function writeInboundData(items: TransactionItem[], spreadsheetId?: string): Promise<void> {
    try {
        const ssid = spreadsheetId || TRANSACTION_SPREADSHEET_ID;
        console.log(`[Inbound] Starting write for ${items?.length || 0} items...`);
        if (!items || items.length === 0) {
            return;
        }

        const today = new Date();
        const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

        // Prepare rows (No need to find nextRow, Append handles it)
        
        const rows = [];
        for (let i = 0; i < items.length; i++) {
             const item = items[i];
             
             // Lookup Cost
             let cost = item.price;
             if (cost === undefined || cost === null || cost === 0) {
                 cost = await lookupItemCost(item.itemCode);
             }

             // Dynamic Formulas (ROW Agnostic)
             // Col F: Total = Col C * Col D
             const formulaF = `=IF(LEN(INDIRECT("B"&ROW()))>0, INDIRECT("C"&ROW()) * INDIRECT("D"&ROW()), "")`;
             
             // Col G: Note = VLOOKUP(B & ROW ...)
             const formulaG = `=VLOOKUP(INDIRECT("B"&ROW()),'📊 รายงานสินค้าคงเหลือ'!A:Q,17,0)`;

             rows.push([
                 dateStr,           // A: Date
                 item.itemCode,     // B: Name
                 item.quantity,     // C: Qty
                 cost,              // D: Cost Price
                 'แผ่น',            // E: Unit
                 formulaF,          // F: Total Value (Formula)
                 formulaG,          // G: Note (Formula)
                 item.orderNumber,  // H: DocRef
                 ''                 // I: Empty
             ]);
        }

        // Try Append to Emoji Sheet first
        try {
            console.log(`[Inbound] Appending to ${INBOUND_SHEET_NAME_EMOJI}`);
            await appendSheetData(ssid, `${INBOUND_SHEET_NAME_EMOJI}!A:I`, rows);
        } catch (err) {
             console.warn(`[Inbound] Append to emoji sheet failed, trying clean name...`);
             await appendSheetData(ssid, `${INBOUND_SHEET_NAME_CLEAN}!A:I`, rows);
        }

        console.log(`Successfully appended ${rows.length} items to Inbound sheet`);

    } catch (error) {
        console.error('Error writing to Inbound sheet:', error);
        throw error;
    }
}
