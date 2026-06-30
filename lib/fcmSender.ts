import { messaging } from './firebaseAdmin';
import { getSheetData, removeDeadDeviceTokens, SPREADSHEET_ID } from './googleSheets';

const DEVICES_RANGE = "'📱 Devices'!A:A";
const DEAD_TOKEN_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-argument',
]);

export interface FcmPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}

/**
 * Send an FCM multicast to all registered devices, log the result, and
 * auto-remove dead tokens (NotRegistered / invalid) from the Devices sheet.
 * Centralizes token fetching, the android notification block, result logging,
 * and stale-token cleanup so every caller behaves consistently.
 */
export async function sendFcmToDevices(
    payload: FcmPayload,
    opts: { tag?: string; spreadsheetId?: string } = {}
): Promise<{ sent: number; failed: number }> {
    const tag = opts.tag || 'FCM';
    const ssid = opts.spreadsheetId || SPREADSHEET_ID;

    if (!messaging) {
        console.warn(`[${tag}] Firebase messaging not initialized.`);
        return { sent: 0, failed: 0 };
    }

    const deviceData = await getSheetData(ssid, DEVICES_RANGE);
    const tokens = deviceData?.map((r: any[]) => r[0]).filter((t: any) => t && t.length > 10) || [];
    if (tokens.length === 0) {
        console.log(`[${tag}] No devices registered.`);
        return { sent: 0, failed: 0 };
    }

    console.log(`[${tag}] Sending push to ${tokens.length} devices...`);
    const res = await messaging.sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
        android: {
            priority: 'high',
            notification: { sound: 'default', clickAction: 'FCM_PLUGIN_ACTIVITY' },
        },
    });

    console.log(`[${tag}] FCM Result: ${res.successCount} sent, ${res.failureCount} failed.`);

    const deadTokens: string[] = [];
    res.responses.forEach((r, i) => {
        if (!r.success) {
            console.error(`[${tag}] token #${i} failed:`, r.error?.code, r.error?.message);
            if (r.error?.code && DEAD_TOKEN_CODES.has(r.error.code)) deadTokens.push(tokens[i]);
        }
    });
    if (deadTokens.length > 0) {
        await removeDeadDeviceTokens(deadTokens, ssid);
    }

    return { sent: res.successCount, failed: res.failureCount };
}
