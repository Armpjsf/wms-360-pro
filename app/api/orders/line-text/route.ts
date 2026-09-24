import { NextResponse } from 'next/server';
import { resolveSpreadsheetId } from '@/lib/googleSheets';
import { getActiveJobDocNum, readArchive, rowNumbersOf } from '@/lib/orderUtils';

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
    const rawDoc = searchParams.get('docNum');
    const ssid = await resolveSpreadsheetId(searchParams.get('branchId'), 'doc');

    const docNum = rawDoc || (await getActiveJobDocNum(ssid));
    if (!docNum) {
        return NextResponse.json({ error: "No active job found" }, { status: 404 });
    }

    const data = await readArchive(ssid);
    const rows = rowNumbersOf(data, docNum).map((r) => data[r - 1]);
    if (rows.length === 0) {
        return NextResponse.json({ error: `Job ${docNum} not found` }, { status: 404 });
    }

    const customerName = rows[0][1] || "Unknown";
    const ordersData = rows.map((r) => [r[3] || '']);
    const itemsData = rows.map((r) => [r[4] || '']);
    const qtyData = rows.map((r) => [r[5] ?? '']);

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
