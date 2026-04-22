import { NextRequest, NextResponse } from 'next/server';
import { getSheetId, getSheetPdfBlob, resolveSpreadsheetId, findSheetTitle } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    // Get params from query
    const searchParams = request.nextUrl.searchParams;
    const tagId = searchParams.get('tagId') || 'RT1';
    const branchId = searchParams.get('branchId');

    try {
        // 1. Resolve Spreadsheet for the branch
        const ssid = await resolveSpreadsheetId(branchId, 'doc');
        console.log(`[Print RollTag] Branch: ${branchId || 'HQ'}, SSID: ${ssid}, Tag: ${tagId}`);

        // 2. Map tagId to keywords and default name
        const keywords = tagId === 'RT2' ? ['Roll Tag', '2'] : ['Roll Tag', '1'];
        const defaultName = tagId === 'RT2' ? 'Roll Tag2' : 'Roll Tag1';

        // 3. Find the actual sheet title (robustly)
        const sheetName = await findSheetTitle(ssid, keywords, defaultName);
        console.log(`[Print RollTag] Resolved Sheet Name: "${sheetName}"`);

        // 4. Get GID
        const gid = await getSheetId(ssid, sheetName);
        if (gid === null) {
            return NextResponse.json({ 
                error: `Sheet "${sheetName}" not found in spreadsheet. Please check the sheet name in Google Sheets.` 
            }, { status: 404 });
        }

        // 5. Fetch PDF (A1:H20 range)
        const pdfBuffer = await getSheetPdfBlob(ssid, gid, 'A1:H20', true);

        // 6. Return as PDF Stream
        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${sheetName}.pdf"`
            }
        });

    } catch (error: any) {
        console.error('Print Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
