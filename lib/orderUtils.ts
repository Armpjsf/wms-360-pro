import { 
    getSheetData, 
    updateSheetData, 
    clearSheetRange, 
    appendSheetRow,
    findAllRowIndices,
    PO_SPREADSHEET_ID 
} from '@/lib/googleSheets';

const FORM_SHEET = "ส่งสินค้า";
const DATA_SHEET = "คลังข้อมูล";

export async function archiveCurrentForm(customStatus?: string, signatureLink?: string) {
    try {
        // 1. Get Active Job Data from Form
        const [docNumData, custNameData, ordersData, itemsData, qtyData] = await Promise.all([
            getSheetData(PO_SPREADSHEET_ID, `${FORM_SHEET}!G3`),
            getSheetData(PO_SPREADSHEET_ID, `${FORM_SHEET}!F6`),
            getSheetData(PO_SPREADSHEET_ID, `${FORM_SHEET}!C10:C25`),
            getSheetData(PO_SPREADSHEET_ID, `${FORM_SHEET}!D10:D25`),
            getSheetData(PO_SPREADSHEET_ID, `${FORM_SHEET}!G10:G25`)
        ]);

        const docNum = docNumData?.[0]?.[0];
        const custName = custNameData?.[0]?.[0] || "Unknown";
        const today = new Date().toLocaleDateString('th-TH');

        if (!docNum) {
            return { success: false, error: 'No active job found' };
        }

        // 2. Remove Old Entries for this DocNum in Archive
        const existingRows = await findAllRowIndices(PO_SPREADSHEET_ID, DATA_SHEET, 0, docNum);
        if (existingRows.length > 0) {
            for (const row of existingRows) {
                await clearSheetRange(PO_SPREADSHEET_ID, `${DATA_SHEET}!A${row}:I${row}`); 
            }
        }

        // 3. Prepare New Archive Data
        const dataToArchive = [];
        let currentSequence = 1;

        if (itemsData) {
            console.log(`[Archive] Processing ${itemsData.length} items from form...`);
            for (let i = 0; i < itemsData.length; i++) {
                const itemCode = itemsData[i]?.[0]?.trim();
                
                if (itemCode) {
                     const orderNo = ordersData?.[i]?.[0]?.trim() || "";
                     const qty = qtyData?.[i]?.[0] || "";
                     
                     // [DocNum, CustName, Seq, OrderNo, Item, Qty, Status, Link, Date]
                     // Use customStatus if provided (e.g. "รอ PDF"), otherwise default "รอลูกค้า"
                     // Use signatureLink if provided (temporarily store sig link in PDF column for "Pending PDF" jobs)
                     dataToArchive.push([
                        docNum, custName, currentSequence, 
                        orderNo, itemCode, qty, 
                        customStatus || "รอลูกค้า", signatureLink || "", today
                     ]);
                     currentSequence++;
                }
            }
        }

        // 4. Write to Archive
        if (dataToArchive.length > 0) {
             for (const row of dataToArchive) {
                 // Validate Row Data (No undefined)
                 const cleanRow = row.map(d => (d === undefined || d === null) ? "" : d);
                 // Use EXPLICIT A:A range to force append to bottom
                 await appendSheetRow(PO_SPREADSHEET_ID, `'${DATA_SHEET}'!A:A`, cleanRow);
             }
        }

        // 5. Clear Form
        await Promise.all([
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!G3`),
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!F4:F5`),
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!D6`),
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!F6`),
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!B10:D25`),
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!G10:G25`)
        ]);

        return { success: true };

    } catch (error: any) {
        console.error("Archive Helper Error:", error);
        throw error;
    }
}

export async function saveTransactionAndClear() {
    try {
        const { writeTransactionData } = await import('@/lib/transactionUtils');
        
        // 1. Get Active Job Data (READ ONLY for Transaction)
        console.log(`[Clear] Reading form data for Transaction...`);
        const [ordersData, itemsData, qtyData] = await Promise.all([
            getSheetData(PO_SPREADSHEET_ID, `${FORM_SHEET}!C10:C25`),
            getSheetData(PO_SPREADSHEET_ID, `${FORM_SHEET}!D10:D25`),
            getSheetData(PO_SPREADSHEET_ID, `${FORM_SHEET}!G10:G25`)
        ]);
        console.log(`[Clear] Read ${itemsData?.length || 0} items for Transaction.`);

        const transactionItems: any[] = [];
        if (itemsData) {
            for (let i = 0; i < itemsData.length; i++) {
                const itemCode = itemsData[i]?.[0]?.trim();
                if (itemCode) {
                     const orderNo = ordersData?.[i]?.[0]?.trim() || "";
                     const qty = qtyData?.[i]?.[0] || 0; 
                     
                     transactionItems.push({
                         itemCode: itemCode,
                         quantity: Number(qty) || 0,
                         orderNumber: orderNo
                     });
                }
            }
        }

        // 2. Update Archive (Delete Old + Write New) + Clear Form
        // This function handles the "Clear" part internally at the end
        // By calling this, we ensure Archive matches the final form state (e.g. if Qty edited)
        const archiveResult = await archiveCurrentForm();
        if (!archiveResult.success) {
            throw new Error("Failed to archive/update form data: " + archiveResult.error);
        }

        // 3. Write to Transaction
        // We do this concurrently or after archive. Since we have the data in memory, it's safe.
        if (transactionItems.length > 0) {
            console.log(`[Clear] Writing ${transactionItems.length} items to Transaction...`);
            await writeTransactionData(transactionItems);
        } else {
            console.warn("[Clear] No items found for transaction writing");
        }

        return { success: true };

    } catch (error: any) {
        console.error("Transaction/Clear Helper Error:", error);
        throw error;
    }
}

export async function clearFormSheet() {
    try {
        await Promise.all([
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!G3`),
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!F4:F5`),
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!D6`),
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!F6`),
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!B10:D25`),
            clearSheetRange(PO_SPREADSHEET_ID, `${FORM_SHEET}!G10:G25`)
        ]);
        return { success: true };
    } catch (error: any) {
        console.error("Clear Form Error:", error);
        throw error;
    }
}
