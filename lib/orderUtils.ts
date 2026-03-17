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

export async function archiveCurrentForm(customStatus?: string, signatureLink?: string, spreadsheetId?: string) {
    try {
        const ssid = spreadsheetId || PO_SPREADSHEET_ID;
        // 1. Get Active Job Data from Form
        const [docNumData, custNameData, ordersData, itemsData, qtyData] = await Promise.all([
            getSheetData(ssid, `${FORM_SHEET}!G3`),
            getSheetData(ssid, `${FORM_SHEET}!F6`),
            getSheetData(ssid, `${FORM_SHEET}!C10:C25`),
            getSheetData(ssid, `${FORM_SHEET}!D10:D25`),
            getSheetData(ssid, `${FORM_SHEET}!G10:G25`)
        ]);

        const docNum = docNumData?.[0]?.[0];
        const custName = custNameData?.[0]?.[0] || "Unknown";
        const today = new Date().toLocaleDateString('th-TH');

        if (!docNum) {
            return { success: false, error: 'No active job found' };
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

        if (dataToArchive.length > 0) {
            // 4. Find Old Entries for this DocNum
            const existingRows = await findAllRowIndices(ssid, DATA_SHEET, 0, docNum);

            // 5. Write to Archive (APPEND FIRST)
            for (const row of dataToArchive) {
                 // Validate Row Data (No undefined)
                 const cleanRow = row.map(d => (d === undefined || d === null) ? "" : d);
                 // Use EXPLICIT A:A range to force append to bottom
                 await appendSheetRow(ssid, `'${DATA_SHEET}'!A:A`, cleanRow);
            }

            // 6. Remove Old Entries (SAFELY REMOVED AFTER SUCCESSFUL SAVE)
            if (existingRows.length > 0) {
                console.log(`[Archive] Removing ${existingRows.length} old rows...`);
                for (const row of existingRows) {
                    await clearSheetRange(ssid, `${DATA_SHEET}!A${row}:I${row}`); 
                }
            }
        } else {
             console.warn(`[Archive] No items found to save for ${docNum}. Skipping archive write.`);
        }

        // 5. Clear Form
        await Promise.all([
            clearSheetRange(ssid, `${FORM_SHEET}!G3`),
            clearSheetRange(ssid, `${FORM_SHEET}!F4:F5`),
            clearSheetRange(ssid, `${FORM_SHEET}!D6`),
            clearSheetRange(ssid, `${FORM_SHEET}!F6`),
            clearSheetRange(ssid, `${FORM_SHEET}!B10:D25`),
            clearSheetRange(ssid, `${FORM_SHEET}!G10:G25`)
        ]);

        return { success: true };

    } catch (error: any) {
        console.error("Archive Helper Error:", error);
        throw error;
    }
}

export async function saveTransactionAndClear(branchId?: string) {
    try {
        // Resolve Spreadsheet IDs
        const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
        const docSSID = await resolveSpreadsheetId(branchId, 'doc');
        const invSSID = await resolveSpreadsheetId(branchId, 'inventory');

        const { writeTransactionData } = await import('@/lib/transactionUtils');
        
        // 1. Get Active Job Data (READ ONLY for Transaction)
        console.log(`[Clear] Reading form data for Transaction...`);
        const [ordersData, itemsData, qtyData, docNumData] = await Promise.all([
            getSheetData(docSSID, `${FORM_SHEET}!C10:C25`),
            getSheetData(docSSID, `${FORM_SHEET}!D10:D25`),
            getSheetData(docSSID, `${FORM_SHEET}!G10:G25`),
            getSheetData(docSSID, `${FORM_SHEET}!G3`)
        ]);
        const docNum = docNumData?.[0]?.[0] || "";
        console.log(`[Clear] Read ${itemsData?.length || 0} items for Transaction (Doc: ${docNum}).`);

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
                         orderNumber: orderNo,
                         docNumber: docNum
                     });
                }
            }
        }

        // 2. Update Archive (Delete Old + Write New) + Clear Form
        const archiveResult = await archiveCurrentForm(undefined, undefined, docSSID);
        if (!archiveResult.success) {
            throw new Error("Failed to archive/update form data: " + archiveResult.error);
        }

        // 3. Write to Transaction
        if (transactionItems.length > 0) {
            console.log(`[Clear] Writing ${transactionItems.length} items to Transaction (SSID: ${invSSID})...`);
            await writeTransactionData(transactionItems, invSSID); // Passing invSSID
        }

        return { success: true };

    } catch (error: any) {
        console.error("Transaction/Clear Helper Error:", error);
        throw error;
    }
}

