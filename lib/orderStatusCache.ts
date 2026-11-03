// In-memory cache for /api/orders/status
// Shared across API routes running in the same Node.js runtime process
const STATUS_CACHE_MS = 4000;
const statusCache = new Map<string, { response: any; time: number }>();

export function getCachedStatus(ssid: string): any | null {
  const cached = statusCache.get(ssid);
  if (cached && Date.now() - cached.time < STATUS_CACHE_MS) {
    return cached.response;
  }
  return null;
}

export function setCachedStatus(ssid: string, response: any): void {
  statusCache.set(ssid, { response, time: Date.now() });
}

export function invalidateStatusCache(ssid?: string): void {
  if (ssid) {
    statusCache.delete(ssid);
  } else {
    statusCache.clear();
  }
}
