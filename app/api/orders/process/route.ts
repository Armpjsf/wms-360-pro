import { NextResponse } from 'next/server';
import { getSheetData, batchUpdateSheetData, batchClearSheetRanges, appendSheetData } from '@/lib/googleSheets';
import { generateNewDocNumber } from '@/lib/docUtils';
import { getThaiDateString } from '@/lib/dateUtils';
import { withFormLock, archiveCurrentForm, clearFormSheet, lockErrorStatus, STATUS_IN_PROGRESS } from '@/lib/orderUtils';

const ROLL_TAG_1 = "Roll Tag1";
const ROLL_TAG_2 = "Roll Tag2";
const FORM_SHEET = "ส่งสินค้า";
const DATA_SHEET = "คลังข้อมูล";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tagId, branchId } = body; // 'RT1' or 'RT2'

    // Resolver for Multi-Branch Isolation
    const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
    const ssId = await resolveSpreadsheetId(branchId, 'doc');
    const invSSID = await resolveSpreadsheetId(branchId, 'inventory');

    console.log(`[Process] Starting for Tag: ${tagId}, Branch: ${branchId || 'HQ'}, SS_ID: ${ssId}`);

    // 0. ฟอร์ม (G3) มีได้ทีละงาน — ใช้ lock กลางร่วมกับ recall/restore/archive/finalize
    return await withFormLock(ssId, async () => {
    // 1. Check if tagId exists in คลังข้อมูล with status "รอจัด RollTag"
    const archiveData = await getSheetData(ssId, `'${DATA_SHEET}'!A:I`).catch(() => []);
    const matchingRowIndices: number[] = [];
    const pendingArchiveRows: any[] = [];
    let custName = "Unknown";
    let custId = "";

    if (archiveData && archiveData.length > 1) {
        for (let i = 1; i < archiveData.length; i++) {
            const row = archiveData[i];
            const docNum = String(row[0] || '').trim();
            const status = String(row[6] || '').trim();
            if (docNum.toUpperCase() === tagId.toUpperCase() && (status === "รอจัด RollTag" || status === "RollTag")) {
                matchingRowIndices.push(i + 1); // 1-based row index in Google Sheets
                if (custName === "Unknown" && row[1]) {
                    custName = String(row[1]).trim();
                    custId = String(row[1]).trim();
                }
                pendingArchiveRows.push({
                    orderNo: String(row[3] || '').trim(),
                    itemCode: String(row[4] || '').trim(),
                    qty: row[5] ?? ""
                });
            }
        }
    }

    const tagNum = tagId.replace("RT", "").trim();
    const sourceSheet = `Roll Tag${tagNum}`;
    const isFromArchive = matchingRowIndices.length > 0;

    let ordersData: string[][] = [];
    let itemsData: string[][] = [];
    let qtyData: any[][] = [];

    if (isFromArchive) {
        ordersData = pendingArchiveRows.map(r => [r.orderNo]);
        itemsData = pendingArchiveRows.map(r => [r.itemCode]);
        qtyData = pendingArchiveRows.map(r => [r.qty]);
        console.log(`[Process] Found ${pendingArchiveRows.length} items in คลังข้อมูล for ${tagId}`);
    } else {
        // Fallback: Read from legacy sheet if it exists
        try {
            const rollTagData = await getSheetData(ssId, `${sourceSheet}!A4:E17`);
            const itemRows = Array.from({ length: 9 }, (_, index) => rollTagData?.[index + 5] || []);
            const hasItems = itemRows.some(row => String(row[1] || '').trim() !== '');
            if (!hasItems) {
                return NextResponse.json(
                    { error: `${tagId} ไม่มีรายการแล้ว (อาจถูกจัดการไปแล้ว) กรุณารีเฟรช` },
                    { status: 409, headers: corsHeaders }
                );
            }
            custId = rollTagData?.[0]?.[1] || "";
            custName = rollTagData?.[1]?.[1] || custId || "Unknown";
            ordersData = itemRows.map(row => [row[0] || ""]);
            itemsData = itemRows.map(row => [row[1] || ""]);
            qtyData = itemRows.map(row => [row[4] || ""]);
        } catch {
            return NextResponse.json(
                { error: `${tagId} ไม่มีรายการแล้ว (อาจถูกจัดการไปแล้ว) กรุณารีเฟรช` },
                { status: 409, headers: corsHeaders }
            );
        }
    }

    // 2. Check "Form" Availability First (Safe if FORM_SHEET is deleted)
    try {
        const formCheck = await getSheetData(ssId, `${FORM_SHEET}!G3:G3`);
        if (formCheck && formCheck[0] && formCheck[0][0]) {
            console.log(`[Process] Form Busy (Doc: ${formCheck[0][0]}). Auto-Archiving...`);
            await archiveCurrentForm(undefined, undefined, ssId);
        } else {
            await clearFormSheet(ssId);
        }
    } catch {
        // FORM_SHEET does not exist, completely fine!
    }

    // 3. Generate Doc Number
    const newDocId = await generateNewDocNumber(ssId);
    console.log(`[Process] Generated DocId: ${newDocId} for Tag: ${tagId} (Customer: ${custName})`);

    // 4. Prepare Data
    const today = getThaiDateString();

    const dataToArchive: any[] = [];
    const formSequences: any[] = [];
    const formOrders: any[] = [];
    const formItems: any[] = [];
    const formQty: any[] = [];

    let currentSequence = 1;
    let orderGroupSequence = 0;
    let lastValidOrderNo = "";

    const maxItems = Math.max(ordersData.length, 9);
    for (let i = 0; i < maxItems; i++) {
        const orderNo = ordersData?.[i]?.[0]?.trim() || "";
        const itemCode = itemsData?.[i]?.[0]?.trim() || "";
        const qtyVal = qtyData?.[i]?.[0] || "";

        let isNewOrderGroup = false;
        if (orderNo !== "") {
            lastValidOrderNo = orderNo;
            isNewOrderGroup = true;
            orderGroupSequence += 1;
        }

        if (itemCode !== "") {
            dataToArchive.push([
                newDocId, custName, currentSequence,
                lastValidOrderNo, itemCode, qtyVal,
                STATUS_IN_PROGRESS, "", today
            ]);

            formSequences.push([isNewOrderGroup ? orderGroupSequence : ""]);
            formOrders.push([isNewOrderGroup ? lastValidOrderNo : ""]);
            formItems.push([itemCode]);
            formQty.push([qtyVal]);

            currentSequence += 1;
        } else {
            formSequences.push([""]);
            formOrders.push([""]);
            formItems.push([""]);
            formQty.push([""]);
        }
    }

    // 5. Update or Write to "Archive" (คลังข้อมูล)
    if (isFromArchive) {
        console.log(`[Process] Updating ${matchingRowIndices.length} rows in คลังข้อมูล in-place...`);
        const updateRanges: { range: string; values: any[][] }[] = [];
        matchingRowIndices.forEach((rowIdx, idx) => {
            const rowData = dataToArchive[idx];
            if (rowData) {
                updateRanges.push({
                    range: `'${DATA_SHEET}'!A${rowIdx}:I${rowIdx}`,
                    values: [rowData]
                });
            }
        });
        if (updateRanges.length > 0) {
            await batchUpdateSheetData(ssId, updateRanges);
            console.log(`[Process] ✅ Updated ${updateRanges.length} rows in คลังข้อมูล in-place`);
        }
    } else {
        console.log(`[Process] Prepared ${dataToArchive.length} rows for Archive. Writing to ${DATA_SHEET}...`);
        if (dataToArchive.length > 0) {
            try {
                const cleanRows = dataToArchive.map(row =>
                    row.map((d: any) => (d === undefined || d === null) ? "" : d)
                );
                await appendSheetData(ssId, `'${DATA_SHEET}'!A:I`, cleanRows, 'INSERT_ROWS');
                console.log(`[Process] ✅ Successfully wrote ${dataToArchive.length} rows to คลังข้อมูล`);
            } catch (err) {
                console.error(`[Process] ❌ Failed to write to คลังข้อมูล:`, err);
                throw new Error(`Failed to write to Archive (คลังข้อมูล): ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }

    // 7. Update "Form" Header (Optional - safe if FORM_SHEET is deleted)
    try {
        console.log(`[Process] Updating Form Header & Body...`);
        await batchUpdateSheetData(ssId, [
            { range: `${FORM_SHEET}!G3`, values: [[newDocId]] },
            { range: `${FORM_SHEET}!F4`, values: [[today]] },
            { range: `${FORM_SHEET}!F5`, values: [[today]] },
            { range: `${FORM_SHEET}!D6`, values: [[custId]] },
            { range: `${FORM_SHEET}!F6`, values: [[custName]] },
            { range: `${FORM_SHEET}!B10:B18`, values: formSequences },
            { range: `${FORM_SHEET}!C10:C18`, values: formOrders },
            { range: `${FORM_SHEET}!D10:D18`, values: formItems },
            { range: `${FORM_SHEET}!G10:G18`, values: formQty },
        ]);
        console.log(`[Process] Form Updated.`);
    } catch {
        console.log(`[Process] Form sheet update skipped (sheet may not exist).`);
    }

    // 9. Write to Transaction Sheet before clearing the source Roll Tag.
    try {
        const { writeTransactionData } = await import('@/lib/transactionUtils');
        const { logAction } = await import('@/lib/auditTrail');
        const transactionItems: any[] = [];
        
        // Use dataToArchive which we built earlier
        if (dataToArchive.length > 0) {
            console.log(`[Process] Preparing ${dataToArchive.length} items for Transaction...`);
            for (const row of dataToArchive) {
                // row structure: [docNum, custName, seq, orderNo, itemCode, qty, status, link, date]
                const itemCode = row[4];
                const qty = Number(row[5]);
                const orderNo = row[3];
                const docNum = row[0];
                
                if (itemCode) {
                    transactionItems.push({
                        itemCode,
                        quantity: qty || 0,
                        orderNumber: orderNo,
                        docNumber: docNum
                    });
                }
            }
            
            if (transactionItems.length > 0) {
                 console.log(`[Process] Writing ${transactionItems.length} rows to Transaction (SSID: ${invSSID})...`);
                 await writeTransactionData(transactionItems, invSSID);
                 console.log(`[Process] ✅ Transaction write successful`);

                 // Audit Log
                 await logAction({
                    userId: 'System',
                    userName: 'Order Processor',
                    action: 'CREATE',
                    module: 'Outbound',
                    description: `Processed Order ${newDocId} for ${custName} (${transactionItems.length} items)`,
                    newValues: { docId: newDocId, customer: custName, items: transactionItems }
                 });
            }
        }
    } catch (txErr) {
        console.error(`[Process] ❌ Failed to write Transaction:`, txErr);
        throw new Error(`Archive success, but Transaction failed: ${txErr instanceof Error ? txErr.message : String(txErr)}`);
    }

    // 10. Clear Roll Tag only after all required writes succeed (safe if sheet deleted)
    try {
        await batchClearSheetRanges(ssId, [
            `${sourceSheet}!B4`,
            `${sourceSheet}!B6`,
            `${sourceSheet}!A9:A17`,
            `${sourceSheet}!B9:B17`,
            `${sourceSheet}!D9:D17`,
            `${sourceSheet}!E9:E17`,
        ]);
    } catch {
        console.log(`[Process] Source Roll Tag sheet clear skipped (sheet may not exist).`);
    }

    // 11. Notification (Push to APK)
    try {
        const { sendFcmToDevices } = await import('@/lib/fcmSender');

        const itemSummary = formItems.map((codeArr, idx) =>
             codeArr[0] ? `${codeArr[0]} (x${formQty[idx][0]})` : null
        ).filter(Boolean).join(', ');

        // Lead with the 6-digit Order number(s) — the primary reference used by
        // HQ, branch, and customer. DocId is kept only in the data payload.
        const orderNumbers = Array.from(new Set(
            dataToArchive.map(r => String(r[3] || '').trim()).filter(Boolean)
        ));
        const orderText = orderNumbers.length > 0 ? orderNumbers.join(', ') : newDocId;

        await sendFcmToDevices({
            title: `📦 งานใหม่ Order ${orderText}`,
            body: `ลูกค้า: ${custName}\nรายการ: ${itemSummary}`,
            data: { type: 'new_job', orderNo: orderText, docId: newDocId },
        }, { tag: 'Process' });
    } catch (notifyErr) {
        console.error("[Process] Failed to send Push Notification:", notifyErr);
    }

    return NextResponse.json({ 
        success: true, 
        docId: newDocId,
        debug: {
             itemsFound: formItems.length,
             rowsArchived: dataToArchive.length,
             transactionItems: 0, // Logic moved to Clear API
             archiveSheet: DATA_SHEET,
             targetSpreadsheetId: ssId,
             // Debug Inputs to check why some items are missed
             rawInputs: {
                 orders: ordersData?.map(r => r[0]),
                 items: itemsData?.map(r => r[0])
             }
        }
    }, { headers: corsHeaders });

    });

  } catch (error: any) {
    console.error("Order Process Error:", error);
    return NextResponse.json(
        { error: error.message },
        { status: lockErrorStatus(error), headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

// Vercel: allow up to 60s (Hobby max) — this route does Sheets-heavy work.
export const maxDuration = 60;