export async function clearFormSheet(spreadsheetId?: string) {
    try {
        const ssid = spreadsheetId || PO_SPREADSHEET_ID;
        await Promise.all([
            clearSheetRange(ssid, `${FORM_SHEET}!G3`),
            clearSheetRange(ssid, `${FORM_SHEET}!F4:F5`),
            clearSheetRange(ssid, `${FORM_SHEET}!D6`),
            clearSheetRange(ssid, `${FORM_SHEET}!F6`),
            clearSheetRange(ssid, `${FORM_SHEET}!B10:D25`),
            clearSheetRange(ssid, `${FORM_SHEET}!G10:G25`)
        ]);
        return { success: true };
    } catch (error: any) {
        console.error("Clear Form Error:", error);
        throw error;
    }
}

export async function restoreOrderToForm(docNum: string, spreadsheetId?: string) {
    try {
        const ssid = spreadsheetId || PO_SPREADSHEET_ID;
        console.log(`[Restore] Attempting to restore ${docNum} to Form (SSID: ${ssid})...`);
        
        // 1. Check if Form is Busy
        const formCheck = await getSheetData(ssid, `${FORM_SHEET}!G3:G3`);
        if (formCheck && formCheck[0] && formCheck[0][0]) {
            const currentDoc = formCheck[0][0];
            if (currentDoc === docNum) {
                console.log(`[Restore] Job ${docNum} is already on Form. Doing nothing.`);
                return { success: true, message: "Already active" };
            }
            console.log(`[Restore] Form busy with ${currentDoc}. Archiving it first...`);
            await archiveCurrentForm(undefined, undefined, ssid);
        }

        // 2. Clear Form (Clean State)
        await clearFormSheet(ssid);

        // 3. Fetch Data from Archive (Data Sheet)
        const rowIndices = await findAllRowIndices(ssid, DATA_SHEET, 0, docNum);
        if (!rowIndices || rowIndices.length === 0) {
            throw new Error(`Job ${docNum} not found in Archive`);
        }

        // Read all rows
        // Optimization: Read range based on min/max row if contiguous?
        // For simplicity, read individually or fetch whole sheet is too heavy.
        // Let's assume they are contiguous or just fetch them.
        // Actually findAllRowIndices returns indices.
        // We need the DATA.
        
        // Better: Fetch columns A:I for the rows found. 
        // Since we can't batch read non-contiguous easily, let's hope they are contiguous or just loop.
        const jobRows = [];
        for (const idx of rowIndices) {
             const rowData = await getSheetData(ssid, `'${DATA_SHEET}'!A${idx}:I${idx}`);
             if (rowData && rowData[0]) {
                 jobRows.push(rowData[0]);
             }
        }

        if (jobRows.length === 0) throw new Error("Failed to read job data rows");

        // 4. Extract Header Info (from first row)
        // Col A: DocNum, B: CustName, C: Seq, D: OrderNo, E: Item, F: Qty, G: Status, H: Link, I: Date
        const headerRow = jobRows[0];
        const custName = headerRow[1];
        const dateStr = headerRow[8]; // Date saved
        
        // 5. Update Header
        await Promise.all([
            updateSheetData(ssid, `${FORM_SHEET}!G3`, [[docNum]]),
            updateSheetData(ssid, `${FORM_SHEET}!F4`, [[dateStr]]), // Date
            updateSheetData(ssid, `${FORM_SHEET}!F6`, [[custName]]) // Customer
        ]);

        // 6. Map Body Items
        // Form:
        // B: Seq (Col C of Archive)
        // C: OrderNo (Col D of Archive)
        // D: Item (Col E of Archive)
        // G: Qty (Col F of Archive)
        
        const formSequences = [];
        const formOrders = [];
        const formItems = [];
        const formQty = [];

        for (const row of jobRows) {
            formSequences.push([row[2]]); // Seq
            formOrders.push([row[3]]);    // OrderNo
            formItems.push([row[4]]);     // Item
            formQty.push([row[5]]);       // Qty
        }

        // 7. Update Body
        const startRow = 10;
        const endRow = startRow + jobRows.length - 1;
        
        await Promise.all([
            updateSheetData(ssid, `${FORM_SHEET}!B${startRow}:B${endRow}`, formSequences),
            updateSheetData(ssid, `${FORM_SHEET}!C${startRow}:C${endRow}`, formOrders),
            updateSheetData(ssid, `${FORM_SHEET}!D${startRow}:D${endRow}`, formItems),
            updateSheetData(ssid, `${FORM_SHEET}!G${startRow}:G${endRow}`, formQty)
        ]);

        // 8. Update Archive Status instead of removing (Prevent Data Loss & Duplicate)
        console.log(`[Restore] Updating ${rowIndices.length} rows in Archive to 'กำลังแก้ไข' (Editing)...`);
        const updates = [];
        for (const idx of rowIndices) {
             updates.push({ range: `'${DATA_SHEET}'!G${idx}`, values: [['กำลังแก้ไข']] });
        }
        await Promise.all(updates.map(u => updateSheetData(ssid, u.range, u.values)));

        console.log(`[Restore] Successfully restored ${docNum} to Form.`);
        return { success: true };

    } catch (error: any) {
        console.error("Restore Order Error:", error);
        throw error;
    }
}
