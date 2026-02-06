import { NextResponse } from 'next/server';
import { getSheetData, getSheetFormula, PO_SPREADSHEET_ID, SPREADSHEET_ID, getGoogleSheets } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ROLL_TAG_1 = "Roll Tag1";
const ROLL_TAG_2 = "Roll Tag2";
const FORM_SHEET = "ส่งสินค้า";

// Simple in-memory cache to prevent flickering
let lastGoodResponse: any = null;
let lastFetchTime = 0;

export async function GET() {
  try {
    console.log("[Status] Fetching Roll Tags and Data Sheet...");

    const { googleSheets } = await getGoogleSheets();

    // Helper: Fetch all sheet titles from USER Spreadsheet (Form Link Mail)
    let userSheetTitles: string[] = [];
    try {
        const meta = await googleSheets.spreadsheets.get({
            spreadsheetId: PO_SPREADSHEET_ID,
            fields: 'sheets.properties.title'
        });
        userSheetTitles = meta.data.sheets?.map((s: any) => s.properties.title) || [];
    } catch (err) {
        console.error("Failed to fetch sheet metadata (User):", err);
    }

    const findSheetName = (keywords: string[]) => {
        // 1. Exact Match
        for (const k of keywords) {
             const match = userSheetTitles.find(t => t.toLowerCase() === k.toLowerCase());
             if (match) return match;
        }
        // 2. Partial Match (All keywords must exist)
        for (const title of userSheetTitles) {
             const tLower = title.toLowerCase();
             const hasAll = keywords.every(k => tLower.includes(k.toLowerCase()));
             if (hasAll) return title;
        }
        return null;
    };

    const fetchDynamic = async (keywords: string[], range: string, defaultName: string) => {
        const resolvedName = findSheetName(keywords) || defaultName;
        // console.log(`[Status] Searching [${keywords}] -> Found: '${resolvedName}'`);
        try {
             return await getSheetData(PO_SPREADSHEET_ID, `'${resolvedName}'!${range}`);
        } catch (e) {
             console.warn(`[Status] Failed to fetch dynamic '${resolvedName}':`, e);
             return [];
        }
    };
    
    // 1. Check Pending Tasks (Roll Tags) - FROM USER SPREADSHEET
    const [rt1Data, rt2Data, formCheck] = await Promise.all([
        fetchDynamic(['Roll Tag', '1'], 'A4:F17', 'Roll Tag1'),
        fetchDynamic(['Roll Tag', '2'], 'A4:F17', 'Roll Tag2'),
        fetchDynamic(['ส่งสินค้า'], 'G3:G3', 'ส่งสินค้า')
    ]);

    const parseRollTag = (id: string, name: string, data: any[]) => {
        console.log(`[Status] Parsing ${id}:`, { dataLength: data?.length, hasData: !!data });
        
        if (!data || data.length === 0) {
            console.log(`[Status] ${id} - No data at all`);
            return null;
        }
        
        // Read customer info from first rows
        const customerId = data[0]?.[1]; // B4
        const customerName = data[1]?.[1] || ""; // B5
        console.log(`[Status] ${id} - Customer:`, { customerId, customerName });
        
        if (!customerId) {
            console.log(`[Status] ${id} - No customer ID, skipping`);
            return null;
        }

        const dateStr = new Date().toLocaleDateString('th-TH');

        // Try to find items starting from row 5 (index 5 from A4)
        // But if we have less rows, just skip
        const items = [];
        
        // Items might start at different positions depending on how many rows we got
        // Let's be flexible and scan all rows after the header
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 2) continue;
            
            const orderNo = row[0]; // Column A
            const itemCode = row[1]; // Column B  
            const qty = row[4]; // Column E
            
            // Skip if this looks like header row (has customer ID)
            if (i < 3) continue; // Skip first 3 rows (B4, B5, B6)
            
            console.log(`[Status] ${id} Row ${i}:`, { orderNo, itemCode, qty });
            
            if (itemCode && itemCode.trim() !== "") {
                items.push({ orderNo, itemCode, qty });
            }
        }

        console.log(`[Status] ${id} - Found ${items.length} items`);
        
        if (items.length === 0) {
            console.warn(`[Status] ${id} - No items found, returning null`);
            return null;
        }

        return {
            id,
            name,
            customer: customerName || customerId,
            itemCount: items.length,
            date: dateStr
        };
    };

    const pendingTasks = [];
    const rt1 = parseRollTag('RT1', ROLL_TAG_1, rt1Data);
    const rt2 = parseRollTag('RT2', ROLL_TAG_2, rt2Data);
    
    if (rt1) pendingTasks.push(rt1);
    if (rt2) pendingTasks.push(rt2);

    // 2. Check Active Form (ส่งสินค้า sheet)
    let activeForm = null;
    const docNumRaw = formCheck && formCheck[0] ? formCheck[0][0] : null;
    
    if (docNumRaw && docNumRaw.trim() !== "") {
        // Fetch full form data (Extended to H35 to include G33 Signature)
        const formFullData = await getSheetData(PO_SPREADSHEET_ID, `${FORM_SHEET}!A1:H35`);
        
        const docNum = docNumRaw;
        const custName = formFullData[5] ? formFullData[5][5] : ""; // F6
        const refDate = formFullData[3] ? formFullData[3][5] : ""; // F4
        const shippingDate = formFullData[4] ? formFullData[4][5] : ""; // F5

        // Extract Items from Rows 10-25 (Indices 9-24)
        const items = [];
        // Scan rows 9 to 24 (total 16 rows)
        for (let i = 9; i < 25; i++) {
            const row = formFullData[i];
            if (row) {
                const itemCode = row[3]; // Col D
                if (itemCode && itemCode.trim() !== "") {
                    items.push({
                        orderNo: row[2] || "", // Col C
                        itemCode: itemCode,
                        qty: row[6] || 0 // Col G
                    });
                }
            }
        }
        
        // Check for Signature in H33 (Col H = Index 7, Row 33 = Index 32)
        // We store the RAW URL in H33 because reading G33 (IMAGE formula) returns empty value.
        let signatureVal = formFullData[32] ? formFullData[32][7] : null;

        // Fallback: If H33 is empty, check if G33 has an IMAGE formula (Old logic or partial write)
        if (!signatureVal) {
             try {
                 const g33Formula = await getSheetFormula(PO_SPREADSHEET_ID, `${FORM_SHEET}!G33`);
                 if (g33Formula && g33Formula[0] && g33Formula[0][0]) {
                     const formula = g33Formula[0][0].toString();
                     // Parse =IMAGE("https://...")
                     const match = formula.match(/=IMAGE\("([^"]+)"\)/);
                     if (match && match[1]) {
                         signatureVal = match[1];
                         console.log('[Status] Recovered signature from G33 Formula:', signatureVal);
                     }
                 }
             } catch (err) {
                 console.error('Error recovering signature formula:', err);
             }
        }

        activeForm = {
            docNum,
            customer: custName,
            refDate: refDate || shippingDate || new Date().toLocaleDateString('th-TH'),
            status: "รอลูกค้า",
            items: items,
            signature: signatureVal // Include signature URL in response
        };
    }

    // 3. Get Waiting & Completed Jobs from คลังข้อมูล
    let waitingJobs: any[] = [];
    let completedJobs: any[] = []; 
    let recentPendingPdf: any[] = [];

    try {
        const dataSheetRaw = await getSheetData(PO_SPREADSHEET_ID, "'คลังข้อมูล'!A:I");
        
        if (dataSheetRaw && dataSheetRaw.length > 1) {
            const waitingMap = new Map();
            const completedMap = new Map();
            const recentMap = new Map();
            
            // Scan backwards to get latest first
            for (let i = dataSheetRaw.length - 1; i >= 1; i--) {
                const row = dataSheetRaw[i];
                if (!row || row.length < 7) continue;
                
                const docNum = row[0];
                const customer = row[1];
                const status = row[6];
                const link = row[7]; // Col H (PDF Link)
                const dateStr = row[8] || "";
                
                // Active / Waiting for Customer (Use existing logic or adjusted)
                if (status === "รอลูกค้า" && docNum) {
                    if (!waitingMap.has(docNum)) {
                        waitingMap.set(docNum, {
                            docNum,
                            customer,
                            date: dateStr,
                            orderNo: row[3] || "" // Col D matches 'lastValidOrderNo' in process/route.ts
                        });
                    }
                }
                // Pending PDF (Recent) - NEW
                else if (status === "รอ PDF" && docNum) {
                    if (!recentMap.has(docNum)) {
                         recentMap.set(docNum, {
                             orderNo: row[3] || docNum, 
                             docNum,
                             customer,
                             date: dateStr,
                             status: status,
                             item: "Items...",
                             itemCount: 1,
                             deliveryDate: dateStr
                         });
                    } else {
                         const existing = recentMap.get(docNum);
                         existing.itemCount++;
                    }
                }
                // Completed
                else if (status === "เสร็จสิ้น" && docNum) {
                    if (!completedMap.has(docNum) && completedMap.size < 5) {
                        completedMap.set(docNum, {
                            docNum,
                            customer,
                            date: dateStr,
                            pdfLink: link,
                            orderNo: row[3] || ""
                        });
                    }
                }
            }
            
            waitingJobs = Array.from(waitingMap.values());
            completedJobs = Array.from(completedMap.values());
            recentPendingPdf = Array.from(recentMap.values());
        }
    } catch (e) {
        console.error("Error fetching archive jobs:", e);
    }

    // Build response
    const response = { 
        pending: pendingTasks, 
        activeForm: activeForm,
        waiting: waitingJobs,
        completed: completedJobs,
        recent: recentPendingPdf
    };

    // Cache the response if it has meaningful data
    const hasData = pendingTasks.length > 0 || activeForm || waitingJobs.length > 0;
    
    if (hasData) {
        lastGoodResponse = response;
        lastFetchTime = Date.now();
        console.log("[Status] Returning fresh data + cached");
        return NextResponse.json(response, { headers: corsHeaders });
    } else {
        // No data in current fetch
        // If we have recent cached data (< 30 seconds old), return it instead of empty
        const cacheAge = Date.now() - lastFetchTime;
        if (lastGoodResponse && cacheAge < 30000) {
            console.log(`[Status] Returning cached data (${Math.round(cacheAge/1000)}s old) to prevent flicker`);
            return NextResponse.json(lastGoodResponse, { headers: corsHeaders });
        } else {
            console.log("[Status] No data and no recent cache - returning empty");
            return NextResponse.json(response, { headers: corsHeaders });
        }
    }

  } catch (error: any) {
    console.error("🔥 [API ERROR] /api/orders/status FAILED:", error);
    if (error?.response) {
        console.error("   -> Upstream Response:", error.response.data);
    }
    return NextResponse.json(
        { error: error.message }, 
        { status: 500, headers: corsHeaders }
    );
  }
}
