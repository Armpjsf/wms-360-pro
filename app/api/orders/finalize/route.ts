import { NextResponse } from 'next/server';
import { 
    getSheetPdfBlob, 
    uploadPdfToDrive, 
    updateSheetData,
    clearSheetRange,
    findAllRowIndices,
    PO_SPREADSHEET_ID,
    getSheetData,
    addTransaction,
    getProducts,
    appendSheetData
} from '@/lib/googleSheets';
import { PDFDocument } from 'pdf-lib';
import { withFormLock, restoreOrderToForm, archiveCurrentForm, lockErrorStatus } from '@/lib/orderUtils';
import { generateDeliveryNotePdf, DeliveryItem } from '@/lib/pdfGenerator';

const FORM_SHEET = "ส่งสินค้า";
const DATA_SHEET = "คลังข้อมูล";
const ROLL_TAG_1 = "Roll Tag1";
const ROLL_TAG_2 = "Roll Tag2";
// Use Env Var for Folder ID, fallback to Legacy ID found in other files
const DELIVERY_FOLDER_ID = process.env.NEXT_PUBLIC_DELIVERY_FOLDER_ID || '1QGOYQUX8eDxmzuZ6pbiXJH5iuKAZG8s3';
const SIG_CELL = "G33"; 

export async function POST(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return NextResponse.json({}, { headers: corsHeaders });
  }

  try {
    const { docNum: rawDocNum, signature, branchId, packs, location } = await req.json();
    let docNum = rawDocNum ? String(rawDocNum).trim() : null;

    if (!docNum) {
        return NextResponse.json({ error: 'Missing DocNum' }, { status: 400, headers: corsHeaders });
    }

    // Resolver for Multi-Branch Isolation
    const { resolveSpreadsheetId, addDeliveryHistory } = await import('@/lib/googleSheets');
    const ssid = await resolveSpreadsheetId(branchId, 'doc');

    return await withFormLock(ssid, async () => {
    // งานที่จะเซ็นต้องอยู่บนฟอร์มก่อนสร้าง PDF — ถ้าไม่ใช่ ให้ดึงขึ้นฟอร์มก่อน
    // (เดิมจะสร้าง PDF จากงานอะไรก็ตามที่ค้างบนฟอร์ม แล้วปิดงานผิดใบ)
    if (!/^RT\d+$/i.test(docNum!)) {
        const onForm = String((await getSheetData(ssid, `'${FORM_SHEET}'!G3:G3`))?.[0]?.[0] || '').trim();
        if (onForm !== docNum) {
            console.log(`[Finalize] ${docNum} not on form (current: ${onForm || '-'}). Restoring...`);
            await restoreOrderToForm(docNum!, ssid);
        }
    }

    // --- Pre-fetch data for Delivery History & Active Job check in parallel ---
    const [custNameData, ordersData, itemsData, qtyData, activeCheck] = await Promise.all([
        getSheetData(ssid, `'${FORM_SHEET}'!F6`),
        getSheetData(ssid, `'${FORM_SHEET}'!C10:C25`),
        getSheetData(ssid, `'${FORM_SHEET}'!D10:D25`),
        getSheetData(ssid, `'${FORM_SHEET}'!G10:G25`),
        getSheetData(ssid, `'${FORM_SHEET}'!G3:G3`)
    ]);
    const customerName = custNameData?.[0]?.[0] || "Unknown";

    // --- NEW: Multi-Active Job Logic (Promote from Pending) ---
    // 0. Check if this docNum is ALREADY the active one in 'ส่งสินค้า'
    //    If NOT, we must find it in Roll Tag 1/2 and "Promote" it to Active first.
    
    const currentActiveDoc = activeCheck?.[0]?.[0];

    if (currentActiveDoc !== docNum) {
        console.log(`[Finalize] Job ${docNum} is NOT active (Current: ${currentActiveDoc}). Searching Roll Tags...`);
        
        // Helper to find and parse Roll Tag Data
        const findInRollTag = async (sheetName: string) => {
            const data = await getSheetData(ssid, `'${sheetName}'!A4:F17`);
            if (!data || data.length === 0) return null;
            
            // In Roll Tag, matches are usually just items. But where is the DocNum stored?
            // Actually, Roll Tag 1/2 structure is:
            // B4: Customer ID
            // B5: Customer Name
            // A5..A17: Order No (This is the Doc Num!)
            
            // We need to find if *any* row in A column matches the docNum
            // Wait, usually DocNum in 'ส่งสินค้า' comes from... where?
            // In the 'Status' API, we saw: `const orderNo = row[0]; // Column A`
            
            // Let's look for our docNum in Column A (Index 0)
            const matchRowIndex = data.findIndex((r: any) => r[0] === docNum);
            
            if (matchRowIndex === -1) return null;

            // Found it! 
            // In Roll Tags, multiple rows might share the same customer?
            // Actually, Roll Tag is usually ONE customer, multiple items.
            // But 'docNum' here is the Order Number.
            // If the Roll Tag contains mixed orders, we only extract the items for THIS order?
            // OR does Roll Tag represent ONE order?
            // Based on `status/route.ts`:
            // `pendingTasks` returns items for the whole sheet.
            // It treats the whole Sheet (RT1) as one "Job" usually?
            // Wait, current UI shows "Card" per RT1/RT2.
            // The "DocNum" passed from UI for pending job is `job.id` which is 'RT1' or 'RT2'??
            // Let's check `status/route.ts`:
            // `id` is 'RT1' or 'RT2'. 
            // `customer` is from B5.
            
            // OH! The UI treats "Pending Job" as the WHOLE Sheet (RT1 or RT2).
            // So `docNum` sent here might be 'RT1' or 'RT2' OR the actual Order Number if the UI grabs it?
            
            // Let's check `jobs/page.tsx` again.
            // In `fetchJobs`: `pendingJobs` = `data.pending`.
            // In `status/route.ts`: `pending` objects have `.id` = "RT1" / "RT2".
            // So the `docNum` passed to handleSignClick will be "RT1" or "RT2".
            
            return { sheet: sheetName, data: data, isTagID: true };
        };

        // Check RT dynamic
        let sourceInfo = null;
        if (docNum && /^RT\d+$/i.test(docNum)) {
            const tagNum = docNum.replace(/RT/i, "").trim();
            const sheetName = `Roll Tag${tagNum}`;
            sourceInfo = await findInRollTag(sheetName);
        }
        
        if (sourceInfo) {
             console.log(`[Finalize] Found job in ${sourceInfo.sheet}. Promoting to ${FORM_SHEET}...`);
             // เก็บงานที่ค้างบนฟอร์มกลับคลังข้อมูลก่อน (คงสถานะเดิม) ไม่ให้ถูกเขียนทับหาย
             if (currentActiveDoc) {
                 await archiveCurrentForm(undefined, undefined, ssid);
             }
             
             // Extract Data from Roll Tag
             const rtData = sourceInfo.data;
             const customerId = rtData[0]?.[1]; // B4
             const customerName = rtData[1]?.[1]; // B5
             
             // Items start from row index ? 
             // In status API: `for (let i = 0; i < data.length; i++)` -> skips header < 3
             // Item Rows in RT: 
             // Col A: OrderNo, Col B: ItemCode, Col E: Qty
             
             const items = [];
             let firstOrderNo = "";
             
             for (let i = 3; i < rtData.length; i++) {
                 const row = rtData[i];
                 if (!row || !row[1]) continue;
                 
                 const oNo = row[0];
                 if (oNo && !firstOrderNo) firstOrderNo = oNo; // Use first found order as DocNum
                 
                 items.push({
                     orderNo: row[0],
                     itemCode: row[1],
                     qty: row[4]
                 });
             }

             if (items.length > 0) {
                 // ** WRITE TO ACTIVE FORM **
                 // 1. DocNum (G3) -> Use First Order No (or RT ID if missing)
                 const finalDocNum = firstOrderNo || docNum;
                 
                 // 2. Customer (F6) -> B5
                 // 3. Date (F5) -> Today?
                 // 4. Clear old items (B10:G25)
                 // 5. Write new items
                 
                 const updates = [
                     { range: `'${FORM_SHEET}'!G3`, values: [[finalDocNum]] },
                     { range: `'${FORM_SHEET}'!F6`, values: [[customerName]] },
                     { range: `'${FORM_SHEET}'!F4`, values: [[getThaiDate()]] }, // Ref Date (Load Date - Created Now)
                     // F5 (Delivery Date) will be updated in Step 1.5 anyway
                 ];
                 
                 // Prepare Items for Write (Start B10)
                 // Cols: B(No), C(Order), D(Item), E(Name?), F(Unit?), G(Qty)
                 // RT has: A(Order), B(Item), E(Qty)
                 // We map: C=Order, D=Item, G=Qty
                 
                 const itemRows = items.map((it, idx) => [
                     idx + 1,       // B: No
                     it.orderNo,    // C: Order
                     it.itemCode,   // D: Item
                     "",            // E: Descr (Formula?)
                     "",            // F: Unit
                     it.qty         // G: Qty
                 ]);
                 
                 // Clear existing items first
                 await clearSheetRange(ssid, `'${FORM_SHEET}'!B10:G25`);
                 
                 // Write new items
                 if (itemRows.length > 0) {
                     updates.push({ 
                         range: `'${FORM_SHEET}'!B10:G${9 + itemRows.length}`, 
                         values: itemRows 
                     });
                 }
                 
                 await Promise.all(updates.map(u => updateSheetData(ssid, u.range, u.values)));
                 
                 // ** WRITE TO ARCHIVE (คลังข้อมูล) & TRANSACTIONS ON DIRECT SIGNATURE **
                 try {
                     const today = getThaiDate();
                     const archiveRows = items.map((it, idx) => [
                         finalDocNum,       // A: DocNum
                         customerName,     // B: CustName
                         idx + 1,          // C: Seq
                         it.orderNo,       // D: OrderNo
                         it.itemCode,      // E: ItemCode
                         it.qty,           // F: Qty
                         "กำลังดำเนินการ", // G: Status (found & updated to เสร็จสิ้น later in this request!)
                         "",               // H: PDF Link
                         today             // I: Date
                     ]);

                     // เขียนทีเดียวทั้งชุดด้วย range เต็มความกว้าง A:I (ไม่ใช่ A:A)
                     // range A:A ทำให้ Google Sheets append เพี้ยนตำแหน่งคอลัมน์ (ข้อมูลไปโผล่ J–Q)
                     // ต้องระบุ range ให้ตรงจำนวนคอลัมน์ของข้อมูล (9 คอลัมน์ = A:I) เหมือน process route
                     const cleanArchiveRows = archiveRows.map(row =>
                         row.map(d => (d === undefined || d === null) ? "" : d)
                     );
                     await appendSheetData(ssid, `'${DATA_SHEET}'!A:I`, cleanArchiveRows, 'INSERT_ROWS');
                     console.log(`[Finalize] Direct sign: Wrote ${archiveRows.length} rows to คลังข้อมูล as 'กำลังดำเนินการ'`);

                     // Write transactions (Reduce inventory!)
                     const { writeTransactionData } = await import('@/lib/transactionUtils');
                     const invSSID = await resolveSpreadsheetId(branchId, 'inventory');
                     
                     const transactionItems = items.map(it => ({
                         itemCode: it.itemCode,
                         quantity: Number(it.qty) || 0,
                         orderNumber: it.orderNo,
                         docNumber: finalDocNum
                     })).filter(it => it.itemCode);

                     if (transactionItems.length > 0) {
                         console.log(`[Finalize] Direct sign: Writing ${transactionItems.length} items to Transaction (SSID: ${invSSID})...`);
                         await writeTransactionData(transactionItems, invSSID);
                         console.log(`[Finalize] ✅ Direct sign: Transaction write successful`);
                     }
                 } catch (archiveErr) {
                     console.error("[Finalize] Failed to write initial archive/transaction rows:", archiveErr);
                 }

                 // Update local variable to use the REAL docNum for PDF generation and status update
                 docNum = finalDocNum;
                 
                 console.log(`[Finalize] Promotion Complete. New Active Doc: ${docNum}`);
                 
                 await clearSheetRange(ssid, `'${sourceInfo.sheet}'!A4:F17`);
             }
        }
    }

    // 1.5 Update "Delivery Date" (F5) to TODAY (Signature Date)
    // This allows "Load Date" (F4) to remain as "Creation Date" while "Delivery Date" is "Signature Date".
    console.log('[Finalize] Updating Delivery Date (F5) to today...');
    await updateSheetData(ssid, `'${FORM_SHEET}'!F5`, [[getThaiDate()]]);

    // 1. Prepare items for Delivery Note
    const deliveryItems: DeliveryItem[] = [];
    if (itemsData && itemsData.length > 0) {
        for (let i = 0; i < itemsData.length; i++) {
            const sku = itemsData[i]?.[0]?.trim();
            if (sku) {
                deliveryItems.push({
                    seq: i + 1,
                    orderNo: ordersData?.[i]?.[0]?.trim() || '',
                    itemCode: sku,
                    quantity: qtyData?.[i]?.[0] || ''
                });
            }
        }
    }

    // 2. Generate Delivery Note PDF directly (no Google Sheets PDF export needed)
    console.log(`[Finalize Fast] Generating delivery note PDF directly (${deliveryItems.length} items)...`);
    const finalPdfBytes = await generateDeliveryNotePdf({
        docNum: docNum!,
        company: 'FORMICA',
        senderName: 'DD Service And Transport',
        vehiclePlate: location || '',
        loadDate: getThaiDate(),
        deliveryDate: getThaiDate(),
        customerName: customerName || 'Unknown',
        items: deliveryItems,
        signature: signature
    });

    // 2.5 Construct Filename (Match Legacy Python: "ใบส่งสินค้า {OrderNos}.pdf")
    // Reuse already pre-fetched ordersData instead of calling getSheetData again
    const uniqueOrders = Array.from(new Set(
        ordersData?.map((r: any) => r[0]?.toString().trim()).filter((x: any) => x) || []
    ));
    
    let pdfName = uniqueOrders.length > 0
        ? `ใบส่งสินค้า ${uniqueOrders.join(',')}.pdf`
        : `ใบส่งสินค้า ${docNum}.pdf`;

    console.log('[Finalize] Generated Filename:', pdfName);

    // 3. Upload to Drive (The Signed PDF)
    let uploadRes;
    try {
        uploadRes = await uploadPdfToDrive(Buffer.from(finalPdfBytes), pdfName, DELIVERY_FOLDER_ID);
    } catch (uploadErr: any) {
        console.error("[Finalize] Drive Upload Failed:", uploadErr);
        const isAuthError = uploadErr.message?.includes('invalid_grant') || uploadErr.toString().includes('invalid_grant');
        throw new Error(isAuthError 
            ? "Google Drive Authentication Expired. Please update GMAIL_TOKEN_JSON in Vercel." 
            : `Drive Upload Failed: ${uploadErr.message || 'Unknown Error'}`
        );
    }
    const pdfLink = uploadRes.webViewLink;

    /* 
    // --- NEW: Record in Delivery History ---
    try {
        const deliveryRows: any[][] = [];
        const todayStr = getThaiDate();
        
        if (itemsData && itemsData.length > 0) {
            for (let i = 0; i < itemsData.length; i++) {
                const sku = itemsData[i]?.[0]?.trim();
                if (sku) {
                    const order = ordersData?.[i]?.[0]?.trim() || "";
                    const qty = qtyData?.[i]?.[0] || 0;
                    
                    // Fields: วันที่, ชื่อลูกค้า, จัดส่งไปที่, Order, SKU, จำนวนของ, จำนวนแพ็ก, ค่าขนส่ง, หมายเหตุ, ลิงก์เอกสาร
                    deliveryRows.push([
                        todayStr,
                        customerName,
                        location || "", 
                        order,
                        sku,
                        qty,
                        packs || 1,
                        0, // ค่าขนส่ง (Mobile process defaults to 0)
                        "เสร็จสิ้น",
                        pdfLink
                    ]);
                }
            }
        }

        if (deliveryRows.length > 0) {
            console.log(`[Finalize] Writing ${deliveryRows.length} items to Delivery History...`);
            await addDeliveryHistory(deliveryRows);
        }
    } catch (historyErr) {
        console.error("[Finalize] Failed to record delivery history:", historyErr);
    }
    */

    // --- NOTIFICATION: Signature Completed (Push to APK) — non-blocking ---
    try {
        const { sendFcmToDevices } = await import('@/lib/fcmSender');
        sendFcmToDevices({
            title: "✍️ ได้รับลายเซ็นใหม่ (Signature Received)",
            body: `เอกสาร ${docNum} ลงนามเรียบร้อยแล้ว`,
            data: { type: 'signature', docNum: String(docNum) },
        }, { tag: 'Finalize' }).catch(notiErr => console.error("[Finalize] FCM Background Send Error:", notiErr));
    } catch (notiErr) {
        console.warn("[Finalize] Failed to send Signature Notification:", notiErr);
    }
    // -------------------------------------------------------

    // 4. Update "Archive" (Status=เสร็จสิ้น, Link=pdfLink)
    console.log(`[Finalize] Searching for DocNum: "${docNum}" to update status...`);
    const { findSheetTitle } = await import('@/lib/googleSheets');
    const actualDataSheet = await findSheetTitle(ssid, ["คลังข้อมูล", "Archive", "Data"], "คลังข้อมูล");
    
    const rowIndices = await findAllRowIndices(ssid, actualDataSheet, 0, docNum!);
    console.log(`[Finalize] Found ${rowIndices.length} rows to update in ${actualDataSheet}:`, rowIndices);
    
    if (rowIndices.length === 0) {
        console.warn(`[Finalize] ⚠️ No rows found matching DocNum: ${docNum}. PDF Link was NOT saved to sheet.`);
    } else {
        const updates = [];
        for (const row of rowIndices) {
            updates.push({ range: `'${actualDataSheet}'!G${row}`, values: [['เสร็จสิ้น']] });
            updates.push({ range: `'${actualDataSheet}'!H${row}`, values: [[pdfLink]] });
        }

        console.log('[Finalize] Archiving and clearing active form in parallel...');
        // HIGH PERFORMANCE: Concurrently write all archive updates AND clear the active form ranges in one concurrent Promise.all!
        await Promise.all([
            ...updates.map(u => updateSheetData(ssid, u.range, u.values)),
            clearSheetRange(ssid, `'${FORM_SHEET}'!G3`),
            clearSheetRange(ssid, `'${FORM_SHEET}'!F4:F5`),
            clearSheetRange(ssid, `'${FORM_SHEET}'!D6`),
            clearSheetRange(ssid, `'${FORM_SHEET}'!F6`),
            clearSheetRange(ssid, `'${FORM_SHEET}'!B10:D25`),
            clearSheetRange(ssid, `'${FORM_SHEET}'!G10:G25`),
            clearSheetRange(ssid, `'${FORM_SHEET}'!${SIG_CELL}`),
            clearSheetRange(ssid, `'${FORM_SHEET}'!H33`) // Clear Secret Signature URL
        ]);
        console.log('[Finalize] Archive updated & active form cleared in parallel successfully');

        // Audit Log
        try {
            const { logAction } = await import('@/lib/auditTrail');
            await logAction({
                userId: 'System',
                userName: 'Order Finalizer',
                action: 'UPDATE',
                module: 'Outbound',
                description: `Finalized and signed Order ${docNum} for ${customerName}`,
                newValues: { docId: docNum, customer: customerName, pdfLink: pdfLink }
            });
        } catch (auditErr) {
            console.warn("[Finalize] Audit Log Failed:", auditErr);
        }
    }

    // 6. Return PDF Blob
    return new NextResponse(Buffer.from(finalPdfBytes), {
        status: 200,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${encodeURIComponent(pdfName)}"`
        }
    });
    });

  } catch (error: any) {
    console.error("Finalize Error:", error);
    return NextResponse.json({ error: error.message }, { status: lockErrorStatus(error), headers: corsHeaders });
  }
}

function getThaiDate(): string {
    const now = new Date();
    // Use fixed time zone (Asia/Bangkok) or assume server time is close enough?
    // Vercel server is UTC. We MUST shift to UTC+7.
    // simplistic shift:
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bangkokOffset = 7 * 60 * 60 * 1000;
    const thDate = new Date(utc + bangkokOffset);

    const d = thDate.getDate();
    const m = thDate.getMonth() + 1;
    const y = thDate.getFullYear() + 543;
    return `${d}/${m}/${y}`;
}

// Vercel: allow up to 60s (Hobby max) — this route does Sheets-heavy work.
export const maxDuration = 60;
