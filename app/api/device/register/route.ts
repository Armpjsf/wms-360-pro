import { NextResponse } from 'next/server';
import { getSheetData, appendSheetRow, updateSheetData } from '@/lib/googleSheets';
import { TRANSACTION_SPREADSHEET_ID } from '@/lib/transactionUtils';

// POST route ต้องเป็น dynamic (force-static ทำให้ POST ไม่ทำงานถูกต้อง)
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { token, platform } = await request.json();

    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    // เขียนลงชีต "📱 Devices" ในสเปรดชีต TRANSACTION ให้ตรงกับที่ sendFcmToDevices อ่าน
    // (เดิมเขียนลงชีต 'Devices' ในสเปรดชีต Product คนละที่ ทำให้ token ไม่ไปถึงตัวส่ง = เงียบหมด)
    const SHEET_NAME = '📱 Devices';

    // Check if token already exists to avoid duplicates
    const rawData = await getSheetData(TRANSACTION_SPREADSHEET_ID, `'${SHEET_NAME}'!A:C`);
    
    let exists = false;
    let rowIndex = -1;

    if (rawData && rawData.length > 0) {
        // Col A = Token
        rowIndex = rawData.findIndex(row => row[0] === token);
        exists = rowIndex !== -1;
    }

    const timestamp = new Date().toISOString();

    if (exists) {
        // Update timestamp (active)
        // Row is rowIndex + 1 (1-based)
        await updateSheetData(TRANSACTION_SPREADSHEET_ID, `'${SHEET_NAME}'!C${rowIndex + 1}`, [[timestamp]]);
        return NextResponse.json({ success: true, status: 'updated' });
    } else {
        // Append new
        // A: Token, B: Platform, C: LastActive
        await appendSheetRow(TRANSACTION_SPREADSHEET_ID, `'${SHEET_NAME}'!A:C`, [token, platform || 'unknown', timestamp]);
        return NextResponse.json({ success: true, status: 'registered' });
    }

  } catch (error: any) {
    console.error("Device Register Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
