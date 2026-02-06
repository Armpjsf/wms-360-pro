import { NextRequest, NextResponse } from 'next/server';
import { getSheetId, getSheetPdfBlob, PO_SPREADSHEET_ID } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    // Get tagId from query params
    const searchParams = request.nextUrl.searchParams;
    const tagId = searchParams.get('tagId') || 'RT1';

    // Map tagId to sheet name
    const sheetName = tagId === 'RT2' ? 'Roll Tag2' : 'Roll Tag1';

    try {
        // 1. Get GID
        const gid = await getSheetId(PO_SPREADSHEET_ID, sheetName);
        if (gid === null) {
            return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
        }

        // 2. Fetch PDF
        const pdfBuffer = await getSheetPdfBlob(PO_SPREADSHEET_ID, gid, 'A1:H20', true);

        // 3. Return as PDF Stream
        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${sheetName}.pdf"`
            }
        });

    } catch (error: any) {
        console.error('Print Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
