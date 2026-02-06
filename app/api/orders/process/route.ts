import { NextResponse } from 'next/server';
import { getSheetData, updateSheetData, clearSheetRange, appendSheetRow, PO_SPREADSHEET_ID } from '@/lib/googleSheets';
import { generateNewDocNumber } from '@/lib/docUtils';
import { writeTransactionData } from '@/lib/transactionUtils';

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
    const { tagId } = body; // 'RT1' or 'RT2'
    // ... logic continues ...

    // 0. Define Constants
    // IMPORTANT: Use PO_SPREADSHEET_ID
    const ssId = PO_SPREADSHEET_ID; 
    console.log(`[Process] Starting for Tag: ${tagId}, SS_ID: ${ssId || 'UNDEFINED'}`);
    
    // 1. Determine Source Sheet
    const sourceSheet = tagId === 'RT1' ? ROLL_TAG_1 : ROLL_TAG_2;
    
    // 2. Check "Form" Availability First
    const formCheck = await getSheetData(ssId, `${FORM_SHEET}!G3:G3`);
    if (formCheck && formCheck[0] && formCheck[0][0]) {
        console.log(`[Process] Form Busy (Doc: ${formCheck[0][0]}). Auto-Archiving...`);
        // Form is busy -> Auto-Archive to "Waiting" list
        const { archiveCurrentForm } = await import('@/lib/orderUtils');
        const archiveRes = await archiveCurrentForm();
        if (!archiveRes.success) {
             throw new Error("Failed to auto-archive current job: " + archiveRes.error);
        }
    }

    // 3. Read Roll Tag Data
    const [custIdData, custNameData, ordersData, itemsData, qtyData] = await Promise.all([
        getSheetData(ssId, `${sourceSheet}!B4`),
        getSheetData(ssId, `${sourceSheet}!B5`),
        getSheetData(ssId, `${sourceSheet}!A9:A17`),
        getSheetData(ssId, `${sourceSheet}!B9:B17`),
        getSheetData(ssId, `${sourceSheet}!E9:E17`)
    ]);

    const custName = custNameData?.[0]?.[0] || "Unknown";
    const custId = custIdData?.[0]?.[0] || "";
    console.log(`[Process] Read Data - Cust: ${custName}, Items: ${itemsData?.length || 0}`);

    // 4. Generate Doc Number
    const newDocId = await generateNewDocNumber();
    console.log(`[Process] Generated DocId: ${newDocId}`);

    // 5. Prepare Data
    const today = new Date().toLocaleDateString('th-TH'); // DD/MM/YYYY for Sheets

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
                "รอลูกค้า", "", today
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
            // Write ALL rows
            for (let k = 0; k < dataToArchive.length; k++) {
                // Validate Row Data (No undefined)
                const cleanRow = dataToArchive[k].map(d => (d === undefined || d === null) ? "" : d);
                
                console.log(`[Process] Writing row ${k+1}/${dataToArchive.length}...`);
                // Use EXPLICIT A:A range to force append to bottom
                await appendSheetRow(ssId, `'${DATA_SHEET}'!A:A`, cleanRow);
            }
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
    await Promise.all([
        updateSheetData(ssId, `${FORM_SHEET}!G3`, [[newDocId]]),
        updateSheetData(ssId, `${FORM_SHEET}!F4`, [[today]]),
        updateSheetData(ssId, `${FORM_SHEET}!F5`, [[today]]),
        updateSheetData(ssId, `${FORM_SHEET}!D6`, [[custId]]),
        updateSheetData(ssId, `${FORM_SHEET}!F6`, [[custName]])
    ]);

    // 8. Update "Form" Body
    await Promise.all([
        updateSheetData(ssId, `${FORM_SHEET}!B10:B18`, formSequences),
        updateSheetData(ssId, `${FORM_SHEET}!C10:C18`, formOrders),
        updateSheetData(ssId, `${FORM_SHEET}!D10:D18`, formItems),
        updateSheetData(ssId, `${FORM_SHEET}!G10:G18`, formQty)
    ]);
    
    console.log(`[Process] Form Updated.`);

    // 9. Clear Roll Tag
    await Promise.all([
        clearSheetRange(ssId, `${sourceSheet}!B4`),
        clearSheetRange(ssId, `${sourceSheet}!B6`),
        clearSheetRange(ssId, `${sourceSheet}!A9:A17`),
        clearSheetRange(ssId, `${sourceSheet}!B9:B17`),
        clearSheetRange(ssId, `${sourceSheet}!D9:D17`),
        clearSheetRange(ssId, `${sourceSheet}!E9:E17`)
    ]);

    // 10. Write to Transaction Sheet (RESTORED)
    try {
        const { writeTransactionData } = await import('@/lib/transactionUtils');
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
                 console.log(`[Process] Writing ${transactionItems.length} rows to Transaction...`);
                 await writeTransactionData(transactionItems);
                 console.log(`[Process] ✅ Transaction write successful`);
            }
        }
    } catch (txErr) {
        console.error(`[Process] ❌ Failed to write Transaction:`, txErr);
        throw new Error(`Archive success, but Transaction failed: ${txErr instanceof Error ? txErr.message : String(txErr)}`);
    }
    // 11. Notification (Push to APK)
    try {
        const { messaging } = await import('@/lib/firebaseAdmin');
        const { getSheetData } = await import('@/lib/googleSheets');
        const TX_SHEET_ID = '1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM';

        const itemSummary = formItems.map((codeArr, idx) => 
             codeArr[0] ? `${codeArr[0]} (x${formQty[idx][0]})` : null
        ).filter(Boolean).join(', ');

        const deviceData = await getSheetData(TX_SHEET_ID, "'📱 Devices'!A:A");
        const tokens = deviceData?.map((r:any) => r[0]).filter((t:any) => t && t.length > 10) || [];

        if (messaging && tokens.length > 0) {
            console.log(`[Process] Sending New Job Push to ${tokens.length} devices...`);
            await messaging.sendEachForMulticast({
                tokens,
                notification: {
                    title: "📦 งานใหม่เข้า (New Job)",
                    body: `ลูกค้า: ${custName} | เอกสาร: ${newDocId}\nรายการ: ${itemSummary}`,
                },
                data: {
                    type: 'new_job',
                    docId: newDocId
                },
                android: { notification: { sound: 'default' } }
            });
        }
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
