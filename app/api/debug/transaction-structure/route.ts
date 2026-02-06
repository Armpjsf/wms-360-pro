import { NextResponse } from 'next/server';
import { getSheetData, SPREADSHEET_ID } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/transaction-structure
 * Returns the structure of Transaction sheets (headers + sample data)
 */
export async function GET() {
    try {
        // Fetch first 5 rows from both sheets
        const [outData, inData] = await Promise.all([
            getSheetData(SPREADSHEET_ID, "'💰 Transaction จ่าย'!A1:Z5"),
            getSheetData(SPREADSHEET_ID, "'💸 Transaction รับ'!A1:Z5")
        ]);

        // Also check formulas in row 2
        const [outFormulas, inFormulas] = await Promise.all([
            getSheetFormulas(SPREADSHEET_ID, "'💰 Transaction จ่าย'!A2:Z2"),
            getSheetFormulas(SPREADSHEET_ID, "'💸 Transaction รับ'!A2:Z2")
        ]);

        return NextResponse.json({
            outbound: {
                sheetName: '💰 Transaction จ่าย',
                headers: outData?.[0] || [],
                sampleRows: outData?.slice(1, 5) || [],
                formulas: outFormulas?.[0] || []
            },
            inbound: {
                sheetName: '💸 Transaction รับ',
                headers: inData?.[0] || [],
                sampleRows: inData?.slice(1, 5) || [],
                formulas: inFormulas?.[0] || []
            }
        });

    } catch (error: any) {
        console.error('Debug sheet structure error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Helper to get formulas instead of values
async function getSheetFormulas(spreadsheetId: string, range: string) {
    try {
        const { getGoogleSheets } = await import('@/lib/googleSheets');
        const { googleSheets, auth } = await getGoogleSheets();
        
        const response = await googleSheets.spreadsheets.values.get({
            auth: auth as any,
            spreadsheetId,
            range,
            valueRenderOption: 'FORMULA'
        });
        
        return response.data.values || [];
    } catch (e) {
        console.error('Error fetching formulas:', e);
        return [];
    }
}
