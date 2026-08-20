/**
 * 2D Visual Warehouse Map & Bin Management Logic (WMS 360 PRO)
 * Zero-Cost layout generator and Heatmap analyzer.
 */

import { parseLocation, ParsedLocation } from './picking';

export interface BinProduct {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  price: number;
  velocityClass?: 'A' | 'B' | 'C' | 'D';
}

export interface WarehouseBin {
  binCode: string;
  zone: string;
  aisle: number;
  rack: number;
  shelf: number;
  products: BinProduct[];
  totalStock: number;
  status: 'NORMAL' | 'LOW_STOCK' | 'EMPTY_CRITICAL' | 'AVAILABLE_EMPTY';
  dominantVelocityClass: 'A' | 'B' | 'C' | 'D';
}

export interface WarehouseRack {
  rackNumber: number;
  zone: string;
  aisle: number;
  bins: WarehouseBin[];
  totalStock: number;
  status: 'NORMAL' | 'LOW_STOCK' | 'EMPTY_CRITICAL' | 'AVAILABLE_EMPTY';
}

export interface WarehouseAisle {
  aisleNumber: number;
  zone: string;
  racks: WarehouseRack[];
  totalStock: number;
}

export interface WarehouseZone {
  zoneId: string;
  name: string;
  color: string;
  aisles: WarehouseAisle[];
  totalStock: number;
  totalBins: number;
  occupiedBins: number;
}

export interface WarehouseMapStats {
  totalZones: number;
  totalAisles: number;
  totalRacks: number;
  totalBins: number;
  occupiedBins: number;
  emptyBins: number;
  occupancyRate: number;
  lowStockBins: number;
  outOfStockBins: number;
  unassignedProductsCount: number;
}

const ZONE_COLORS: Record<string, string> = {
  A: 'emerald',
  B: 'blue',
  C: 'amber',
  D: 'violet',
  E: 'rose',
  F: 'cyan',
};

/**
 * Build structured warehouse 2D map from Products list
 */
