import { NextResponse } from 'next/server';
import { getSheetData, appendSheetData, ensureSheetExists, getServiceAccountEmail, cleanSpreadsheetId } from '@/lib/googleSheets';

// Use PO Spreadsheet ID to keep requests with other PO data
const SHEET_ID = cleanSpreadsheetId(process.env.NEXT_PUBLIC_PO_SPREADSHEET_ID);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { items } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "No items provided" }, { status: 400 });
        }

        if (!SHEET_ID) {
            return NextResponse.json({ error: "Sheet ID not configured" }, { status: 500 });
        }

        // Generate Request ID
        const date = new Date();
        const idSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const reqId = `REQ-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${idSuffix}`;
        const reqDate = date.toISOString().split('T')[0];
        const requester = "Admin (AI Reorder)";
        
        // Calculate Total
        const totalAmount = items.reduce((acc: number, item: any) => acc + (item.suggestedQty * item.price), 0);
        
        // Serialize Items
        const itemsString = JSON.stringify(items.map((i: any) => ({
            id: i.id,
            name: i.name,
            qty: i.orderQty,
            price: i.price,
            total: i.orderQty * i.price
        })));

        // Data to Append
        // Columns: Request ID | Date | Requester | Items (JSON) | Total Amount | Status
        const rowData = [
            reqId,
            reqDate,
            requester,
            itemsString,
            totalAmount.toString(),
            "Pending"
        ];
        
        const SHEET_NAME = "Purchase Requests";

        // Ensure Sheet Exists
        try {
             await ensureSheetExists(SHEET_ID, SHEET_NAME, ["Request ID", "Date", "Requester", "Items", "Total Amount", "Status"]);
        } catch (createErr) {
             console.error("Failed to ensure sheet exists:", createErr);
             const email = await getServiceAccountEmail();
             // Return specific error to help user fix permissions
             return NextResponse.json({ 
                 error: `Permission Error: The system cannot create the sheet. Please grant 'Editor' access to: ${email} (Target Sheet ID: ${SHEET_ID})` 
             }, { status: 500 });
        }

        // Append to Sheet
        await appendSheetData(SHEET_ID, `${SHEET_NAME}!A:F`, [rowData]);

        return NextResponse.json({ success: true, reqId });

    } catch (error: any) {
        console.error("PO Create Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
