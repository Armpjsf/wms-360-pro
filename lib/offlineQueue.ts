// Tiny localStorage-backed offline queue for critical warehouse actions.
// If the network drops mid-action, the action is stored and replayed when
// connectivity returns (browser 'online' event or next app open).

const KEY = 'wms_offline_queue_v1';

export interface QueuedAction {
    id: string;
    /** API path, e.g. '/api/orders/ready' */
    path: string;
    body: any;
    ts: number;
}

function readQueue(): QueuedAction[] {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
        return [];
    }
}

function writeQueue(q: QueuedAction[]) {
    localStorage.setItem(KEY, JSON.stringify(q));
}

export function enqueue(path: string, body: any) {
    const q = readQueue();
    q.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, path, body, ts: Date.now() });
    writeQueue(q);
}

export function queueLength(): number {
    return readQueue().length;
}

/**
 * Replay queued actions in order. Stops at the first failure (keeps the rest
 * queued). Returns how many actions were sent.
 */
export async function flushQueue(getUrl: (path: string) => string): Promise<number> {
    let q = readQueue();
    let sent = 0;
    while (q.length > 0) {
        const action = q[0];
        try {
            const res = await fetch(getUrl(action.path), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(action.body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch {
            break; // still offline or server error — retry later
        }
        q = q.slice(1);
        writeQueue(q);
        sent++;
    }
    return sent;
}
