import { getSheetData, updateSheetData, appendSheetData } from './googleSheets';

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
 * Lookup price for an item from ชื่อสินค้า sheet
 * Item Code is in Column B, Price is in Column D
 */
async function lookupItemPrice(itemCode: string): Promise<number> {
    try {
        // Read columns B:D from ชื่อสินค้า sheet
        const data = await getSheetData(TRANSACTION_SPREADSHEET_ID, `${PRODUCT_SHEET_NAME}!B:D`);
        
        if (!data || data.length === 0) {
            console.warn(`No data found in ${PRODUCT_SHEET_NAME} sheet`);
            return 0;
        }

        // Find row where Column B matches itemCode
        for (const row of data) {
            if (row[0] === itemCode) {
                // Return price from Column D (index 2)
                const price = parseFloat(row[2]);
                return isNaN(price) ? 0 : price;
            }
        }

        console.warn(`Price not found for item: ${itemCode}`);
        return 0;
    } catch (error) {
        console.error('Error looking up price:', error);
        return 0;
    }
}

/**
 * Write transaction data to 💰 Transaction sheet
 * 1 Item = 1 Row
 */
export async function writeTransactionData(items: TransactionItem[]): Promise<void> {
    try {
        console.log(`[Transaction] Starting write for ${items?.length || 0} items...`);
        if (!items || items.length === 0) {
            console.log('[Transaction] No items to write to Transaction sheet');
            return;
        }

        // Get current date
        const today = new Date();
        const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

        // Find next empty row
        const existingData = await getSheetData(TRANSACTION_SPREADSHEET_ID, `${TRANSACTION_SHEET_NAME}!A:A`);
        const nextRow = (existingData?.length || 0) + 1;
        console.log(`[Transaction] Next empty row: ${nextRow}`);

        // Prepare data rows with formulas
        const rows = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const rowNum = nextRow + i;
            
            // Lookup price for this item (or use override)
            let price = item.price;
            if (price === undefined || price === null) {
                 price = await lookupItemPrice(item.itemCode);
            }

            // Column F: มูลค่ารวม = C * D
            const formulaF = `=IF(LEN(B${rowNum})>0, C${rowNum} * D${rowNum}, "")`;
            
            // Column G: ต้นทุนเฉลี่ยรวม = VLOOKUP cost * quantity
            const formulaG = `=IF(LEN(B${rowNum})>0, IFERROR(VLOOKUP(B${rowNum}, '📊 รายงานสินค้าคงเหลือ'!A:G, 6, FALSE) * C${rowNum}, 0), 0)`;
            
            // Column H: กำไรขั้นต้น = F - G
            const formulaH = `=IF(LEN(B${rowNum})>0, F${rowNum} - G${rowNum}, 0)`;
            
            // Column I: %กำไรขั้นต้น = H / F
            const formulaI = `=IF(LEN(B${rowNum})>0, IF(F${rowNum}<>0, H${rowNum} / F${rowNum}, 0), 0)`;
            
            // Column J: กลุ่มสินค้า = VLOOKUP from ชื่อสินค้า column 6
            const formulaJ = `=IFERROR(IF(B${rowNum}<>"", VLOOKUP(B${rowNum}, 'ชื่อสินค้า'!B:G, 6, 0), ""), "")`;
            
            // Column K: หมายเหตุ = VLOOKUP from รายงานสินค้าคงเหลือ column 17
            const formulaK = `=IFERROR(VLOOKUP(B${rowNum}, '📊 รายงานสินค้าคงเหลือ'!A:Q, 17, 0), "")`;

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

        // Write all rows at once
        let targetSheetName = TRANSACTION_SHEET_NAME;
        let range = `${targetSheetName}!A${nextRow}:L${nextRow + rows.length - 1}`;
        
        try {
            console.log(`[Transaction] Attempting write to ${targetSheetName}...`);
            await updateSheetData(TRANSACTION_SPREADSHEET_ID, range, rows);
        } catch (primaryErr) {
            console.warn(`[Transaction] Failed to write to ${targetSheetName}. Trying fallback...`, primaryErr);
            // Fallback: Try without emoji
            targetSheetName = '💰 Transaction จ่าย';
            range = `${targetSheetName}!A${nextRow}:L${nextRow + rows.length - 1}`;
            await updateSheetData(TRANSACTION_SPREADSHEET_ID, range, rows);
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
async function lookupItemCost(itemCode: string): Promise<number> {
    try {
        // Read columns B:C from ชื่อสินค้า sheet
        const data = await getSheetData(TRANSACTION_SPREADSHEET_ID, `${PRODUCT_SHEET_NAME}!B:C`);
        
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
export async function writeInboundData(items: TransactionItem[]): Promise<void> {
    try {
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
            await appendSheetData(TRANSACTION_SPREADSHEET_ID, `${INBOUND_SHEET_NAME_EMOJI}!A:I`, rows);
        } catch (err) {
             console.warn(`[Inbound] Append to emoji sheet failed, trying clean name...`);
             await appendSheetData(TRANSACTION_SPREADSHEET_ID, `${INBOUND_SHEET_NAME_CLEAN}!A:I`, rows);
        }

        console.log(`Successfully appended ${rows.length} items to Inbound sheet`);

    } catch (error) {
        console.error('Error writing to Inbound sheet:', error);
        throw error;
    }
}
