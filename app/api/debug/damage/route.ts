import { NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/oauthClient';
import { google } from 'googleapis';
import { SPREADSHEET_ID } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await getOAuth2Client();
    if (!auth) {
        throw new Error("Failed to authenticate with Google");
    }
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Get Spreadsheet Metadata (Sheet Names)
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetNames = meta.data.sheets?.map(s => s.properties?.title) || [];
    
    // 2. Try to find "Damage" or "เสียหาย"
    const damageSheet = sheetNames.find(s => s?.toLowerCase().includes('damage') || s?.includes('เสียหาย'));
    
    let sampleData: any[][] = [];
    if (damageSheet) {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${damageSheet}'!A1:Z10`,
        });
        sampleData = response.data.values || [];
    }

    return NextResponse.json({
      allSheets: sheetNames,
      foundSheet: damageSheet,
      headers: sampleData[0] || [],
      firstRow: sampleData[1] || []
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
