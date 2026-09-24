import { NextResponse } from 'next/server';
import { getSheetData, getSheetFormula, PO_SPREADSHEET_ID, SPREADSHEET_ID, getGoogleSheets } from '@/lib/googleSheets';
import { getThaiDateString } from '@/lib/dateUtils';

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

// Short in-memory cache (per spreadsheet/branch) for rapid double-clicks / page transitions.
// ห้ามใช้ตัวแปรเดียวรวมทุกสาขา และห้ามคืนข้อมูลเก่าแทนผลว่าง — ทำให้หน้าจอค้างงานที่ปิดไปแล้ว
const STATUS_CACHE_MS = 4000;
const statusCache = new Map<string, { response: any; time: number }>();

// Global Sheet Titles Cache to avoid redundant slow Sheets API calls (1 hour TTL)
const sheetTitlesCache = new Map<string, { titles: string[], timestamp: number }>();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');
    const bypassCache = searchParams.get('noCache') === '1' || searchParams.get('automation') === '1';

    // Resolver for Multi-Branch Isolation
    const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
    const ssid = await resolveSpreadsheetId(branchId, 'doc');

    // 0. High Performance: Intercept with a 4-second in-memory cache to solve rapid double-clicks or mobile page transition latency
    const cached = statusCache.get(ssid);
    if (!bypassCache && cached && Date.now() - cached.time < STATUS_CACHE_MS) {
        return NextResponse.json(cached.response, { headers: corsHeaders });
    }

    console.log(`[Status] Fetching Roll Tags and Data Sheet for Branch: ${branchId || 'HQ'} (SSID: ${ssid})...`);

    // Perf: เริ่มอ่าน "คลังข้อมูล" (A:I) แบบขนานตั้งแต่ตอนนี้ ไม่รอให้ Roll Tags/ฟอร์มเสร็จก่อน
    // เดิมอ่านแบบ serial ต่อท้าย ทำให้เป็นอีก 1 round-trip บน critical path -> การ์ด "รอดำเนินการ" ขึ้นช้า
    const archivePromise: Promise<any[][]> = getSheetData(ssid, "'คลังข้อมูล'!A:I")
      .catch((e) => { console.error("Error fetching archive jobs:", e); return []; });

    const { googleSheets } = await getGoogleSheets();

    // Helper: Fetch all sheet titles from USER Spreadsheet (Form Link Mail) - Optimized Cache-First
    let userSheetTitles: string[] = [];
    const cachedInfo = sheetTitlesCache.get(ssid);
    if (cachedInfo && (Date.now() - cachedInfo.timestamp < 3600000)) { // 1 hour
        userSheetTitles = cachedInfo.titles;
        console.log(`[Status API] Sheet titles cache hit for SSID: ${ssid}`);
    } else {
        try {
            console.log(`[Status API] Sheet titles cache miss. Querying Sheets API for SSID: ${ssid}`);
            const meta = await googleSheets.spreadsheets.get({
                spreadsheetId: ssid,
                fields: 'sheets.properties.title'
            });
            userSheetTitles = meta.data.sheets?.map((s: any) => s.properties.title) || [];
            sheetTitlesCache.set(ssid, { titles: userSheetTitles, timestamp: Date.now() });
        } catch (err) {
            console.error("Failed to fetch sheet metadata (User):", err);
        }
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
        try {
             return await getSheetData(ssid, `'${resolvedName}'!${range}`);
        } catch (e) {
             console.warn(`[Status] Failed to fetch dynamic '${resolvedName}':`, e);
             return [];
        }
    };
    
    // 1. Check Pending Tasks (Roll Tags) - FROM BRANCH SPREADSHEET
    // Find all sheets that start with "Roll Tag" (case-insensitive, optionally with space, followed by digits)
    const rollTagSheets = userSheetTitles
      .filter(title => /^Roll\s*Tag\s*(\d+)$/i.test(title))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/^Roll\s*Tag\s*(\d+)$/i)?.[1] || "0", 10);
        const bNum = parseInt(b.match(/^Roll\s*Tag\s*(\d+)$/i)?.[1] || "0", 10);
        return aNum - bNum;
      });

    // Only query sheets if they actually exist in userSheetTitles
    const sheetsToQuery = rollTagSheets;

    const fetchPromises = sheetsToQuery.map(sheetName => {
        const match = sheetName.match(/^Roll\s*Tag\s*(\d+)$/i);
        const num = match ? match[1] : "1";
        return fetchDynamic(['Roll Tag', num], 'A4:F17', sheetName);
    });

    const [rollTagDataList, formCheck] = await Promise.all([
        Promise.all(fetchPromises),
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

        const dateStr = getThaiDateString();

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

    let pendingTasks: any[] = [];
    for (let i = 0; i < sheetsToQuery.length; i++) {
        const sheetName = sheetsToQuery[i];
        const match = sheetName.match(/^Roll\s*Tag\s*(\d+)$/i);
        const num = match ? match[1] : (i + 1).toString();
        const id = `RT${num}`;
        const data = rollTagDataList[i] || [];
        const parsed = parseRollTag(id, sheetName, data);
        if (parsed) {
            pendingTasks.push(parsed);
        }
    }

    // 2. Check Active Form (ส่งสินค้า sheet)
    let activeForm: any = null;
    const docNumRaw = formCheck && formCheck[0] ? formCheck[0][0] : null;
    
    if (docNumRaw && docNumRaw.trim() !== "") {
        // Fetch full form data (Extended to H35 to include G33 Signature)
        const formFullData = await getSheetData(ssid, `${FORM_SHEET}!A1:H35`);
        
        const docNum = docNumRaw;
        const custName = (formFullData && formFullData[5]) ? formFullData[5][5] : ""; // F6
        const refDate = (formFullData && formFullData[3]) ? formFullData[3][5] : ""; // F4
        const shippingDate = (formFullData && formFullData[4]) ? formFullData[4][5] : ""; // F5

        // Extract Items from Rows 10-25 (Indices 9-24)
        const items = [];
        // Scan rows 9 to 24 (total 16 rows)
        if (formFullData) {
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
        }
        
        // Check for Signature in H33 (Col H = Index 7, Row 33 = Index 32)
        // We store the RAW URL in H33 because reading G33 (IMAGE formula) returns empty value.
        let signatureVal = (formFullData && formFullData[32]) ? formFullData[32][7] : null;

        // Fallback: If H33 is empty, check if G33 has an IMAGE formula (Old logic or partial write)
        if (!signatureVal) {
             try {
                 const g33Formula = await getSheetFormula(ssid, `${FORM_SHEET}!G33`);
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
            refDate: refDate || shippingDate || getThaiDateString(),
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
        const dataSheetRaw = await archivePromise; // เริ่มยิงไปแล้วด้านบนแบบขนาน

        if (dataSheetRaw && dataSheetRaw.length > 1) {
            const waitingMap = new Map<string, any>();
            const completedMap = new Map();
            const recentMap = new Map();
            const pendingArchiveMap = new Map<string, any>();
            
            // Scan backwards to get latest first
            for (let i = dataSheetRaw.length - 1; i >= 1; i--) {
                const row = dataSheetRaw[i];
                if (!row || row.length < 7) continue;
                
                const docNum = String(row[0] || "").trim();
                const customer = row[1];
                const status = String(row[6] || "").trim();
                const link = row[7]; // Col H (PDF Link)
                const dateStr = row[8] || "";
                
                // Pending Roll Tag จากอีเมล/นำเข้า (อยู่ในคลังข้อมูลโดยตรง ไม่ต้องมีแท็บชีต)
                if ((status === "รอจัด RollTag" || status === "RollTag") && docNum) {
                    let task = pendingArchiveMap.get(docNum);
                    if (!task) {
                        const num = docNum.replace(/^RT/i, "");
                        task = {
                            id: docNum,
                            name: `Roll Tag ${num}`,
                            customer: customer || docNum,
                            itemCount: 0,
                            date: dateStr || getThaiDateString(),
                            items: [] as any[],
                        };
                        pendingArchiveMap.set(docNum, task);
                    }
                    task.itemCount++;
                    task.items.push({
                        seq: Number(row[2]) || 0,
                        orderNo: row[3] || "",
                        itemCode: row[4] || "",
                        qty: row[5] ?? ""
                    });
                }
                // งานที่ยังไม่ปิด: กำลังดำเนินการ / รอลูกค้า / กำลังแก้ไข (สถานะเก่าจาก recall —
                // เดิมไม่แสดงที่ไหนเลย งานจึง "หาย" จากทั้งแอดมินและพนักงาน)
                else if ((status === "กำลังดำเนินการ" || status === "รอลูกค้า" || status === "กำลังแก้ไข") && docNum) {
                    let job = waitingMap.get(docNum);
                    if (!job) {
                        job = {
                            docNum,
                            customer,
                            date: dateStr,
                            orderNo: "",
                            orderNos: [] as string[],
                            // "รอลูกค้า" = จัดสินค้าเสร็จแล้ว, อื่นๆ = ยังจัดอยู่
                            status: status === "รอลูกค้า" ? "รอลูกค้า" : "กำลังดำเนินการ",
                            items: [] as any[],
                        };
                        waitingMap.set(docNum, job);
                    }
                    job.items.push({ seq: Number(row[2]) || 0, orderNo: row[3] || "", itemCode: row[4] || "", qty: row[5] ?? "" });
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
            
            // Merge Pending Tasks: รวมงานจาก คลังข้อมูล และ Legacy Sheets
            const archivePending = Array.from(pendingArchiveMap.values());
            const legacyPending = pendingTasks.filter(pt => !pendingArchiveMap.has(pt.id));
            pendingTasks = [...archivePending, ...legacyPending].sort((a, b) => {
                const aNum = parseInt(a.id.replace(/^RT/i, "") || "0", 10);
                const bNum = parseInt(b.id.replace(/^RT/i, "") || "0", 10);
                return aNum - bNum;
            });

            // Fallback: If no activeForm from sheet (e.g. ส่งสินค้า is empty or deleted),
            // promote the first open job from คลังข้อมูล to be activeForm
            if (!activeForm && waitingMap.size > 0) {
                const firstJob = Array.from(waitingMap.values())[0];
                activeForm = {
                    docNum: firstJob.docNum,
                    customer: firstJob.customer,
                    refDate: firstJob.date || getThaiDateString(),
                    status: firstJob.status,
                    items: firstJob.items.map((it: any) => ({
                        orderNo: it.orderNo,
                        itemCode: it.itemCode,
                        qty: it.qty
                    })),
                    signature: null
                };
            }

            const activeDoc = activeForm ? String(activeForm.docNum).trim() : "";
            for (const job of waitingMap.values()) {
                job.items.sort((a: any, b: any) => a.seq - b.seq);
                job.orderNos = Array.from(new Set(job.items.map((i: any) => String(i.orderNo).trim()).filter(Boolean)));
                job.orderNo = job.orderNos.join(', ');
                if (activeForm && job.docNum === activeDoc) {
                    // งานที่อยู่บนฟอร์ม แสดงในการ์ด "กำลังทำ" อย่างเดียว ไม่ซ้ำในคิว
                    activeForm.archiveStatus = job.status;
                    activeForm.status = job.status; // เดิม hardcode "รอลูกค้า" ทำให้ดูเหมือนจัดเสร็จแล้วทุกงาน
                }
            }
            waitingJobs = Array.from(waitingMap.values()).filter((j) => j.docNum !== activeDoc);
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

    if (!bypassCache) {
        statusCache.set(ssid, { response, time: Date.now() });
    }
    return NextResponse.json(response, { headers: corsHeaders });

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

// Vercel: allow up to 60s (Hobby max) — this route does Sheets-heavy work.
export const maxDuration = 60;
