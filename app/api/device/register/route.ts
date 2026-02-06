import { NextResponse } from 'next/server';
import { getSheetData, appendSheetRow, SPREADSHEET_ID, updateSheetData } from '@/lib/googleSheets';

export const dynamic = 'force-static';

export async function POST(request: Request) {
  try {
    const { token, platform } = await request.json();

    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    // 1. Check if "Devices" sheet exists/has data
    // We'll use a specific sheet for devices
    const SHEET_NAME = 'Devices';
    
    // Check if token already exists to avoid duplicates
    const rawData = await getSheetData(SPREADSHEET_ID, `'${SHEET_NAME}'!A:C`);
    
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
        await updateSheetData(SPREADSHEET_ID, `'${SHEET_NAME}'!C${rowIndex + 1}`, [[timestamp]]);
        return NextResponse.json({ success: true, status: 'updated' });
    } else {
        // Append new
        // A: Token, B: Platform, C: LastActive
        await appendSheetRow(SPREADSHEET_ID, `'${SHEET_NAME}'!A:C`, [token, platform || 'unknown', timestamp]);
        return NextResponse.json({ success: true, status: 'registered' });
    }

  } catch (error: any) {
    console.error("Device Register Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
