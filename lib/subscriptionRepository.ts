import { getSheetData, appendSheetRow, getGoogleSheets, getSheetId, SPREADSHEET_ID } from './googleSheets';

// We reuse the Main Spreadsheet
// const SPREADSHEET_ID is imported from googleSheets
const SHEET_NAME = '🔔 Subscriptions';

export interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    expirationTime?: number | null;
}

export async function saveSubscription(sub: PushSubscription) {
    // 1. Check if already exists (Optional, but good to avoid dupes)
    // For MVP, just append. Or we can read and check.
    
    // Format: Endpoint | P256dh | Auth | Timestamp
    const row = [
        sub.endpoint,
        sub.keys.p256dh,
        sub.keys.auth,
        new Date().toISOString()
    ];
    
    try {
        await appendSheetRow(SPREADSHEET_ID, `${SHEET_NAME}!A:D`, row);
        console.log('Saved subscription:', sub.endpoint);
    } catch (error) {
        console.error('Failed to save subscription:', error);
        // If sheet doesn't exist, we might need to create it?
        // Assuming user creates it or we use auto-creation logic if we had it.
    }
}

/**
 * Remove expired/gone push subscriptions from the sheet.
 * Called after web-push returns 410 (Gone) or 404 so stale endpoints don't
 * accumulate. Matches on endpoint (column A), deletes rows bottom-up.
 */
export async function removeSubscriptions(endpoints: string[]): Promise<number> {
    const toRemove = new Set(endpoints.filter(Boolean));
    if (toRemove.size === 0) return 0;

    try {
        const rows = await getSheetData(SPREADSHEET_ID, `${SHEET_NAME}!A:A`);
        if (!rows || rows.length === 0) return 0;

        const rowIndices: number[] = [];
        rows.forEach((row, i) => {
            if (row[0] && toRemove.has(row[0])) rowIndices.push(i);
        });
        if (rowIndices.length === 0) return 0;

        const sheetId = await getSheetId(SPREADSHEET_ID, SHEET_NAME);
        if (sheetId === null) return 0;

        const { googleSheets, auth } = await getGoogleSheets();
        const requests = rowIndices
            .sort((a, b) => b - a)
            .map((idx) => ({
                deleteDimension: {
                    range: { sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 },
                },
            }));

        await googleSheets.spreadsheets.batchUpdate({
            auth: auth as any,
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { requests },
        });

        console.log(`[WebPush] Removed ${rowIndices.length} expired subscription(s).`);
        return rowIndices.length;
    } catch (error) {
        console.error('[WebPush] Failed to remove subscriptions:', error);
        return 0;
    }
}

export async function getSubscriptions(): Promise<PushSubscription[]> {
    try {
        const rows = await getSheetData(SPREADSHEET_ID, `${SHEET_NAME}!A:C`);
        if (!rows) return [];
        
        return rows.map(row => ({
            endpoint: row[0],
            keys: {
                p256dh: row[1],
                auth: row[2]
            }
        }));
    } catch (error) {
        console.error('Failed to get subscriptions:', error);
        return [];
    }
}
