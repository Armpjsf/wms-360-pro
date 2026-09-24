import { NextRequest, NextResponse } from 'next/server';
import { resolveSpreadsheetId, findSheetTitle, getSheetData, lookupCustomerName } from '@/lib/googleSheets';
import { generateRollTagPdf, RollTagItem } from '@/lib/pdfGenerator';
import { getThaiDateString } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const tagId = searchParams.get('tagId') || 'RT1';
    const branchId = searchParams.get('branchId');

    try {
        const ssid = await resolveSpreadsheetId(branchId, 'doc');
        console.log(`[Print RollTag Fast] Branch: ${branchId || 'HQ'}, SSID: ${ssid}, Tag: ${tagId}`);

        // 1. Check คลังข้อมูล first (Single Source of Truth)
        const archiveData = await getSheetData(ssid, "'คลังข้อมูล'!A:I").catch(() => []);
        const matchingRows: any[] = [];
        if (archiveData && archiveData.length > 1) {
            for (let i = 1; i < archiveData.length; i++) {
                const row = archiveData[i];
                const docNum = String(row[0] || '').trim();
                if (docNum.toUpperCase() === tagId.toUpperCase()) {
                    matchingRows.push(row);
                }
            }
        }

        let customerId = '';
        let customerName = '';
        let note = '';
        let pickingDate = getThaiDateString();
        let shippingDate = pickingDate;
        const items: RollTagItem[] = [];

        if (matchingRows.length > 0) {
            customerId = String(matchingRows[0][1] || '').trim();
            const lookedUp = await lookupCustomerName(ssid, customerId);
            customerName = lookedUp || customerId;
            pickingDate = matchingRows[0][8] || getThaiDateString();
            shippingDate = pickingDate;

            for (const r of matchingRows) {
                const orderNo = String(r[3] || '').trim();
                const itemCode = String(r[4] || '').trim();
                const qty = r[5];
                if (itemCode || orderNo) {
                    items.push({
                        orderNo,
                        itemCode,
                        description: itemCode,
                        quantity: qty
                    });
                }
            }
        } else {
            // Fallback: Read from legacy sheet tab
            const tagNum = tagId.replace("RT", "").trim();
            const keywords = ['Roll Tag', tagNum];
            const defaultName = `Roll Tag${tagNum}`;
            const sheetName = await findSheetTitle(ssid, keywords, defaultName);

            const rawData = await getSheetData(ssid, `${sheetName}!A4:E18`);
            customerId = rawData?.[0]?.[1] || '';
            const lookedUpLegacy = await lookupCustomerName(ssid, customerId);
            customerName = rawData?.[1]?.[1] || lookedUpLegacy || customerId;
            note = rawData?.[2]?.[1] || '';
            pickingDate = rawData?.[1]?.[4] || getThaiDateString();
            shippingDate = rawData?.[2]?.[4] || pickingDate;

            // Scan item rows (starting from row index 5 which corresponds to row 9)
            for (let i = 5; i < 14; i++) {
                const row = rawData?.[i];
                if (row && (row[0] || row[1] || row[4])) {
                    const orderNo = String(row[0] || '').trim();
                    const itemCode = String(row[1] || '').trim();
                    const description = String(row[2] || '').trim();
                    const qty = row[4];
                    if (itemCode || orderNo) {
                        items.push({
                            orderNo,
                            itemCode,
                            description: description || itemCode,
                            quantity: qty
                        });
                    }
                }
            }
        }

        // Generate instant vector PDF with exact visual appearance
        const pdfBytes = await generateRollTagPdf({
            tagId,
            customerId,
            customerName: customerName || customerId,
            note,
            pickingDate,
            shippingDate,
            items
        });

        return new NextResponse(Buffer.from(pdfBytes), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${tagId}.pdf"`
            }
        });

    } catch (error: any) {
        console.error('[Print RollTag] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
