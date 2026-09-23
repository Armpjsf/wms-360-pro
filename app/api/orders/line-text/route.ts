import { NextResponse } from 'next/server';
import { getSheetData, resolveSpreadsheetId } from '@/lib/googleSheets';
import { readArchive, rowNumbersOf } from '@/lib/orderUtils';

const FORM_SHEET = "ส่งสินค้า";

// ต้องเป็น dynamic — เดิม force-static ทำให้ได้ข้อความที่แคชไว้ตั้งแต่ตอน build
export const dynamic = 'force-dynamic';

function formatItemCode(itemStr: string): string {
    if (!itemStr) return "";
    const originalItem = itemStr.trim();
    let suffix = "";
    if (originalItem.toUpperCase().endsWith('I')) {
        suffix = " I";
    }
    
    // Logic: If len >= 8, take chars index 2-6 as part1, 6-8 as part2.
    // Python Logic: part1 = item[2:6], part2 = item[6:8]
    if (originalItem.length >= 8) {
        const part1 = originalItem.substring(2, 6);
        const part2 = originalItem.substring(6, 8);
        return `${part1} ${part2}${suffix}`;
    } else {
        return `${originalItem}${suffix}`;
    }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const docNum = searchParams.get('docNum');
    const ssid = await resolveSpreadsheetId(searchParams.get('branchId'), 'doc');

    // Read Data needed for Message
    // F6 = Customer Name
    // C10:C25 = Order Nos
    // D10:D25 = Item Codes
    // G10:G25 = Quantities

    // ?docNum= อ่านจากคลังข้อมูล (งานไหนก็ได้) / ไม่ระบุ = งานที่อยู่บนฟอร์ม
    let custNameData: any[][], ordersData: any[][], itemsData: any[][], qtyData: any[][];
    if (docNum) {
        const data = await readArchive(ssid);
        const rows = rowNumbersOf(data, docNum).map((r) => data[r - 1]);
        if (rows.length === 0) {
            return NextResponse.json({ error: `Job ${docNum} not found` }, { status: 404 });
        }
        custNameData = [[rows[0][1]]];
        ordersData = rows.map((r) => [r[3] || '']);
        itemsData = rows.map((r) => [r[4] || '']);
        qtyData = rows.map((r) => [r[5] ?? '']);
    } else {
        [custNameData, ordersData, itemsData, qtyData] = await Promise.all([
            getSheetData(ssid, `${FORM_SHEET}!F6`),
            getSheetData(ssid, `${FORM_SHEET}!C10:C25`),
            getSheetData(ssid, `${FORM_SHEET}!D10:D25`),
            getSheetData(ssid, `${FORM_SHEET}!G10:G25`)
        ]);
    }

    const customerName = custNameData?.[0]?.[0] || "Unknown";

    // Extract Unique Orders
    const uniqueOrders = new Set<string>();
    if (ordersData) {
        ordersData.forEach(row => {
            if (row[0] && row[0].trim() !== "") {
                uniqueOrders.add(row[0].trim());
            }
        });
    }
    const orderStr = Array.from(uniqueOrders).join(", ");

    // Build Item List
    let itemListText = "";
    if (itemsData && qtyData) {
        for (let i = 0; i < itemsData.length; i++) {
            const itemCode = itemsData[i]?.[0]?.trim() || "";
            let qty = 0;
            const qtyStr = qtyData[i]?.[0] || "0";
            
            // Clean qty string (remove commas)
            try {
                qty = parseInt(String(qtyStr).replace(/,/g, ''));
            } catch(e) { qty = 0; }

            if (itemCode && qty > 0) {
                const formattedItem = formatItemCode(itemCode);
                itemListText += `${formattedItem} = ${qty}\n`;
            }
        }
    }

    const finalMessage = `จัดสินค้าเรียบร้อย
เลขออเดอร์ ที่ : ${orderStr}
ชื่อร้านค้า : ${customerName}
${itemListText}
โปรดแจ้งเลขออเดอร์ทุกครั้ง เมื่อมารับสินค้าที่คลังสินค้า
ขอบคุณครับ`;

    return NextResponse.json({ text: finalMessage });

  } catch (error: any) {
    console.error("Line Text Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
