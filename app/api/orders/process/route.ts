import { NextResponse } from 'next/server';
import { getSheetData, batchUpdateSheetData, batchClearSheetRanges, appendSheetData } from '@/lib/googleSheets';
import { generateNewDocNumber } from '@/lib/docUtils';
import { writeTransactionData } from '@/lib/transactionUtils';
import { getThaiDateString } from '@/lib/dateUtils';

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
    
    // 1. Determine Source Sheet dynamically
    const tagNum = tagId.replace("RT", "").trim();
    const sourceSheet = `Roll Tag${tagNum}`;
    
    // 2. Check "Form" Availability First
    const formCheck = await getSheetData(ssId, `${FORM_SHEET}!G3:G3`);
    if (formCheck && formCheck[0] && formCheck[0][0]) {
        console.log(`[Process] Form Busy (Doc: ${formCheck[0][0]}). Auto-Archiving...`);
        // Form is busy -> Auto-Archive to "Waiting" list
        const { archiveCurrentForm } = await import('@/lib/orderUtils');
        const archiveRes = await archiveCurrentForm(undefined, undefined, ssId);
        if (!archiveRes.success) {
             throw new Error("Failed to auto-archive current job: " + archiveRes.error);
        }
    }

    // 3. Read Roll Tag Data
    const rollTagData = await getSheetData(ssId, `${sourceSheet}!A4:E17`);
    const custIdData = [[rollTagData?.[0]?.[1] || ""]];
    const custNameData = [[rollTagData?.[1]?.[1] || ""]];
    const itemRows = Array.from({ length: 9 }, (_, index) => rollTagData?.[index + 5] || []);
    const ordersData = itemRows.map(row => [row[0] || ""]);
    const itemsData = itemRows.map(row => [row[1] || ""]);
    const qtyData = itemRows.map(row => [row[4] || ""]);

    const custName = custNameData?.[0]?.[0] || "Unknown";
    const custId = custIdData?.[0]?.[0] || "";
    console.log(`[Process] Read Data - Cust: ${custName}, Items: ${itemsData?.length || 0}`);

    // 4. Generate Doc Number
    const newDocId = await generateNewDocNumber(ssId);
    console.log(`[Process] Generated DocId: ${newDocId}`);

    // 5. Prepare Data
    const today = getThaiDateString(); // Thai-timezone date for Sheets

    // Prepare Archive Data
    const dataToArchive = [];
    
    // Prepare Form Data Arrays
    const formSequences: any[] = [];
    const formOrders: any[] = [];
    const formItems: any[] = [];
    const formQty: any[] = [];
    
    let currentSequence = 1;
    let orderGroupSequence = 0;
    let lastValidOrderNo = "";

    // Loop 9 rows (Legacy Max)
    for (let i = 0; i < 9; i++) {
        const orderNo = ordersData?.[i]?.[0]?.trim() || "";
        const itemCode = itemsData?.[i]?.[0]?.trim() || "";
        const qtyVal = qtyData?.[i]?.[0] || ""; // Keep as string or number

        // Logic from legacy for grouping
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
                "กำลังดำเนินการ", "", today
            ]);
            
            // Form Data
            formSequences.push([isNewOrderGroup ? orderGroupSequence : ""]);
            formOrders.push([isNewOrderGroup ? lastValidOrderNo : ""]);
            formItems.push([itemCode]);
            formQty.push([qtyVal]);
            
            currentSequence += 1;
        } else {
            // Empty rows for Form
            formSequences.push([""]);
            formOrders.push([""]);
            formItems.push([""]);
            formQty.push([""]);
        }
    }

    // 6. Write to "Archive" (Data Sheet)
    console.log(`[Process] Prepared ${dataToArchive.length} rows for Archive. Writing to ${DATA_SHEET}...`);
    if (dataToArchive.length > 0) {
        try {
            const cleanRows = dataToArchive.map(row =>
                row.map(d => (d === undefined || d === null) ? "" : d)
            );
            await appendSheetData(ssId, `'${DATA_SHEET}'!A:I`, cleanRows);
            console.log(`[Process] ✅ Successfully wrote ${dataToArchive.length} rows to คลังข้อมูล`);
        } catch (err) {
            console.error(`[Process] ❌ Failed to write to คลังข้อมูล:`, err);
            // CRITICAL: Throw validation error so User sees it!
            throw new Error(`Failed to write to Archive (คลังข้อมูล): ${err instanceof Error ? err.message : String(err)}`);
        }
    } else {
        console.warn(`[Process] ⚠️ No data to write to คลังข้อมูล (Items empty?)`);
    }

    // 7. Update "Form" Header
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

    // 10. Clear Roll Tag only after all required writes succeed.
    await batchClearSheetRanges(ssId, [
        `${sourceSheet}!B4`,
        `${sourceSheet}!B6`,
        `${sourceSheet}!A9:A17`,
        `${sourceSheet}!B9:B17`,
        `${sourceSheet}!D9:D17`,
        `${sourceSheet}!E9:E17`,
    ]);

    // 11. Notification (Push to APK)
    try {
        const { sendFcmToDevices } = await import('@/lib/fcmSender');

        const itemSummary = formItems.map((codeArr, idx) =>
             codeArr[0] ? `${codeArr[0]} (x${formQty[idx][0]})` : null
        ).filter(Boolean).join(', ');

        await sendFcmToDevices({
            title: "📦 งานใหม่เข้า (New Job)",
            body: `ลูกค้า: ${custName} | เอกสาร: ${newDocId}\nรายการ: ${itemSummary}`,
            data: { type: 'new_job', docId: newDocId },
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

  } catch (error: any) {
    console.error("Order Process Error:", error);
    return NextResponse.json(
        { error: error.message, stack: error.stack }, 
        { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}
