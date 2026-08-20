/**
 * Smart Put-Away & Cross-Docking Engine (WMS 360 PRO)
 * Zero-Cost logic for Inbound routing, automated bin recommendation & direct fulfillment.
 */

import { parseLocation } from './picking';
import { WarehouseZone } from './warehouseMap';

export interface PutawaySuggestion {
  suggestedLocation: string;
  zone: string;
  aisle: number;
  rack: number;
  reason: string;
  isExistingLocation: boolean;
}

export interface CrossDockMatch {
  hasCrossDock: boolean;
  pendingQty: number;
  matchedOrdersCount: number;
  orders: Array<{ orderDocNum: string; customerName: string; requestedQty: number }>;
}

/**
 * Suggest optimal put-away location for incoming product
 */
export function suggestPutawayLocation(
  product: any,
  zones: WarehouseZone[] = []
): PutawaySuggestion {
  const currentLoc = product.location?.trim();

  // 1. If product already has an assigned valid location, keep it for consolidation
  if (currentLoc && currentLoc.toLowerCase() !== 'unassigned' && currentLoc !== '-') {
    const parsed = parseLocation(currentLoc);
    return {
      suggestedLocation: parsed.raw || currentLoc,
      zone: parsed.zone,
      aisle: parsed.aisle,
      rack: parsed.rack,
      reason: 'จัดเก็บรวมกับสต็อกเดิมที่มีอยู่ (Consolidation)',
      isExistingLocation: true,
    };
  }

  // 2. Recommend based on ABC velocity heuristic
  // Fast moving / small goods -> Zone A
  // Normal goods -> Zone B
  // Heavy / Bulk goods -> Zone C
  const category = (product.category || '').toLowerCase();
  let targetZoneId = 'B';

  if (category.includes('fast') || category.includes('box') || category.includes('กล่อง') || category.includes('ซอง')) {
    targetZoneId = 'A';
  } else if (category.includes('heavy') || category.includes('bulk') || category.includes('พาเลท') || category.includes('ใหญ่')) {
    targetZoneId = 'C';
  }

  const targetZone = zones.find(z => z.zoneId === targetZoneId) || zones[0];

  if (targetZone && targetZone.aisles.length > 0) {
    // Find first rack with available space or empty status
    for (const aisle of targetZone.aisles) {
      for (const rack of aisle.racks) {
        if (rack.status === 'AVAILABLE_EMPTY' || rack.status === 'LOW_STOCK' || rack.totalStock < 100) {
          const binCode = rack.bins[0]?.binCode || `${targetZone.zoneId}-${aisle.aisleNumber.toString().padStart(2, '0')}-${rack.rackNumber.toString().padStart(2, '0')}`;
          return {
            suggestedLocation: binCode,
            zone: targetZone.zoneId,
            aisle: aisle.aisleNumber,
            rack: rack.rackNumber,
            reason: `จัดเก็บในพื้นที่ว่าง ${targetZone.name} (เหมาะกับความเร็วการหมุนเวียน)`,
            isExistingLocation: false,
          };
        }
      }
    }
  }

  // Fallback default
  return {
    suggestedLocation: `${targetZoneId}-01-01`,
    zone: targetZoneId,
    aisle: 1,
    rack: 1,
    reason: `จัดเก็บในโซนมาตรฐาน (${targetZoneId})`,
    isExistingLocation: false,
  };
}

/**
 * Check if incoming product matches any pending orders for instant Cross-Docking
 */
export function checkCrossDockOpportunity(
  skuOrName: string,
  pendingOrders: any[] = []
): CrossDockMatch {
  if (!skuOrName || !pendingOrders || pendingOrders.length === 0) {
    return { hasCrossDock: false, pendingQty: 0, matchedOrdersCount: 0, orders: [] };
  }

  const query = skuOrName.toLowerCase().trim();
  const matchedOrders: Array<{ orderDocNum: string; customerName: string; requestedQty: number }> = [];
  let totalPending = 0;

  pendingOrders.forEach(order => {
    // Handle different order shapes
    const items = order.items || (order.sku ? [order] : []);
    items.forEach((it: any) => {
      const itSku = (it.sku || it.itemCode || it.product || it.name || '').toLowerCase().trim();
      if (itSku === query || itSku.includes(query) || query.includes(itSku)) {
        const qty = Number(it.qty || it.quantity || 1);
        totalPending += qty;
        matchedOrders.push({
          orderDocNum: order.docNum || order.orderNo || order.tagId || 'PO-PENDING',
          customerName: order.customerName || order.customerId || 'ลูกค้า',
          requestedQty: qty,
        });
      }
    });
  });

  return {
    hasCrossDock: matchedOrders.length > 0,
    pendingQty: totalPending,
    matchedOrdersCount: matchedOrders.length,
    orders: matchedOrders,
  };
}
