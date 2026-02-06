import { NextResponse } from 'next/server';
import { appendSheetData, getSheetData, SPREADSHEET_ID } from '@/lib/googleSheets';
import { TRANSACTION_SPREADSHEET_ID } from '@/lib/transactionUtils';

// We'll store tokens in the Transaction Spreadsheet for convenience, or Main?
// Let's use TRANSACTION_SPREADSHEET_ID as it seems to be the active one.
const SHEET_ID = TRANSACTION_SPREADSHEET_ID; 
const SHEET_NAME = '📱 Devices';

export async function POST(req: Request) {
    try {
        const { token } = await req.json();
        if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

        console.log(`[PushRegister] Received token: ${token.substring(0, 10)}...`);

        // Check if token already exists
        const existingData = await getSheetData(SHEET_ID, `${SHEET_NAME}!A:A`);
        const exists = existingData?.some((row: any[]) => row[0] === token);

        if (exists) {
            console.log('[PushRegister] Token already exists.');
            return NextResponse.json({ success: true, message: 'Already registered' });
        }

        // Add new token
        // Schema: [Token, Date]
        const today = new Date().toISOString();
        await appendSheetData(SHEET_ID, `${SHEET_NAME}!A:B`, [[token, today]]);

        return NextResponse.json({ success: true, message: 'Token registered' });
    } catch (error: any) {
        console.error('[PushRegister] Error:', error);
        // If sheet doesn't exist, we might fail. 
        // User needs to create "📱 Devices" sheet manually? 
        // Or we can try to append hoping it creates? No, Google Sheets API errors usually.
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
