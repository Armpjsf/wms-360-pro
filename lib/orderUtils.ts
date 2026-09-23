import {
    getSheetData,
    updateSheetData,
    clearSheetRange,
    appendSheetData,
    batchUpdateSheetData,
    batchClearSheetRanges,
    deleteSheetRows,
    PO_SPREADSHEET_ID
} from '@/lib/googleSheets';
import { getThaiDateString } from '@/lib/dateUtils';

export const FORM_SHEET = "ส่งสินค้า";
export const DATA_SHEET = "คลังข้อมูล";
const FORM_FIRST_ROW = 10;
const FORM_MAX_ROWS = 16; // B10:G25

// สถานะในคอลัมน์ G ของ คลังข้อมูล
export const STATUS_IN_PROGRESS = "กำลังดำเนินการ"; // แอดมินกดจัดการงานแล้ว รอพนักงานหยิบ
export const STATUS_PREPARED = "รอลูกค้า";          // พนักงานจัดสินค้าเสร็จ รอลูกค้ามารับ/เซ็น
export const STATUS_DONE = "เสร็จสิ้น";              // เซ็นรับแล้ว มี PDF
export const STATUS_LEGACY_EDITING = "กำลังแก้ไข";  // สถานะเก่าจากการ recall — ไม่เขียนใหม่แล้ว

// คลังข้อมูล: [DocNum(A), CustName(B), Seq(C), OrderNo(D), Item(E), Qty(F), Status(G), Link(H), Date(I)]
export type ArchiveRow = any[];

/** สถานะของงานที่ยังไม่ปิด — "กำลังแก้ไข" (เก่า) และค่าว่าง ถือเป็นกำลังดำเนินการ */
export function normalizeOpenStatus(status: any): string {
    const s = String(status || "").trim();
    if (!s || s === STATUS_LEGACY_EDITING) return STATUS_IN_PROGRESS;
    return s;
}

// ============================================================================
// Form lock — ชีต ส่งสินค้า มีงานได้ทีละ 1 ใบ ทุก route ที่เขียนฟอร์มหรือสถานะ
// ต้องผ่าน lock นี้ ไม่งั้นคอมกับมือถือกดพร้อมกันแล้วข้อมูลในฟอร์มปนกัน
// ============================================================================

const LOCK_CELL = `${FORM_SHEET}!Z1`;
const LOCK_TTL_MS = 60000; // lock ที่เก่ากว่านี้ถือว่า process ตายไปแล้ว
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FormBusyError extends Error {
    status = 409;
    constructor() {
        super('ระบบกำลังบันทึกงานอื่นอยู่ กรุณารอสักครู่แล้วลองใหม่');
    }
}

export async function withFormLock<T>(ssid: string, fn: () => Promise<T>, waitMs = 15000): Promise<T> {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const deadline = Date.now() + waitMs;
    const readLock = async () => String((await getSheetData(ssid, LOCK_CELL))?.[0]?.[0] || "");

    while (true) {
        const held = await readLock();
        const heldTs = parseInt(held.split('-')[0], 10);
        const free = !held || isNaN(heldTs) || Date.now() - heldTs > LOCK_TTL_MS;
        if (free) {
            await updateSheetData(ssid, LOCK_CELL, [[token]]);
            await sleep(250); // ให้คนที่เขียนพร้อมกันเขียนทับให้เสร็จก่อนอ่านยืนยัน
            if ((await readLock()) === token) break;
        }
        if (Date.now() > deadline) throw new FormBusyError();
        await sleep(600 + Math.random() * 500);
    }

    try {
        return await fn();
    } finally {
        try {
            if ((await readLock()) === token) await clearSheetRange(ssid, LOCK_CELL);
        } catch { /* ignore release errors */ }
    }
}

// ============================================================================
// คลังข้อมูล helpers
// ============================================================================

export async function readArchive(ssid: string): Promise<ArchiveRow[]> {
    return (await getSheetData(ssid, `'${DATA_SHEET}'!A:I`)) || [];
}

/** เลขแถว (1-based) ของทุกแถวที่เป็นของ docNum */
export function rowNumbersOf(data: ArchiveRow[], docNum: string): number[] {
    const target = String(docNum).trim();
    const out: number[] = [];
    for (let i = 1; i < data.length; i++) {
        if (String(data[i]?.[0] ?? "").trim() === target) out.push(i + 1);
    }
    return out;
}

/**
 * เปลี่ยนสถานะของงานในคลังข้อมูล "ในแถวเดิม" (ไม่ append+ลบ)
 * งานที่เสร็จสิ้นแล้วจะไม่ถูกย้อนสถานะ
 */
