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
export const STATUS_PENDING_ROLLTAG = "รอจัด RollTag"; // สแกนจากอีเมล/นำเข้า รอแอดมินหรือพนักงานเปิดงาน
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

const LOCK_CELL = `'${DATA_SHEET}'!Z1`;
export const ACTIVE_JOB_CELL = `'${DATA_SHEET}'!Z2`;
const LOCK_TTL_MS = 60000; // lock ที่เก่ากว่านี้ถือว่า process ตายไปแล้ว
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getActiveJobDocNum(spreadsheetId?: string): Promise<string> {
    const ssid = spreadsheetId || PO_SPREADSHEET_ID;
    try {
        const val = await getSheetData(ssid, ACTIVE_JOB_CELL);
        return String(val?.[0]?.[0] || "").trim();
    } catch {
        return "";
    }
}

export async function setActiveJobDocNum(spreadsheetId: string | undefined, docNum: string): Promise<void> {
    const ssid = spreadsheetId || PO_SPREADSHEET_ID;
    try {
        await updateSheetData(ssid, ACTIVE_JOB_CELL, [[docNum || ""]]);
    } catch (e) {
        console.warn(`[setActiveJobDocNum] Failed to update active job:`, e);
    }
}

export class FormBusyError extends Error {
    status = 409;
    constructor() {
        super('ระบบกำลังบันทึกงานอื่นอยู่ กรุณารอสักครู่แล้วลองใหม่');
    }
}

export async function withFormLock<T>(ssid: string, fn: () => Promise<T>, waitMs = 15000): Promise<T> {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const deadline = Date.now() + waitMs;
    const readLock = async () => {
        try {
            return String((await getSheetData(ssid, LOCK_CELL))?.[0]?.[0] || "");
        } catch {
            return "";
        }
    };

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
    const docNum = await getActiveJobDocNum(ssid);
    if (!docNum) {
        return { success: false, error: 'No active job found' };
    }

    if (customStatus) {
        await setDocsStatus(ssid, [docNum], customStatus);
    }
    await setActiveJobDocNum(ssid, "");
    return { success: true, docNum };
}

export async function clearFormSheet(spreadsheetId?: string) {
    const ssid = spreadsheetId || PO_SPREADSHEET_ID;
    await setActiveJobDocNum(ssid, "");
    return { success: true };
}

/**
 * ดึงงานจากคลังข้อมูลขึ้นเป็นงาน Active (จำลองงานที่กำลังทำ)
 * ไม่จำเป็นต้องเขียนลงแท็บ ส่งสินค้า อีกต่อไป
 * ต้องเรียกภายใน withFormLock
 */
export async function restoreOrderToForm(docNum: string, spreadsheetId?: string) {
    const ssid = spreadsheetId || PO_SPREADSHEET_ID;
    docNum = String(docNum).trim();

    const data = await readArchive(ssid);
    const jobRows = rowNumbersOf(data, docNum);
    if (jobRows.length === 0) {
        throw new Error(`Job ${docNum} not found in Archive`);
    }

    await setDocsStatus(ssid, [docNum], STATUS_IN_PROGRESS);
    await setActiveJobDocNum(ssid, docNum);
    console.log(`[Restore] Set active job ${docNum} in คลังข้อมูล (no sheet write needed)`);
    return { success: true };
}

/** ตอบ error ของ route แบบเดียวกัน — FormBusyError = 409 */
export function lockErrorStatus(error: any): number {
    return error instanceof FormBusyError ? 409 : 500;
}
