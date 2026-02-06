import * as XLSX from 'xlsx';
import * as iconv from 'iconv-lite';

interface RollTagItem {
  orderNo: string;
  itemCode: string;
  quantity: number;
}

interface CustomerData {
  customerId: string;
  items: RollTagItem[];
}

export function extractRollTagData(fileBuffer: Buffer, filename: string = "unknown.xlsx"): CustomerData[] {
  const customerMap: Record<string, CustomerData> = {};
  let lastCustomerId = "";
  let lastOrderNo = "";

  try {
    let workbook: XLSX.WorkBook;
    const lowerName = filename.toLowerCase();

    if (lowerName.endsWith('.csv')) {
        // CSV Parsing with encoding fallback (Legacy Support)
        // Python legacy tried: "utf-8-sig", "utf-8", "cp874", "tis-620"
        let decodedStr = "";
        const encodings = ['utf8', 'win874', 'tis620']; // win874 matches cp874
        let success = false;

        for (const enc of encodings) {
            try {
                decodedStr = iconv.decode(fileBuffer, enc);
                // Basic validation: Check if it decodes to something readable or just try parsing
                // XLSX.read with type string works for CSV
                workbook = XLSX.read(decodedStr, { type: 'string' });
                if (workbook.SheetNames.length > 0) {
                    success = true;
                    // console.log(`Parsed CSV with encoding: ${enc}`);
                    break;
                }
            } catch (e) {
                console.log(`Failed to parse CSV with ${enc}:`, e);
            }
        }
        
        if (!success) {
            console.error("Failed to parse CSV with all attempted encodings.");
            return [];
        }
    } else {
        // Excel (XLSX, XLS)
        workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    }
    
    // Logic to find the correct sheet? Legacy looks for "โอเพ่น" or falls back to first.
    // Let's iterate sheets.
    let sheetName = workbook!.SheetNames.find(name => name.replace(/\s/g, '').startsWith("โอเพ่น"));
    if (!sheetName) {
        // Legacy Fallback: "Receiving Plan"
        sheetName = workbook!.SheetNames.find(name => name.trim() === "Receiving Plan");
    }
    if (!sheetName) sheetName = workbook!.SheetNames[0]; // Fallback
    
    const worksheet = workbook!.Sheets[sheetName];
    
    // We need to read by specific cell addresses to match H4:W20 logic strictly.
    // H is Col 7 (0-indexed). W is Col 22.
    // Row 4 is Index 3. Row 20 is Index 19.
    
    const START_ROW = 3;
    const END_ROW = 19;
    const START_COL = 7; // H
    // const END_COL = 22; // W

    const CUST_OFFSET = 2; // H + 2 = J (Index 9)
    const ORDER_OFFSET = 0; // H + 0 = H (Index 7)
    const ITEM_OFFSET = 5; // H + 5 = M (Index 12)
    const QTY_OFFSET = 15; // H + 15 = W (Index 22)

    for (let r = START_ROW; r <= END_ROW; r++) {
       // Get Cell Helper
       const getCell = (c: number) => {
          const cellAddress = XLSX.utils.encode_cell({ r, c });
          const cell = worksheet[cellAddress];
          return cell ? String(cell.v).trim() : "";
       };

       const customerId = getCell(START_COL + CUST_OFFSET);
       const orderNo = getCell(START_COL + ORDER_OFFSET);
       const itemCode = getCell(START_COL + ITEM_OFFSET);
       let qtyStr = getCell(START_COL + QTY_OFFSET);
       
       // Handle comma in numbers
       if (typeof qtyStr === 'string') qtyStr = qtyStr.replace(/,/g, '');
       const quantity = parseFloat(qtyStr);

       if (customerId) lastCustomerId = customerId;
       if (orderNo) lastOrderNo = orderNo;

       if (itemCode && !isNaN(quantity) && quantity > 0 && lastCustomerId) {
          if (!customerMap[lastCustomerId]) {
             customerMap[lastCustomerId] = {
                 customerId: lastCustomerId,
                 items: []
             };
          }
          customerMap[lastCustomerId].items.push({
              orderNo: lastOrderNo,
              itemCode,
              quantity
          });
       }
    }

    return Object.values(customerMap);

  } catch (error) {
    console.error("Error parsing Roll Tag File:", error);
    return [];
  }
}
