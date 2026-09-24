import { NextRequest, NextResponse } from 'next/server';
import { resolveSpreadsheetId, findSheetTitle, getSheetData } from '@/lib/googleSheets';
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

        const tagNum = tagId.replace("RT", "").trim();
        const keywords = ['Roll Tag', tagNum];
        const defaultName = `Roll Tag${tagNum}`;
        const sheetName = await findSheetTitle(ssid, keywords, defaultName);

        // Read data from the sheet range A4:E17
        const rawData = await getSheetData(ssid, `${sheetName}!A4:E18`);

        const customerId = rawData?.[0]?.[1] || '';
        const customerName = rawData?.[1]?.[1] || '';
        const note = rawData?.[2]?.[1] || '';
        const pickingDate = rawData?.[1]?.[4] || getThaiDateString();
        const shippingDate = rawData?.[2]?.[4] || pickingDate;

        const items: RollTagItem[] = [];
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
                'Content-Disposition': `inline; filename="${sheetName}.pdf"`
            }
        });

    } catch (error: any) {
        console.error('[Print RollTag] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
