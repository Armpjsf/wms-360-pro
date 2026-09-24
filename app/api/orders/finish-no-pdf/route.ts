import { NextResponse } from 'next/server';
import { 
    uploadImageToDrive, 
    updateSheetData,
    PO_SPREADSHEET_ID
} from '@/lib/googleSheets';

// Use Env Var for Folder ID
const DELIVERY_FOLDER_ID = process.env.NEXT_PUBLIC_DELIVERY_FOLDER_ID || '1QGOYQUX8eDxmzuZ6pbiXJH5iuKAZG8s3';

export async function POST(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return NextResponse.json({}, { headers: corsHeaders });
  }

  try {
    const { docNum, signature } = await req.json();

    if (!docNum || !signature) {
        return NextResponse.json({ error: 'Missing Data' }, { status: 400, headers: corsHeaders });
    }

    console.log(`[FinishNoPDF] Processing ${docNum}...`);

    // 1. Upload Signature Image to Drive (To preserve it)
    const sigName = `Sig_${docNum}_${Date.now()}.png`;
    // Note: uploadImageToDrive returns { id, webViewLink, webContentLink, thumbnailLink }
    const sigRes = await uploadImageToDrive(sigName, DELIVERY_FOLDER_ID, signature);
    const sigLink = sigRes.webContentLink; // Use Direct Download Link for easier access by PDF gen

    console.log(`[FinishNoPDF] Signature uploaded: ${sigLink}`);

    // 2. Update Signature in คลังข้อมูล (Col H = Signature / PDF Link)
    const { resolveSpreadsheetId, findAllRowIndices } = await import('@/lib/googleSheets');
    const ssid = await resolveSpreadsheetId(undefined, 'doc');
    const rowIndices = await findAllRowIndices(ssid, 'คลังข้อมูล', 0, docNum);
    if (rowIndices.length > 0) {
        await Promise.all(rowIndices.map(r => updateSheetData(ssid, `'คลังข้อมูล'!H${r}`, [[sigLink]])));
        console.log(`[FinishNoPDF] Signature saved to คลังข้อมูล Col H (${rowIndices.length} rows): ${sigLink}`);
    }

    return NextResponse.json({ success: true, sigLink }, { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("Finish-No-PDF Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
