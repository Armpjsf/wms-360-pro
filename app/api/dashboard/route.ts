import { NextResponse } from 'next/server';
import { getSheetData, SPREADSHEET_ID, PRODUCT_SPREADSHEET_ID, DOC_SPREADSHEET_ID, getPOLogs, getGoogleSheets } from '@/lib/googleSheets';
import { calculateFIFOLayers } from '@/lib/fifo';

// Cache configuration
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Data Interface
interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  category: string;
  location: string;
  minQty: number;
  price: number;
  status: string;
  refillStatus: string;
  movement: string;
  image: string; // New Field
  masterStatus: string; // Added for Inactive Check
}

export async function GET(req: Request) {
  try {
    // ... (Date parsing logic remains same)
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const branchId = searchParams.get('branchId');

    // Resolve Spreadsheet IDs based on branch
    const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
    const invSSID = await resolveSpreadsheetId(branchId, 'inventory');
    const docSSID = await resolveSpreadsheetId(branchId, 'doc');
    
    // ... (Filter helpers remain same)
    const filterByDate = (row: any[], dateIdx: number) => {
        if (!startDate && !endDate) return true;
        const rowDate = row[dateIdx];
        if (!rowDate) return false;
        const d = new Date(rowDate).getTime();
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() + (86400000 - 1) : 9999999999999;
        return d >= start && d <= end;
    };
    
    // Helper: Filter PO Logs
    const filterPOByDate = (log: any) => {
        if (!startDate && !endDate) return true;
        
        // log.date assumed YYYY-MM-DD
        const d = new Date(log.date).getTime();
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() + (86400000 - 1) : 9999999999999;
        return d >= start && d <= end;
    };


    const { googleSheets } = await getGoogleSheets();
    
    console.log(`[Dashboard] Fetching Sheet Data (Branch: ${branchId || 'HQ'})...`);
    console.time('[Dashboard] Total Fetch Time');
    
    // 1. Inventory (From Branch-specific Inventory Sheet)
    const invRaw = await getSheetData(invSSID, "'📊 รายงานสินค้าคงเหลือ'!A:Z");
    
    // 2. Transactions (From Branch-specific Inventory Sheet)
    const receiveRawFullData = await getSheetData(invSSID, "'💸 Transaction รับ'!A:J");
    const issueRawFullData = await getSheetData(invSSID, "'💰 Transaction จ่าย'!A:M");
    
    // 3. Damage (From Branch-specific Inventory Sheet)
    let damageRawFull = await getSheetData(invSSID, "'Damage'!A:F");
    if (!damageRawFull || damageRawFull.length === 0) {
        damageRawFull = await getSheetData(invSSID, "'เสียหาย'!A:F");
    }
    
    // 4. PO Logs (From Branch-specific Doc Sheet)
    const poLogsFull = await getPOLogs(docSSID);
    
    // 5. Product Master (From Branch-specific Inventory Sheet)
    const productMasterRaw = await getSheetData(invSSID, "'ชื่อสินค้า'!A:E");

    console.timeEnd('[Dashboard] Total Fetch Time');
    console.time('[Dashboard] Indexing & Processing Time');

    // ---------------------------------------------------------
    // Filtering Logic (Existing)
    // ---------------------------------------------------------
    
    const receiveRawHeader = receiveRawFullData?.[0] || [];
    const receiveRawRows = receiveRawFullData?.slice(1).filter(r => filterByDate(r, 0)) || [];
    const receiveRaw = [receiveRawHeader, ...receiveRawRows];

    const issueRawHeader = issueRawFullData?.[0] || [];
    const issueRawRows = issueRawFullData?.slice(1).filter(r => filterByDate(r, 0)) || [];
    const issueRaw = [issueRawHeader, ...issueRawRows];

    const damageRawHeader = damageRawFull?.[0] || [];
    const damageRawRows = damageRawFull?.slice(1).filter(r => filterByDate(r, 0)) || [];
    const damageRaw = [damageRawHeader, ...damageRawRows];

    const poLogs = poLogsFull.filter(filterPOByDate);

    console.log(`[Dashboard] Fetched With Image Range: Inv=${invRaw?.length}`);

    // Build Price Map from Product Master
    // Map BOTH Col A (0) and Col B (1) to Price (2) to catch either Code or Name
    const priceMap = new Map<string, number>();
    productMasterRaw?.slice(1).forEach((row: any[]) => {
        const key1 = row[0]; // Potential Code/Name
        const key2 = row[1]; // Potential Name/Code
        const costPrice = parseFloat(row[2]?.replace(/,/g, '') || "0"); // Col C: Cost Price
        
        if (key1) priceMap.set(key1.trim(), costPrice);
        if (key2) priceMap.set(key2.trim(), costPrice);
    });

    // 2. Process Inventory Data (Dynamic Column Mapping)
    const invHeaders = invRaw?.[0] || [];
    
    // Helper to find column index by keywords
    const getCol = (keywords: string[]) => invHeaders.findIndex((h: any) => {
        if (typeof h !== 'string') return false;
        const val = h.toLowerCase().trim();
        return keywords.some(k => val.includes(k.toLowerCase()));
    });

    const idxName = getCol(['ชื่อสินค้า', 'product', 'item name']);
    const idxStock = getCol(['จำนวนสินค้าคงเหลือ', 'stock', 'balance', 'คงเหลือ', 'qty']);
    const idxMin = getCol(['จำนวนขั้นต่ำ', 'min', 'safety']);
    // const idxPrice = getCol(['ราคา', 'price', 'cost']); // REMOVE: No price in Inventory
    const idxCategory = getCol(['กลุ่มสินค้า', 'category', 'group']);
    const idxLocation = getCol(['location', 'ที่เก็บ', 'zone']);
    const idxUnit = getCol(['หน่วย', 'unit']);
    const idxStatus = getCol(['สถานะ', 'status']); // NEW: Status Column
    const idxMovement = getCol([
      "Movement",
      "movement",
      "Turnover",
      "turnover",
      "การเคลื่อนไหว",
      "สถานะการเคลื่อนไหว",
      "ประเภทการเคลื่อนไหวสินค้า",
    ]);
    
    // Image Logic (Already existed but integrated here)
    const idxImgLink = getCol(['ลิงค์', 'link', 'drive', 'url']);
    const idxImgNormal = getCol(['รูป', 'image', 'pic']);
    
    console.log(`[Dashboard] Inventory Columns: Name=${idxName}, Stock=${idxStock}, Movement=${idxMovement}`);

    const lastSoldMap = new Map<string, number>();
    issueRawFullData?.slice(1).forEach((row: any[]) => {
        const dateStr = row[0];
        const name = row[1];
        if (dateStr && name) {
            const ts = new Date(dateStr).getTime();
            if (!isNaN(ts)) {
               const curr = lastSoldMap.get(name) || 0;
               if (ts > curr) lastSoldMap.set(name, ts);
            }
        }
    });

    const now = Date.now();
    const DAY_MS = 1000 * 60 * 60 * 24;

    // --- OPTIMIZATION: Pre-index Full Data by Product Name for O(1) Lookup ---
    const receiveByProductMap = new Map<string, any[]>();
    receiveRawFullData?.slice(1).forEach((row: any[]) => {
        const name = row[1];
        if (name) {
            if (!receiveByProductMap.has(name)) receiveByProductMap.set(name, []);
            receiveByProductMap.get(name)!.push({
                date: row[0],
                qty: parseFloat(row[2]?.replace(/,/g, '') || "0")
            });
        }
    });

    const issueByProductMap = new Map<string, any[]>();
    issueRawFullData?.slice(1).forEach((row: any[]) => {
        const name = row[1];
        if (name) {
            if (!issueByProductMap.has(name)) issueByProductMap.set(name, []);
            issueByProductMap.get(name)!.push({
                date: row[0],
                qty: parseFloat(row[2]?.replace(/,/g, '') || "0")
            });
        }
    });
    // ------------------------------------------------------------------------

    const inventory: InventoryItem[] = invRaw?.slice(1)
       .map((row: any[]) => {
       
       // Dynamic Mapping
       const name = (idxName > -1 ? row[idxName] : row[0]) || "Unknown Item"; // Fallback to Col A
       
       // Skip empty rows
       if (!name || name === "Unknown Item") return null;

       // Use Sheet Formula for Movement (Priority)
       let computedStatus = idxMovement > -1 ? (row[idxMovement] || "").trim() : "";
       
       // Fallback: If sheet is empty, use legacy calculation (optional, or just default to Unknown)
       if (!computedStatus) {
           const lastSold = lastSoldMap.get(name);
           if (lastSold) {
              const daysDiff = Math.floor((now - lastSold) / DAY_MS);
              if (daysDiff <= 15) computedStatus = "Fast Moving";
              else if (daysDiff <= 60) computedStatus = "Normal Moving";
              else if (daysDiff <= 90) computedStatus = "Slow Moving";
              else if (daysDiff <= 180) computedStatus = "Very Slow Moving";
              else computedStatus = "Deadstock";
           } else {
              // Never sold - check first receive date
              const receives = receiveByProductMap.get(name);
              let firstReceived: number | null = null;
              if (receives && receives.length > 0) {
                  receives.forEach(r => {
                      const d = new Date(r.date).getTime();
                      if (!isNaN(d)) {
                          if (firstReceived === null || d < firstReceived) {
                              firstReceived = d;
                          }
                      }
                  });
              }

              if (firstReceived !== null) {
                  const daysDiff = Math.floor((now - firstReceived) / DAY_MS);
                  if (daysDiff <= 90) computedStatus = "Normal Moving";
                  else if (daysDiff <= 180) computedStatus = "Very Slow Moving";
                  else computedStatus = "Deadstock";
              } else {
                  // Never received and never sold
                  computedStatus = "Normal Moving";
              }
           }
       }
       
       const stock = idxStock > -1 ? parseFloat(row[idxStock]?.replace(/,/g, '') || "0") : 0;
       const minQty = idxMin > -1 ? parseFloat(row[idxMin]?.replace(/,/g, '') || "0") : 0;
       // NEW: Get Price from Map
       const price = priceMap.get(name) || 0;
       
       const category = idxCategory > -1 ? row[idxCategory] : "General";
       const location = idxLocation > -1 ? row[idxLocation] : "Zone A"; // Default if missing
       const rawStatus = idxStatus > -1 ? row[idxStatus] : "Active"; // Master Status
       
       let calculatedRefill = "OK";
       if (stock <= minQty) {
           calculatedRefill = "Low";
       }

       // Priority: Link Column > Normal Column
       const image = (idxImgLink > -1 && row[idxImgLink]) ? row[idxImgLink] : 
              ((idxImgNormal > -1 && row[idxImgNormal]) ? row[idxImgNormal] : "");

       return {
         id: `SKU-${Math.random().toString(36).substr(2, 5)}`,
         name: name,
         category: category,
         stock: stock,
         minQty: minQty,
         location: location,
         price: price,
         status: computedStatus, 
         masterStatus: rawStatus, // Added field
         refillStatus: calculatedRefill,
         movement: computedStatus, 
         image: image
       };
    }).filter(x => x !== null) as any[];
    
    // ... (Metrics calculation remains same)
    
    // 5. Calculate Top Sellers (Include Image)
    const salesMap = new Map<string, number>();
    issueRaw?.slice(1).forEach((row: any[]) => {
      const name = row[1] || "Unknown";
      const qty = parseFloat(row[2]?.replace(/,/g, '') || "0");
      salesMap.set(name, (salesMap.get(name) || 0) + qty);
    });
    
    // Helper to find image for top seller name
    const findImage = (name: string) => inventory.find(i => i.name === name)?.image || "";

    const topSellers = Array.from(salesMap.entries())
      .map(([name, qty]) => ({ name, qty, image: findImage(name) })) // Add Image
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
      
    // 3. Calculate Summary Metrics
    const totalSku = inventory.length;

    // Helper to check inactive
    const isInactive = (s: string) => {
        const v = (s || '').toLowerCase().trim();
        return v === 'inactive' || v === 'discontinued' || v === 'ยกเลิก' || v === 'เลิกผลิต';
    };

    const activeSkuCount = inventory.filter((i: any) => !isInactive(i.masterStatus)).length; // Active Only
    
    const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0);
    
    const totalValue = inventory.reduce((sum, item) => sum + (item.stock * item.price), 0);
    const lowStockCount = inventory.filter(i => i.stock <= i.minQty && !isInactive(i.masterStatus)).length;
    const deadStockCount = inventory.filter(i => i.status === 'Deadstock' && i.stock > 0 && !isInactive(i.masterStatus)).length; // Filter out inactive items & zero stock

    // 7. Calculate Empty Locations (Locations with NO Product Name)
    // defined by User: Location exists but Name is empty
    const emptyLocationList: string[] = [];
    invRaw?.slice(1).forEach((row: any[]) => {
       const loc = idxLocation > -1 ? row[idxLocation] : "";
       const name = idxName > -1 ? row[idxName] : "";
       
       if (loc && (!name || String(name).trim() === "")) {
           emptyLocationList.push(loc);
       }
    });
    const emptyLocationCount = emptyLocationList.length;

    // Helper: Normalize Date to YYYY-MM-DD
    const normalizeDate = (dateStr: any) => {
        if (!dateStr) return null;
        const str = String(dateStr).trim();
        return str.replace(/\//g, '-');
    };

    // Helper: Normalize Name (Trim)
    const normalizeName = (name: any) => String(name || '').trim();

    // Helper: Parse Number Safe
    const parseNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(String(val).replace(/,/g, '')) || 0;
    };

    // 4. Process Transactions (Period based)
    const inboundPeriod = receiveRaw?.slice(1).reduce((sum: number, row: any[]) => sum + parseNum(row[2]), 0) || 0;
    const outboundPeriod = issueRaw?.slice(1).reduce((sum: number, row: any[]) => sum + parseNum(row[2]), 0) || 0;

    // Turnover Rate for Summary
    const turnoverRate = totalStock > 0 ? (outboundPeriod / totalStock) * 100 : 0;

    // ... (Flow Logic) ...
    // 4.1 Generate Inventory Flow (Time Series)
    const flowMap = new Map<string, { inbound: number, outbound: number }>();
    const fillFlow = (rows: any[], type: 'inbound' | 'outbound') => {
        rows?.slice(1).forEach((row: any[]) => {
           const dateStr = normalizeDate(row[0]); 
           if (!dateStr) return;
           
           if (!flowMap.has(dateStr)) flowMap.set(dateStr, { inbound: 0, outbound: 0 });
           const val = parseNum(row[2]);
           if (type === 'inbound') flowMap.get(dateStr)!.inbound += val;
           else flowMap.get(dateStr)!.outbound += val;
        });
    };
    fillFlow(receiveRaw, 'inbound');
    fillFlow(issueRaw, 'outbound');

    const inventoryFlow = Array.from(flowMap.entries())
        .map(([date, val]) => ({ date, ...val }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


    // 6. Recent Activity (Merge Inbound & Outbound)
    const recentActivity = [
      ...(receiveRaw?.slice(1).map((row: any[]) => {
          if (!Array.isArray(row)) return null;
          const dateStr = normalizeDate(row[0]);
          return {
            type: 'inbound', 
            description: `Received ${row[2] || '?'} units of ${row[1] || 'Unknown'} (doc# ${row[6]||'-'})`,
            time: dateStr || 'Unknown Date',
            timestamp: dateStr ? new Date(dateStr).getTime() : 0
          };
      }).filter(x => x !== null) || []),
      ...(issueRaw?.slice(1).map((row: any[]) => {
          if (!Array.isArray(row)) return null;
          const dateStr = normalizeDate(row[0]);
          return {
            type: 'outbound', 
            description: `Dispatched ${row[2] || '?'} units of ${row[1] || 'Unknown'} (doc# ${row[6]||'-'})`,
            time: dateStr || 'Unknown Date',
            timestamp: dateStr ? new Date(dateStr).getTime() : 0
          };
      }).filter(x => x !== null) || [])
    ]
    .sort((a, b) => b.timestamp - a.timestamp) // Newest first
    .slice(0, 5);

    // 7. Sales by Category Logic
    const itemCategoryMap = new Map<string, string>();
    inventory.forEach(i => itemCategoryMap.set(normalizeName(i.name), i.category));

    const categorySalesMap = new Map<string, number>();
    issueRaw?.slice(1).forEach((row: any[]) => {
       const name = normalizeName(row[1]); // Item Name
       if (!name) return;
       
       const category = itemCategoryMap.get(name) || "Uncategorized";
       const qty = parseNum(row[2]);
       
       categorySalesMap.set(category, (categorySalesMap.get(category) || 0) + qty);
    });

    const categorySales = Array.from(categorySalesMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // 8. Waterfall Data (Inventory Flow)
    const totalDamage = damageRaw?.slice(1).reduce((sum: number, row: any[]) => sum + parseFloat(row[2] || "0"), 0) || 0;
    const closingStock = totalStock;
    const openingStock = closingStock - inboundPeriod + outboundPeriod + totalDamage;

    // Waterfall Logic: Spacer + Bar = Top Level
    const valOpen = openingStock;
    const valIn = inboundPeriod;
    const valOut = outboundPeriod;
    const valDam = totalDamage;
    const valClose = closingStock;

    // 1. Opening: Base 0, Bar = Open
    // 2. Inbound: Base = Open, Bar = In
    // 3. Outbound: Base = (Open + In - Out), Bar = Out.
    // 4. Damage: Base = (Open + In - Out - Dam), Bar = Dam.
    
    // Step 3 Base
    const outBase = (valOpen + valIn) - valOut; 
    // Step 4 Base
    const damBase = outBase - valDam;

    const waterfallData = [
      { name: 'Opening', value: 0, barValue: valOpen },
      { name: 'Inbound', value: valOpen, barValue: valIn },
      { name: 'Outbound', value: outBase, barValue: valOut }, 
      { name: 'Damage', value: damBase, barValue: valDam }, 
      { name: 'Closing', value: 0, barValue: valClose }
    ];

    // 9. Real Metrics Calculation
    
    // 9.1 OTIF (Fulfillment Speed)
    // Logic: Unique Shipments that are Completed vs Total Shipments
    const uniqueOrders = new Set(poLogs.map(l => l.orderNo));
    const completedOrders = new Set(poLogs.filter(l => l.status === 'Completed' || l.status === 'เสร็จสิ้น').map(l => l.orderNo));
    
    const otifRate = uniqueOrders.size > 0 
        ? (completedOrders.size / uniqueOrders.size) * 100 
        : 100;

    // 9.2 Quality Score (Reverse of Damage Rate)
    // Logic: (Total Outbound - Total Damage) / Total Outbound
    const totalThroughput = outboundPeriod + totalDamage; 
    const qualityScore = totalThroughput > 0 
        ? ((totalThroughput - totalDamage) / totalThroughput) * 100 
        : 100;

    // 9.3 Space Efficiency
    // Logic: Unique Locations Used / Max Capacity (Assume 200 Slots)
    const uniqueLocations = new Set(inventory.map(i => i.location)).size;
    const warehouseCapacity = 200; // Configurable constant
    const spaceEfficiency = Math.min(100, (uniqueLocations / warehouseCapacity) * 100);

    // 9.4 Accuracy (Already Real)
    const accuracyRate = outboundPeriod > 0 ? (100 - ((totalDamage / outboundPeriod) * 100)) : 100;

    // 10. Radar Data (Updated with Real Metrics)
    const radarData = [
      { metric: 'Accuracy', actual: Math.min(100, Math.max(0, accuracyRate)), target: 99 },
      { metric: 'Turnover', actual: Math.min(100, (outboundPeriod / totalStock) * 100 || 0), target: 80 }, 
      { metric: 'Space', actual: spaceEfficiency, target: 85 }, 
      { metric: 'Fulfillment', actual: otifRate, target: 98 }, 
      { metric: 'Quality', actual: qualityScore, target: 99.5 }, 
    ];


    // 10. Reorder Alerts (Include Image)
    const reorderAlerts = inventory
      .filter(i => i.stock <= i.minQty && !isInactive(i.masterStatus))
      .map(i => ({
        name: i.name,
        qty: i.stock,
        status: i.status || "Unknown",
        abc: i.category === 'FORMICA' ? 'A' : 'B', 
        category: i.category,
        image: i.image // Add Image
      }))

    // 11. FIFO Aging Analysis (OPTIMIZED)
    let agingStockCount = 0;
    const inventoryWithAging = inventory.map(item => {
        // Optimized: Use Pre-indexed Map instead of filtering full array
        const inboundLogs = receiveByProductMap.get(item.name) || [];
        
        const fifoResult = calculateFIFOLayers(item.stock, inboundLogs);
        
        if (fifoResult.maxDaysOld > 90 && item.stock > 0 && !isInactive(item.masterStatus)) {
            agingStockCount++;
        }

        return {
            ...item,
            fifo: fifoResult
        };
    });
    
    // 12. Calculate Movement Data
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const movementMapDay = new Map<string, { in: number, out: number }>();
    days.forEach(day => movementMapDay.set(day, { in: 0, out: 0 }));

    receiveRaw?.slice(1).forEach((row: any[]) => {
       const dateStr = row[0];
       if (!dateStr) return;
       const date = new Date(dateStr);
       if (!isNaN(date.getTime())) {
          const dayName = days[date.getDay()];
          const qty = parseFloat(row[2]?.replace(/,/g, '') || "0");
          const curr = movementMapDay.get(dayName)!;
          curr.in += qty;
       }
    });

    issueRaw?.slice(1).forEach((row: any[]) => {
       const dateStr = row[0];
       if (!dateStr) return;
       const date = new Date(dateStr);
       if (!isNaN(date.getTime())) {
          const dayName = days[date.getDay()];
          const qty = parseFloat(row[2]?.replace(/,/g, '') || "0");
          const curr = movementMapDay.get(dayName)!;
          curr.out += qty;
       }
    });

    const movementData = Array.from(movementMapDay.entries()).map(([name, val]) => ({
       name, 
       in: val.in, 
       out: val.out 
    }));
    

    // 13. Monthly Trend
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrendMap = new Map<string, { inbound: number, outbound: number }>();
    months.forEach(m => monthlyTrendMap.set(m, { inbound: 0, outbound: 0 }));

    const aggMonth = (rows: any[], type: 'inbound' | 'outbound') => {
         rows?.slice(1).forEach(row => {
            const dateStr = normalizeDate(row[0]);
            if (!dateStr) return;
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                const monthName = months[date.getMonth()];
                const val = parseNum(row[2]);
                if (type === 'inbound') monthlyTrendMap.get(monthName)!.inbound += val;
                else monthlyTrendMap.get(monthName)!.outbound += val;
            }
         });
    }
    // Use Full Data for Trends
    aggMonth(receiveRawFullData, 'inbound');
    aggMonth(issueRawFullData, 'outbound');

    const monthlyTrend = months.map(m => ({
        month: m,
        ...monthlyTrendMap.get(m)!
    }));


    // 14. YoY Comparison (Customizable - Inbound & Outbound)
    const currentYear = new Date().getFullYear();
    const queryYear1 = searchParams.get('year1');
    const queryYear2 = searchParams.get('year2');
    
    const year1 = queryYear1 ? parseInt(queryYear1) : currentYear;
    const year2 = queryYear2 ? parseInt(queryYear2) : currentYear - 1;
    
    const yoyMap = new Map<number, { out1: number, out2: number, in1: number, in2: number }>();
    
    // Initialize 0-11
    for (let i = 0; i < 12; i++) {
        yoyMap.set(i, { out1: 0, out2: 0, in1: 0, in2: 0 });
    }

    // Process Outbound
    issueRawFullData?.slice(1).forEach((row: any[]) => {
       const dateStr = normalizeDate(row[0]);
       if (!dateStr) return;
       const date = new Date(dateStr);
       const y = date.getFullYear();
       const m = date.getMonth();

       if (!isNaN(date.getTime())) {
           const qty = parseNum(row[2]);
           
           if (y === year1) {
               yoyMap.get(m)!.out1 += qty;
           } else if (y === year2) {
               yoyMap.get(m)!.out2 += qty;
           }
       }
    });

    // Process Inbound (New)
    receiveRawFullData?.slice(1).forEach((row: any[]) => {
       const dateStr = normalizeDate(row[0]);
       if (!dateStr) return;
       const date = new Date(dateStr);
       const y = date.getFullYear();
       const m = date.getMonth();

       if (!isNaN(date.getTime())) {
           const qty = parseNum(row[2]);
           
           if (y === year1) {
               yoyMap.get(m)!.in1 += qty;
           } else if (y === year2) {
               yoyMap.get(m)!.in2 += qty;
           }
       }
    });

    const yearlyComparison = {
        labels: { year1: year1.toString(), year2: year2.toString() },
        data: months.map((m, i) => ({
            month: m,
            outYear1: yoyMap.get(i)!.out1,
            outYear2: yoyMap.get(i)!.out2,
            inYear1: yoyMap.get(i)!.in1,
            inYear2: yoyMap.get(i)!.in2
        }))
    };

    // 15. All-Time Annual Trend (New)
    const annualMap = new Map<string, { in: number, out: number }>();
    
    // Process Outbound
    issueRawFullData?.slice(1).forEach((row: any[]) => {
       const dateStr = normalizeDate(row[0]);
       if (!dateStr) return;
       const date = new Date(dateStr);
       if (!isNaN(date.getTime())) {
           const y = date.getFullYear().toString();
           const qty = parseFloat(row[2]?.replace(/,/g, '') || "0");
           if (!annualMap.has(y)) annualMap.set(y, { in: 0, out: 0 });
           annualMap.get(y)!.out += qty;
       }
    });

    // Process Inbound
    receiveRawFullData?.slice(1).forEach((row: any[]) => {
       const dateStr = normalizeDate(row[0]);
       if (!dateStr) return;
       const date = new Date(dateStr);
       if (!isNaN(date.getTime())) {
           const y = date.getFullYear().toString();
           const qty = parseFloat(row[2]?.replace(/,/g, '') || "0");
           if (!annualMap.has(y)) annualMap.set(y, { in: 0, out: 0 });
           annualMap.get(y)!.in += qty;
       }
    });
    
    const annualTrend = Array.from(annualMap.entries())
        .map(([year, values]) => ({ year, inbound: values.in, outbound: values.out }))
        .sort((a, b) => parseInt(a.year) - parseInt(b.year));

    const resHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // 16. AI Forecasting (Brain 2.0 - OPTIMIZED)
    const { calculateBurnRate, predictStockout } = await import('@/lib/forecast');
    const ninetyDaysAgo = now - (90 * DAY_MS);

    const forecasts = inventory
        .filter(i => !isInactive(i.masterStatus)) // Basic filter for active SKUs
        .map(item => {
            // Use Pre-indexed Map
            const productIssues = issueByProductMap.get(item.name) || [];
            
            // Calculate Daily Usage (last 90 days)
            const dayMap = new Map<string, number>();
            productIssues.forEach(tx => {
                const ts = new Date(tx.date).getTime();
                if (ts >= ninetyDaysAgo) {
                    const dStr = tx.date; // already normalized or assume sheet format
                    dayMap.set(dStr, (dayMap.get(dStr) || 0) + tx.qty);
                }
            });

            const usageHistory = Array.from(dayMap.values());
            const burnRate = calculateBurnRate(usageHistory);
            const prediction = predictStockout(item.stock, burnRate);
            
            return {
                id: item.id,
                name: item.name,
                image: item.image,
                category: item.category,
                stock: item.stock,
                burnRate: burnRate,
                ...prediction
            };
        })
        .filter(f => f.risk !== 'LOW' && f.stock > 0) // Only return items with risk and in stock
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 50);

    console.timeEnd('[Dashboard] Indexing & Processing Time');

    return NextResponse.json({
      summary: {
        totalSku,
        activeSkuCount, // NEW: Active Calculation
        totalStock,
        totalValue, 
        lowStockCount,
        deadStockCount, // NEW
        agingStockCount, // NEW: FIFO Aging > 90 Days
        emptyLocationCount, // NEW: Empty Locations
        emptyLocationList, // NEW: List of Empty Locations
        inboundPeriod,
        outboundPeriod,
        throughput: inboundPeriod + outboundPeriod,
        turnoverRate // NEW
      },
      forecasts, // NEW: AI Predictions
      inventoryFlow, 
      healthData: [
        { name: 'Healthy', value: inventory.filter(i => i.refillStatus === 'OK' && !isInactive(i.masterStatus)).length },
        { name: 'Low', value: inventory.filter(i => i.refillStatus === 'Low' && !isInactive(i.masterStatus)).length },
        { name: 'Over', value: inventory.filter(i => i.refillStatus === 'Over' && !isInactive(i.masterStatus)).length }
      ],
      topSellers,
      categorySales,
      lowStock: reorderAlerts,
      recentActivity,
      movementData,
      executive: {
         waterfallData,
         radarData, 
         accuracy: accuracyRate,
         damageRate: (totalDamage / outboundPeriod) * 100 || 0,
         spaceEfficiency: spaceEfficiency,
         otif: otifRate,
         monthlyTrend,
         yearlyComparison,
         annualTrend 
      }
    }, { headers: resHeaders });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
        { error: (error as Error).message || "Internal Server Error" }, 
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
