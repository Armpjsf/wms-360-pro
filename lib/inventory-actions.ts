import { appendSheetRow, SPREADSHEET_ID } from "./googleSheets";

// ============================================================================
// CYCLE COUNT ACTIONS
// ============================================================================
export async function addCycleCount(data: { 
    date: string, 
    sku: string, 
    physicalQty: number, 
    systemQty: number, 
    variance: number, 
    note: string 
}) {
    // Sheet Headers: Date, SKU, Physical, System, Variance, Note
    const row = [
        data.date,
        data.sku,
        data.physicalQty,
        data.systemQty,
        data.variance,
        data.note
    ];
    // Check if sheet name needs adjustment (e.g. 'CycleCount_Log' vs 'Count')
    // Based on CSV "CycleCount_Log.csv", let's assume sheet is "CycleCount_Log"
    await appendSheetRow(SPREADSHEET_ID, "'CycleCount_Log'!A:F", row);
}

// ============================================================================
// DAMAGE REPORT ACTIONS
// ============================================================================
export async function addDamageReport(data: { 
    date: string, 
    sku: string, 
    qty: number, 
    reason: string 
}) {
    // Sheet Headers: Date, SKU, Qty, Reason, ...
    const row = [
        data.date,
        data.sku,
        data.qty,
        data.reason,
        "Reported via Web" // Optional status/user col
    ];
    // Based on CSV "Damage.csv", sheet is likely "Damage"
    await appendSheetRow(SPREADSHEET_ID, "'Damage'!A:E", row);
}