export function buildWarehouseMap(
  products: any[] = [],
  transactions: any[] = []
): { zones: WarehouseZone[]; unassignedProducts: any[]; stats: WarehouseMapStats } {
  // 1. Calculate Velocity from Transactions (if any)
  const velocityMap = new Map<string, number>();
  transactions.forEach(t => {
    if (t.type === 'OUT' || t.transaction_type === 'OUT') {
      const key = t.sku || t.product_id || t.productId || t.name;
      if (key) {
        velocityMap.set(key, (velocityMap.get(key) || 0) + Number(t.qty || t.quantity || 1));
      }
    }
  });

  const binMap = new Map<string, WarehouseBin>();
  const unassignedProducts: any[] = [];

  // 2. Populate products into Bins
  products.forEach(p => {
    const loc = p.location?.trim();
    if (!loc || loc.toLowerCase() === 'unassigned') {
      unassignedProducts.push(p);
      return;
    }

    const parsed: ParsedLocation = parseLocation(loc);
    const binCode = parsed.raw || `${parsed.zone}-${parsed.aisle.toString().padStart(2, '0')}-${parsed.rack.toString().padStart(2, '0')}`;

    // Velocity Ranking
    const vel = velocityMap.get(p.id || p.name) || 0;
    let vClass: 'A' | 'B' | 'C' | 'D' = 'C';
    if (vel > 50) vClass = 'A';
    else if (vel > 15) vClass = 'B';
    else if (vel === 0) vClass = 'D';

    const binProduct: BinProduct = {
      id: p.id || p.name,
      name: p.name || 'Unnamed Product',
      category: p.category || 'General',
      stock: Number(p.stock || 0),
      minStock: Number(p.minStock || 5),
      unit: p.unit || 'pcs',
      price: Number(p.price || 0),
      velocityClass: vClass,
    };

    if (!binMap.has(binCode)) {
      binMap.set(binCode, {
        binCode,
        zone: parsed.zone,
        aisle: parsed.aisle,
        rack: parsed.rack,
        shelf: parsed.shelf,
        products: [],
        totalStock: 0,
        status: 'NORMAL',
        dominantVelocityClass: 'C',
      });
    }

    const bin = binMap.get(binCode)!;
    bin.products.push(binProduct);
    bin.totalStock += binProduct.stock;
  });

  // Calculate Bin Statuses
  binMap.forEach(bin => {
    if (bin.totalStock <= 0) {
      bin.status = 'EMPTY_CRITICAL';
    } else if (bin.products.some(p => p.stock <= p.minStock)) {
      bin.status = 'LOW_STOCK';
    } else {
      bin.status = 'NORMAL';
    }

    // Dominant velocity
    if (bin.products.some(p => p.velocityClass === 'A')) bin.dominantVelocityClass = 'A';
    else if (bin.products.some(p => p.velocityClass === 'B')) bin.dominantVelocityClass = 'B';
    else if (bin.products.every(p => p.velocityClass === 'D')) bin.dominantVelocityClass = 'D';
    else bin.dominantVelocityClass = 'C';
  });

  // 3. Build Zone -> Aisle -> Rack Hierarchy
  const zoneMap = new Map<string, Map<number, Map<number, WarehouseBin[]>>>();

  // Ensure standard zones exist even if empty (Zones A, B, C)
  const defaultZones = ['A', 'B', 'C'];
  defaultZones.forEach(z => {
    if (!zoneMap.has(z)) zoneMap.set(z, new Map());
  });

  binMap.forEach(bin => {
    const z = bin.zone;
    if (!zoneMap.has(z)) zoneMap.set(z, new Map());

    const aisleMap = zoneMap.get(z)!;
    if (!aisleMap.has(bin.aisle)) aisleMap.set(bin.aisle, new Map());

    const rackMap = aisleMap.get(bin.aisle)!;
    if (!rackMap.has(bin.rack)) rackMap.set(bin.rack, []);

    rackMap.get(bin.rack)!.push(bin);
  });

  const zones: WarehouseZone[] = [];

  zoneMap.forEach((aisleMap, zoneId) => {
    const aisles: WarehouseAisle[] = [];
    let zoneStock = 0;
    let zoneBinsCount = 0;
    let zoneOccupiedCount = 0;

    // Default 2 aisles if empty
    const aisleKeys = Array.from(aisleMap.keys()).sort((a, b) => a - b);
    if (aisleKeys.length === 0) {
      aisleKeys.push(1, 2);
    }

    aisleKeys.forEach(aisleNum => {
      const rackMap = aisleMap.get(aisleNum) || new Map<number, WarehouseBin[]>();
      const racks: WarehouseRack[] = [];
      let aisleStock = 0;

      // Default 4 racks per aisle if empty
      const rackKeys = Array.from(rackMap.keys()).sort((a, b) => a - b);
      if (rackKeys.length === 0) {
        rackKeys.push(1, 2, 3, 4);
      }

      rackKeys.forEach(rackNum => {
        let bins = rackMap.get(rackNum) || [];
        if (bins.length === 0) {
          // Synthetic available bin
          bins = [
            {
              binCode: `${zoneId}-${aisleNum.toString().padStart(2, '0')}-${rackNum.toString().padStart(2, '0')}`,
              zone: zoneId,
              aisle: aisleNum,
              rack: rackNum,
              shelf: 1,
              products: [],
              totalStock: 0,
              status: 'AVAILABLE_EMPTY',
              dominantVelocityClass: 'D',
            },
          ];
        }

        const rackStock = bins.reduce((sum, b) => sum + b.totalStock, 0);
        aisleStock += rackStock;
        zoneBinsCount += bins.length;
        if (rackStock > 0) zoneOccupiedCount += bins.length;

        let rackStatus: WarehouseRack['status'] = 'AVAILABLE_EMPTY';
        if (rackStock > 0) {
          rackStatus = bins.some(b => b.status === 'LOW_STOCK')
            ? 'LOW_STOCK'
            : bins.some(b => b.status === 'EMPTY_CRITICAL')
            ? 'EMPTY_CRITICAL'
            : 'NORMAL';
        }

        racks.push({
          rackNumber: rackNum,
          zone: zoneId,
          aisle: aisleNum,
          bins,
          totalStock: rackStock,
          status: rackStatus,
        });
      });

      zoneStock += aisleStock;
      aisles.push({
        aisleNumber: aisleNum,
        zone: zoneId,
        racks,
        totalStock: aisleStock,
      });
    });

    zones.push({
      zoneId,
      name: `โซน ${zoneId} (${zoneId === 'A' ? 'Fast-Moving' : zoneId === 'B' ? 'Standard' : 'Bulk / Reserve'})`,
      color: ZONE_COLORS[zoneId] || 'slate',
      aisles,
      totalStock: zoneStock,
      totalBins: zoneBinsCount,
      occupiedBins: zoneOccupiedCount,
    });
  });

  // Calculate Overall Stats
  const totalBins = Array.from(binMap.values()).length || zones.reduce((s, z) => s + z.totalBins, 0);
  const occupiedBins = Array.from(binMap.values()).filter(b => b.totalStock > 0).length;
  const lowStockBins = Array.from(binMap.values()).filter(b => b.status === 'LOW_STOCK').length;
  const outOfStockBins = Array.from(binMap.values()).filter(b => b.status === 'EMPTY_CRITICAL').length;

  const stats: WarehouseMapStats = {
    totalZones: zones.length,
    totalAisles: zones.reduce((s, z) => s + z.aisles.length, 0),
    totalRacks: zones.reduce((s, z) => s + z.aisles.reduce((as, a) => as + a.racks.length, 0), 0),
    totalBins,
    occupiedBins,
    emptyBins: totalBins - occupiedBins,
    occupancyRate: totalBins > 0 ? Math.round((occupiedBins / totalBins) * 100) : 0,
    lowStockBins,
    outOfStockBins,
    unassignedProductsCount: unassignedProducts.length,
  };

  return { zones, unassignedProducts, stats };
}