export async function setDocsStatus(ssid: string, docNums: string[], status: string) {
    const data = await readArchive(ssid);
    const updated: string[] = [];
    const notFound: string[] = [];
    const skipped: string[] = [];
    const updates: { range: string; values: any[][] }[] = [];

    for (const docNum of docNums) {
        const rows = rowNumbersOf(data, docNum);
        if (rows.length === 0) { notFound.push(docNum); continue; }
        const open = rows.filter((r) => String(data[r - 1]?.[6] || "").trim() !== STATUS_DONE);
        if (open.length === 0) { skipped.push(docNum); continue; }
        open.forEach((r) => updates.push({ range: `'${DATA_SHEET}'!G${r}`, values: [[status]] }));
        updated.push(docNum);
    }

    await batchUpdateSheetData(ssid, updates);
    return { updated, notFound, skipped };
}

/**
 * เขียนแถวของงานกลับลงคลังข้อมูลโดยใช้แถวเดิมก่อน ถ้ามีแถวเพิ่มจะแทรกท้ายชีต
 * ถ้าแถวลดลงจะลบแถวที่เกินทิ้งจริง — ไม่ทิ้งแถวว่างคั่นไว้
 */
async function writeDocRows(ssid: string, newRows: ArchiveRow[], existingRows: number[]) {
    const reuse = Math.min(newRows.length, existingRows.length);
    await batchUpdateSheetData(
        ssid,
        existingRows.slice(0, reuse).map((r, i) => ({
            range: `'${DATA_SHEET}'!A${r}:I${r}`,
            values: [newRows[i]],
        }))
    );
    if (newRows.length > reuse) {
        await appendSheetData(ssid, `'${DATA_SHEET}'!A:I`, newRows.slice(reuse), 'INSERT_ROWS');
    }
    if (existingRows.length > reuse) {
        await deleteSheetRows(ssid, DATA_SHEET, existingRows.slice(reuse));
    }
}

// ============================================================================
// Active form (ชีต ส่งสินค้า)
// ============================================================================

/**
 * เอางานที่อยู่บนฟอร์มออกไปเก็บในคลังข้อมูล แล้วล้างฟอร์ม
 * - customStatus ไม่ระบุ = คงสถานะเดิมของงานไว้ (เดิมใส่ "รอลูกค้า" ทำให้งานที่ยังไม่ได้หยิบ
 *   กลายเป็น "จัดเสร็จ" ทันทีที่แอดมินกดจัดการงานถัดไป)
 * - ต้องเรียกภายใน withFormLock
 */
export async function archiveCurrentForm(customStatus?: string, signatureLink?: string, spreadsheetId?: string) {
    const ssid = spreadsheetId || PO_SPREADSHEET_ID;
    const [dNum, cName, oData, iData, qData, sigData] = await Promise.all([
        getSheetData(ssid, `${FORM_SHEET}!G3`),
        getSheetData(ssid, `${FORM_SHEET}!F6`),
        getSheetData(ssid, `${FORM_SHEET}!C10:C25`),
        getSheetData(ssid, `${FORM_SHEET}!D10:D25`),
        getSheetData(ssid, `${FORM_SHEET}!G10:G25`),
        getSheetData(ssid, `${FORM_SHEET}!H33`)
    ]);

    const docNum = String(dNum?.[0]?.[0] || "").trim();
    if (!docNum) {
        return { success: false, error: 'No active job found' };
    }

    const data = await readArchive(ssid);
    const existingRows = rowNumbersOf(data, docNum);
    const oldRow = existingRows.length > 0 ? data[existingRows[0] - 1] : null;

    const custName = cName?.[0]?.[0] || oldRow?.[1] || "Unknown";
    const status = customStatus || normalizeOpenStatus(oldRow?.[6]);
    const link = signatureLink || sigData?.[0]?.[0] || oldRow?.[7] || "";
    const date = oldRow?.[8] || getThaiDateString();

    // ฟอร์มใส่เลข order เฉพาะแถวแรกของแต่ละกลุ่ม -> ต้องพาเลข order ต่อลงแถวถัดไปด้วย
    // (เดิมไม่ได้พาต่อ ทำให้รายการที่ 2+ ของแต่ละ order หลุดเลข order ในคลังข้อมูล)
    const newRows: ArchiveRow[] = [];
    let lastOrderNo = "";
    for (let i = 0; i < (iData?.length || 0); i++) {
        const orderNo = String(oData?.[i]?.[0] || "").trim();
        if (orderNo) lastOrderNo = orderNo;
        const itemCode = String(iData?.[i]?.[0] || "").trim();
        if (!itemCode) continue;
        newRows.push([
            docNum, custName, newRows.length + 1,
            lastOrderNo, itemCode, qData?.[i]?.[0] ?? "",
            status, link, date
        ]);
    }

    if (newRows.length > 0) {
        await writeDocRows(ssid, newRows, existingRows);
    } else if (existingRows.length > 0 && customStatus) {
        // ฟอร์มไม่มีรายการ แต่ยังต้องอัปเดตสถานะของงานเดิม
        await setDocsStatus(ssid, [docNum], customStatus);
    } else {
        console.warn(`[Archive] No items found to save for ${docNum}. Keeping archive rows as-is.`);
    }

    await clearFormSheet(ssid);
    return { success: true, docNum };
}

