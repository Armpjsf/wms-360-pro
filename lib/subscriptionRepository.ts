import { getSheetData, appendSheetRow, getGoogleSheets } from './googleSheets';

// We reuse the PO Spreadsheet or define a new one. 
// For simplicity, let's use the one in .env.local or hardcoded if needed.
// Ideally, we put everything in one "Database" sheet.
const SPREADSHEET_ID = process.env.NEXT_PUBLIC_PO_SPREADSHEET_ID || '1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM';
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
