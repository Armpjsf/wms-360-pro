import { NextResponse } from 'next/server';
import { 
    getSheetData,
    updateSheetData, 
    findAllRowIndices,
    PO_SPREADSHEET_ID 
} from '@/lib/googleSheets';
import { archiveCurrentForm } from '@/lib/orderUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ACTIVE_FORM_SHEET = "ส่งสินค้า";
const ARCHIVE_SHEET = "คลังข้อมูล";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
  try {
      const { docNum } = await request.json();
      if (!docNum) return NextResponse.json({ error: "Missing DocNum" }, { status: 400, headers: corsHeaders });

      // 1. Check if Form is Busy
      const formCheck = await getSheetData(PO_SPREADSHEET_ID, `${ACTIVE_FORM_SHEET}!G3:G3`);
      if (formCheck && formCheck[0] && formCheck[0][0]) {
           // Auto-Archive current job first
           await archiveCurrentForm();
      }

      // 2. Find Waiting Job Data
      console.log(`[Recall] Searching for DocNum: ${docNum} in ${ARCHIVE_SHEET}`);
      const rows = await findAllRowIndices(PO_SPREADSHEET_ID, ARCHIVE_SHEET, 0, docNum);
      console.log(`[Recall] Found rows: ${rows.length}`);
      
      if (rows.length === 0) {
          return NextResponse.json({ error: `Job ${docNum} not found in archive` }, { status: 404, headers: corsHeaders });
      }

      // 3. Read Data from Archive Rows
      const archiveData = [];
      for (const r of rows) {
          const rowVals = await getSheetData(PO_SPREADSHEET_ID, `${ARCHIVE_SHEET}!A${r}:I${r}`);
          if (rowVals && rowVals[0]) {
              archiveData.push(rowVals[0]);
          }
      }
      console.log(`[Recall] Read ${archiveData.length} lines of data`);

      if (archiveData.length === 0) return NextResponse.json({ error: "Failed to read archive data" }, { status: 500, headers: corsHeaders });

      // 4. Populate Form
      // Header: DocNum(A), CustName(B), Date(I or Today)
      const firstRow = archiveData[0];
      const custName = firstRow[1];
      const potentialSigLink = firstRow[7]; // Col H (PDF Link or Signature Link)
      const today = new Date().toLocaleDateString('th-TH');
      
      // Update Header
      const updates = [
        updateSheetData(PO_SPREADSHEET_ID, `${ACTIVE_FORM_SHEET}!G3`, [[docNum]]),
        updateSheetData(PO_SPREADSHEET_ID, `${ACTIVE_FORM_SHEET}!F4`, [[today]]),
        updateSheetData(PO_SPREADSHEET_ID, `${ACTIVE_FORM_SHEET}!F5`, [[today]]),
        updateSheetData(PO_SPREADSHEET_ID, `${ACTIVE_FORM_SHEET}!F6`, [[custName]])
      ];
      
      // RESTORE SIGNATURE if available (Assume anything with http in Col H is relevant)
      if (potentialSigLink && potentialSigLink.startsWith('http')) {
           // We write it as an IMAGE formula so the sheet displays it (and our status API picks it up in G33)
           updates.push(
               updateSheetData(PO_SPREADSHEET_ID, `${ACTIVE_FORM_SHEET}!G33`, [[`=IMAGE("${potentialSigLink}")`]])
           );
      }

      await Promise.all(updates);

      // Update Body
      const formSequences = [];
      const formOrders = [];
      const formItems = [];
      const formQty = [];
      
      let lastOrder = "";
      let groupSeq = 0;

      // Fill 9 rows max
      for (let i = 0; i < 9; i++) {
          if (i < archiveData.length) {
              const row = archiveData[i];
              // Archive: [DocNum(0), CustName(1), Seq(2), OrderNo(3), Item(4), Qty(5), ...]
              const orderNo = row[3];
              const itemCode = row[4];
              const qty = row[5];
              
              let displaySeq: any = "";
              let displayOrder = "";
              
              if (orderNo !== lastOrder) {
                  lastOrder = orderNo;
                  groupSeq++;
                  displaySeq = groupSeq;
                  displayOrder = orderNo;
              } else if (orderNo === "") {
                  // No order num
              } else {
                  // Same order
                  displaySeq = "";
                  displayOrder = "";
              }

              formSequences.push([displaySeq]);
              formOrders.push([displayOrder]);
              formItems.push([itemCode]);
              formQty.push([qty]);
          } else {
               formSequences.push([""]);
               formOrders.push([""]);
               formItems.push([""]);
               formQty.push([""]);
          }
      }

    await Promise.all([
        updateSheetData(PO_SPREADSHEET_ID, `${ACTIVE_FORM_SHEET}!B10:B18`, formSequences),
        updateSheetData(PO_SPREADSHEET_ID, `${ACTIVE_FORM_SHEET}!C10:C18`, formOrders),
        updateSheetData(PO_SPREADSHEET_ID, `${ACTIVE_FORM_SHEET}!D10:D18`, formItems),
        updateSheetData(PO_SPREADSHEET_ID, `${ACTIVE_FORM_SHEET}!G10:G18`, formQty)
    ]);

    return NextResponse.json({ success: true }, { headers: corsHeaders });

  } catch (error: any) {
    console.error("Recall Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}