export async function clearFormSheet(spreadsheetId?: string) {
    const ssid = spreadsheetId || PO_SPREADSHEET_ID;
    await batchClearSheetRanges(ssid, [
        `${FORM_SHEET}!G3`,
        `${FORM_SHEET}!F4:F5`,
        `${FORM_SHEET}!D6`,
        `${FORM_SHEET}!F6`,
        `${FORM_SHEET}!B10:D25`,
        `${FORM_SHEET}!G10:G25`,
        `${FORM_SHEET}!G33:H33`, // ลายเซ็นของงานก่อนหน้า ต้องไม่ติดไปงานถัดไป
    ]);
    return { success: true };
}

/**
 * ดึงงานจากคลังข้อมูลขึ้นฟอร์ม (งานที่อยู่บนฟอร์มเดิมจะถูกเก็บกลับโดยคงสถานะไว้)
 * ไม่เปลี่ยนสถานะของงาน — เดิมตั้งเป็น "กำลังแก้ไข" ซึ่งไม่มีหน้าไหนแสดง ทำให้งานหาย
 * ต้องเรียกภายใน withFormLock
 */
export async function restoreOrderToForm(docNum: string, spreadsheetId?: string) {
    const ssid = spreadsheetId || PO_SPREADSHEET_ID;
    docNum = String(docNum).trim();

    const current = String((await getSheetData(ssid, `${FORM_SHEET}!G3:G3`))?.[0]?.[0] || "").trim();
    if (current === docNum) {
        return { success: true, message: "Already active" };
    }
    if (current) {
        await archiveCurrentForm(undefined, undefined, ssid);
    } else {
        await clearFormSheet(ssid);
    }

    const data = await readArchive(ssid);
    const jobRows = rowNumbersOf(data, docNum).map((r) => data[r - 1]);
    if (jobRows.length === 0) {
        throw new Error(`Job ${docNum} not found in Archive`);
    }
    if (jobRows.length > FORM_MAX_ROWS) {
        console.warn(`[Restore] ${docNum} has ${jobRows.length} items; form holds ${FORM_MAX_ROWS}`);
    }

    const header = jobRows[0];
    const custName = header[1] || "";
    const dateStr = header[8] || getThaiDateString();
    const status = String(header[6] || "").trim();
    const link = String(header[7] || "").trim();

    // จัดรูปแบบเหมือนตอน process: เลขลำดับ/เลข order แสดงเฉพาะแถวแรกของแต่ละ order
    const seqs: any[][] = [], orders: any[][] = [], items: any[][] = [], qtys: any[][] = [];
    let lastOrder: string | null = null;
    let groupSeq = 0;
    for (const row of jobRows.slice(0, FORM_MAX_ROWS)) {
        const orderNo = String(row[3] || "").trim();
        const isNewGroup = orderNo !== "" && orderNo !== lastOrder;
        if (isNewGroup) { lastOrder = orderNo; groupSeq++; }
        seqs.push([isNewGroup ? groupSeq : ""]);
        orders.push([isNewGroup ? orderNo : ""]);
        items.push([row[4] || ""]);
        qtys.push([row[5] ?? ""]);
    }
    const endRow = FORM_FIRST_ROW + seqs.length - 1;

    const updates = [
        { range: `${FORM_SHEET}!G3`, values: [[docNum]] },
        { range: `${FORM_SHEET}!F4`, values: [[dateStr]] },
        { range: `${FORM_SHEET}!F5`, values: [[getThaiDateString()]] },
        { range: `${FORM_SHEET}!F6`, values: [[custName]] },
        { range: `${FORM_SHEET}!B${FORM_FIRST_ROW}:B${endRow}`, values: seqs },
        { range: `${FORM_SHEET}!C${FORM_FIRST_ROW}:C${endRow}`, values: orders },
        { range: `${FORM_SHEET}!D${FORM_FIRST_ROW}:D${endRow}`, values: items },
        { range: `${FORM_SHEET}!G${FORM_FIRST_ROW}:G${endRow}`, values: qtys },
    ];
    // ลายเซ็นที่เก็บไว้ (ยังไม่ปิดงาน) — H33 เก็บ URL ดิบให้ status API อ่าน, G33 แสดงรูป
    if (link.startsWith('http') && status !== STATUS_DONE) {
        updates.push({ range: `${FORM_SHEET}!H33`, values: [[link]] });
        updates.push({ range: `${FORM_SHEET}!G33`, values: [['=IMAGE(H33)']] });
    }
    await batchUpdateSheetData(ssid, updates);

    console.log(`[Restore] Restored ${docNum} to Form (status kept: ${status || '-'})`);
    return { success: true };
}

/** ตอบ error ของ route แบบเดียวกัน — FormBusyError = 409 */
export function lockErrorStatus(error: any): number {
    return error instanceof FormBusyError ? 409 : 500;
}
