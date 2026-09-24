import { NextResponse } from 'next/server';
import { 
    uploadPdfToDrive, 
    updateSheetData,
    clearSheetRange,
    findAllRowIndices,
    getSheetData,
    appendSheetData,
    lookupCustomerName
} from '@/lib/googleSheets';
import { withFormLock, lockErrorStatus, readArchive, rowNumbersOf, setActiveJobDocNum } from '@/lib/orderUtils';
import { generateDeliveryNotePdf, DeliveryItem } from '@/lib/pdfGenerator';

const DATA_SHEET = "คลังข้อมูล";
const DELIVERY_FOLDER_ID = process.env.NEXT_PUBLIC_DELIVERY_FOLDER_ID || '1QGOYQUX8eDxmzuZ6pbiXJH5iuKAZG8s3';

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
    const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
    const ssid = await resolveSpreadsheetId(branchId, 'doc');

    return await withFormLock(ssid, async () => {
        let archiveData = await readArchive(ssid);
        let rowIndices = rowNumbersOf(archiveData, docNum!);
        let jobRows = rowIndices.map(r => archiveData[r - 1]);

        // If not found in archive and is RT tag, check legacy Roll Tag sheet
        if (jobRows.length === 0 && /^RT\d+$/i.test(docNum!)) {
            const tagNum = docNum!.replace(/RT/i, "").trim();
            const sheetName = `Roll Tag${tagNum}`;
            const rtData = await getSheetData(ssid, `'${sheetName}'!A4:F17`);
            
            if (rtData && rtData.length > 0) {
                const customerId = rtData[0]?.[1]; // B4
                const custName = rtData[1]?.[1] || customerId; // B5
                const items: any[] = [];
                let firstOrderNo = "";

                for (let i = 3; i < rtData.length; i++) {
                    const row = rtData[i];
                    if (!row || !row[1]) continue;
                    const oNo = row[0];
                    if (oNo && !firstOrderNo) firstOrderNo = oNo;
                    items.push({
                        orderNo: row[0],
                        itemCode: row[1],
                        qty: row[4]
                    });
                }

                if (items.length > 0) {
                    const finalDocNum = firstOrderNo || docNum!;
                    const today = getThaiDate();
                    const archiveRows = items.map((it, idx) => [
                        finalDocNum,
                        custName,
                        idx + 1,
                        it.orderNo,
                        it.itemCode,
                        it.qty,
                        "กำลังดำเนินการ",
                        "",
                        today
                    ]);

                    const cleanArchiveRows = archiveRows.map(row =>
                        row.map(d => (d === undefined || d === null) ? "" : d)
                    );
                    await appendSheetData(ssid, `'${DATA_SHEET}'!A:I`, cleanArchiveRows, 'INSERT_ROWS');

                    // Write transactions (Reduce inventory!)
                    try {
                        const { writeTransactionData } = await import('@/lib/transactionUtils');
                        const invSSID = await resolveSpreadsheetId(branchId, 'inventory');
                        const transactionItems = items.map(it => ({
                            itemCode: it.itemCode,
                            quantity: Number(it.qty) || 0,
                            orderNumber: it.orderNo,
                            docNumber: finalDocNum
                        })).filter(it => it.itemCode);

                        if (transactionItems.length > 0) {
                            await writeTransactionData(transactionItems, invSSID);
                        }
                    } catch (txErr) {
                        console.error("[Finalize] Failed to write inventory transactions:", txErr);
                    }

                    // Clear legacy sheet
                    await clearSheetRange(ssid, `'${sheetName}'!A4:F17`);

                    docNum = finalDocNum;
                    // Re-read archive rows
                    archiveData = await readArchive(ssid);
                    rowIndices = rowNumbersOf(archiveData, docNum!);
                    jobRows = rowIndices.map(r => archiveData[r - 1]);
                }
            }
        }

        if (jobRows.length === 0) {
            throw new Error(`Job ${docNum} not found in Archive`);
        }

        let customerName = jobRows[0]?.[1] || "Unknown";
        const lookedUpCust = await lookupCustomerName(ssid, customerName);
        if (lookedUpCust) {
            customerName = lookedUpCust;
        }

        const deliveryItems: DeliveryItem[] = jobRows.map((r, idx) => ({
            seq: idx + 1,
            orderNo: String(r[3] || '').trim(),
            itemCode: String(r[4] || '').trim(),
            quantity: r[5] || ''
        })).filter(it => it.itemCode);

        // 2. Generate Delivery Note PDF directly
        console.log(`[Finalize] Generating delivery note PDF directly (${deliveryItems.length} items)...`);
        const finalPdfBytes = await generateDeliveryNotePdf({
            docNum: docNum!,
            company: 'FORMICA',
            senderName: 'DD Service And Transport',
            vehiclePlate: location || '',
            loadDate: jobRows[0]?.[8] || getThaiDate(),
            deliveryDate: getThaiDate(),
            customerName: customerName,
            items: deliveryItems,
            signature: signature
        });

        // 2.5 Construct Filename ("ใบส่งสินค้า {OrderNos}.pdf")
        const uniqueOrders = Array.from(new Set(
            deliveryItems.map(it => it.orderNo).filter(Boolean)
        ));
        
        const pdfName = uniqueOrders.length > 0
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

        // 4. Update "Archive" (Status=เสร็จสิ้น, Link=pdfLink) in คลังข้อมูล
        const actualRowIndices = await findAllRowIndices(ssid, DATA_SHEET, 0, docNum!);
        const targetIndices = actualRowIndices.length > 0 ? actualRowIndices : rowIndices;

        const updates = [];
        for (const row of targetIndices) {
            updates.push({ range: `'${DATA_SHEET}'!G${row}`, values: [['เสร็จสิ้น']] });
            updates.push({ range: `'${DATA_SHEET}'!H${row}`, values: [[pdfLink]] });
        }

        if (updates.length > 0) {
            await Promise.all(updates.map(u => updateSheetData(ssid, u.range, u.values)));
        }

        // Clear active job pointer
        await setActiveJobDocNum(ssid, "");

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

        // 5. Return PDF Blob
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
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bangkokOffset = 7 * 60 * 60 * 1000;
    const thDate = new Date(utc + bangkokOffset);

    const d = thDate.getDate();
    const m = thDate.getMonth() + 1;
    const y = thDate.getFullYear() + 543;
    return `${d}/${m}/${y}`;
}

export const maxDuration = 60;
