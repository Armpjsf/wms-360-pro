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
    getProducts
} from '@/lib/googleSheets';
import { PDFDocument } from 'pdf-lib';

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
    const { docNum: rawDocNum, signature } = await req.json();
    const docNum = rawDocNum ? String(rawDocNum).trim() : null;

    if (!docNum) {
        return NextResponse.json({ error: 'Missing DocNum' }, { status: 400, headers: corsHeaders });
    }

    // --- NEW: Multi-Active Job Logic (Promote from Pending) ---
    // 0. Check if this docNum is ALREADY the active one in 'ส่งสินค้า'
    //    If NOT, we must find it in Roll Tag 1/2 and "Promote" it to Active first.
    
    // Read current Active DocNum from G3
    const activeCheck = await getSheetData(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!G3:G3`);
    const currentActiveDoc = activeCheck?.[0]?.[0];

    if (currentActiveDoc !== docNum) {
        console.log(`[Finalize] Job ${docNum} is NOT active (Current: ${currentActiveDoc}). Searching Roll Tags...`);
        
        // Helper to find and parse Roll Tag Data
        const findInRollTag = async (sheetName: string) => {
            const data = await getSheetData(PO_SPREADSHEET_ID, `'${sheetName}'!A4:F17`);
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

        // Check RT1 / RT2
        let sourceInfo = null;
        if (docNum === 'RT1') sourceInfo = await findInRollTag(ROLL_TAG_1);
        else if (docNum === 'RT2') sourceInfo = await findInRollTag(ROLL_TAG_2);
        
        // If not explicit RT ID, maybe user passed actual Order ID? Use fallback?
        // For now, assume Frontend sends 'RT1'/'RT2' for pending.
        
        if (sourceInfo) {
             console.log(`[Finalize] Found job in ${sourceInfo.sheet}. Promoting to ${FORM_SHEET}...`);
             
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
                 await clearSheetRange(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!B10:G25`);
                 
                 // Write new items
                 if (itemRows.length > 0) {
                     updates.push({ 
                         range: `'${FORM_SHEET}'!B10:G${9 + itemRows.length}`, 
                         values: itemRows 
                     });
                 }
                 
                 await Promise.all(updates.map(u => updateSheetData(PO_SPREADSHEET_ID, u.range, u.values)));
                 
                 // Update local variable to use the REAL docNum for PDF generation
                 // (Because we generated PDF with 'RT1' as name? No, we want real OrderNo)
                 // Wait, rawDocNum passed was 'RT1'. We should update `docNum` variable or just rely on G3 read later?
                 // The step 2.5 reads G3/Items to name PDF. So we are good.
                 
                 console.log(`[Finalize] Promotion Complete. New Active Doc: ${finalDocNum}`);
                 
                 // IMPORTANT: Check if we need to clear the Roll Tag source?
                 // Usually, Admin clears it. But if Driver "Takes" it, should we clear it?
                 // If we finish it, we probably should clear it to prevent duplicate doing.
                 // Let's clear the items in RT? Or just leave it?
                 // User request: "Shipment 2 might come before Shipment 1".
                 // If we clear it, it disappears from Queue. Good.
                 
                 await clearSheetRange(PO_SPREADSHEET_ID, `'${sourceInfo.sheet}'!A4:F17`);
             }
        }
    }

    // 1.5 Update "Delivery Date" (F5) to TODAY (Signature Date)
    // This allows "Load Date" (F4) to remain as "Creation Date" while "Delivery Date" is "Signature Date".
    console.log('[Finalize] Updating Delivery Date (F5) to today...');
    await updateSheetData(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!F5`, [[getThaiDate()]]);

    // 1. Generate Raw PDF (Without waiting for Sheets signature)
    console.log('[Finalize] Generating base PDF...');
    const gid = 1427637725; // ส่งสินค้า form sheet with signature (Updated 2026-02-06)
    const rawPdfBuffer = await getSheetPdfBlob(PO_SPREADSHEET_ID, gid, 'B1:H36', false);
    
    // 2. Post-Process PDF if Signature exists
    let finalPdfBytes: Uint8Array;
    
    if (signature) {
        console.log('[Finalize] Overlaying signature with pdf-lib...');
        try {
            // Load the PDF
            const existingPdfBytes = new Uint8Array(rawPdfBuffer);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            
            // Embed the signature image
            // Signature is "data:image/png;base64,..."
            const pngImageBytes = await fetch(signature).then((res) => res.arrayBuffer());
            const pngImage = await pdfDoc.embedPng(pngImageBytes);
            
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            const { width, height } = firstPage.getSize();

            // User feedback: Y=140 overlaps text. Move UP to Y=160.
            // X=405 seems correct.
            // User feedback: Adjust signature to be smaller (Original: 160x70)
            const boxWidth = 100; 
            const boxHeight = 50;
            
            // Scale to fit within box (preserve aspect ratio)
            const scale = Math.min(boxWidth / pngImage.width, boxHeight / pngImage.height);
            const finalWidth = pngImage.width * scale;
            const finalHeight = pngImage.height * scale;

            // Center horizontally within the original 160px space
            // Original Space Center: 405 + (160/2) = 485
            // New Image Center: x + (finalWidth/2) = 485 => x = 485 - (finalWidth/2)
            const xPosition = 485 - (finalWidth / 2);

            firstPage.drawImage(pngImage, {
                x: xPosition,
                y: 170,  // Move UP slightly more? Original 160. Let's try 170 to be safe.
                width: finalWidth,
                height: finalHeight,
            });
            
            finalPdfBytes = await pdfDoc.save();
        } catch (e) {
            console.error("PDF Modification Error:", e);
            finalPdfBytes = new Uint8Array(rawPdfBuffer);
        }
    } else {
        finalPdfBytes = new Uint8Array(rawPdfBuffer);
    }

    // 2.5 Construct Filename (Match Legacy Python: "ใบส่งสินค้า {OrderNos}.pdf")
    // Fetch Order Numbers from C10:C25
    const orderData = await getSheetData(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!C10:C25`);
    const uniqueOrders = Array.from(new Set(
        orderData?.map((r: any) => r[0]?.toString().trim()).filter((x: any) => x) || []
    ));
    
    let pdfName = uniqueOrders.length > 0
        ? `ใบส่งสินค้า ${uniqueOrders.join(',')}.pdf`
        : `ใบส่งสินค้า ${docNum}.pdf`;

    console.log('[Finalize] Generated Filename:', pdfName);

    // 3. Upload to Drive (The Signed PDF)
    const uploadRes = await uploadPdfToDrive(Buffer.from(finalPdfBytes), pdfName, DELIVERY_FOLDER_ID);
    const pdfLink = uploadRes.webViewLink;

    // --- NOTIFICATION: Signature Completed (Push to APK) ---
    try {
        // Dynamic Import to avoid circular deps or build issues
        const { messaging } = await import('@/lib/firebaseAdmin');
        const { getSheetData } = await import('@/lib/googleSheets');
        const TX_SHEET_ID = '1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM';

        const deviceData = await getSheetData(TX_SHEET_ID, "'📱 Devices'!A:A");
        const tokens = deviceData?.map((r:any) => r[0]).filter((t:any) => t && t.length > 10) || [];

        if (messaging && tokens.length > 0) {
             console.log(`[Finalize] Sending Signature Push to ${tokens.length} devices...`);
             await messaging.sendEachForMulticast({
                tokens,
                notification: {
                    title: "✍️ ได้รับลายเซ็นใหม่ (Signature Received)",
                    body: `เอกสาร ${docNum} ลงนามเรียบร้อยแล้ว`,
                },
                android: { notification: { sound: 'default' } }
             });
        }
    } catch (notiErr) {
        console.warn("[Finalize] Failed to send Signature Notification:", notiErr);
    }
    // -------------------------------------------------------

    // 4. Update "Archive" (Status=เสร็จสิ้น, Link=pdfLink)
    console.log(`[Finalize] Searching for DocNum: "${docNum}" to update status...`);
    const rowIndices = await findAllRowIndices(PO_SPREADSHEET_ID, DATA_SHEET, 0, docNum);
    console.log(`[Finalize] Found ${rowIndices.length} rows to update:`, rowIndices);
    
    if (rowIndices.length > 0) {
        const updates = [];
        for (const row of rowIndices) {
            updates.push({ range: `'${DATA_SHEET}'!G${row}`, values: [['เสร็จสิ้น']] });
            updates.push({ range: `'${DATA_SHEET}'!H${row}`, values: [[pdfLink]] });
        }
        await Promise.all(updates.map(u => updateSheetData(PO_SPREADSHEET_ID, u.range, u.values)));
        console.log('[Finalize] Archive updated');
    }

    // 5. Clear Form
    
    // --- NEW: Record 'OUT' Transaction for Profit Analytics ---
    console.log('[Finalize] Recording transactions for Profit Analysis...');
    try {
        // Read items before clearing (D=Item, G=Qty)
        // Range: D10:G25
        const itemData = await getSheetData(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!D10:G25`);
        
        if (itemData && itemData.length > 0) {
            // Fetch products to look up standard selling price
            const products = await getProducts();
            
            // Process in parallel
            const txPromises = itemData.map(async (row) => {
                const sku = row[0]; // Col D (index 0)
                const qtyStr = row[3]; // Col G (index 3)
                
                if (!sku || !qtyStr) return;
                
                const qty = parseFloat(qtyStr.replace(/,/g, ''));
                if (isNaN(qty) || qty <= 0) return;

                // Find standard price
                const product = products.find(p => p.name === sku);
                const price = product ? product.price : 0;

                await addTransaction('OUT', {
                    date: getThaiDate(), // Use the signature date
                    sku: sku,
                    qty: qty,
                    price: price, // Standard Sell Price
                    docRef: `Order: ${docNum}`, // Log the Order/Doc Num
                    unit: row[2] || 'unit' // Col F (index 2)
                });
            });

            await Promise.all(txPromises);
            console.log(`[Finalize] Recorded ${txPromises.length} transactions.`);
        }
    } catch (txError) {
        console.error('[Finalize] Failed to record transactions:', txError);
        // Continue to clear form even if recording fails to avoid blocking the user flow
    }
    // -----------------------------------------------------

    await Promise.all([
        clearSheetRange(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!G3`),
        clearSheetRange(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!F4:F5`),
        clearSheetRange(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!D6`),
        clearSheetRange(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!F6`),
        clearSheetRange(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!B10:D25`),
        clearSheetRange(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!G10:G25`),
        clearSheetRange(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!${SIG_CELL}`),
        clearSheetRange(PO_SPREADSHEET_ID, `'${FORM_SHEET}'!H33`) // Clear Secret Signature URL
    ]);

    // 6. Return PDF Blob
    return new NextResponse(Buffer.from(finalPdfBytes), {
        status: 200,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${encodeURIComponent(pdfName)}"`
        }
    });

  } catch (error: any) {
    console.error("Finalize Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
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
