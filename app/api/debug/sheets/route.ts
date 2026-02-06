import { NextResponse } from 'next/server';
import { getGoogleSheets, SPREADSHEET_ID } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { googleSheets, auth } = await getGoogleSheets();
    
    // 1. Get Spreadsheet Metadata (Sheet Names)
    const meta = await googleSheets.spreadsheets.get({
        auth: auth as any,
        spreadsheetId: SPREADSHEET_ID,
    });

    const sheets = meta.data.sheets?.map(s => s.properties?.title) || [];

    // 2. Test Read 'Users' (Proven to work)
    const usersTest = await googleSheets.spreadsheets.values.get({
        auth: auth as any,
        spreadsheetId: SPREADSHEET_ID,
        range: "'Users'!A1:B5"
    });

    return NextResponse.json({
        status: 'OK',
        spreadsheetId: SPREADSHEET_ID,
        sheetCount: sheets.length,
        sheetNames: sheets, // THIS IS KEY
        testReadUsers: usersTest.data.values ? 'Success' : 'Empty',
        env: {
            hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY
        }
    });

  } catch (error) {
    return NextResponse.json({
        status: 'ERROR',
        message: (error as Error).message,
        stack: (error as Error).stack
    }, { status: 500 });
  }
}
