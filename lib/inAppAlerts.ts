// In-App Alerts Utility for WMS 360
// Handles alert generation from inventory and damage data

export interface InAppAlert {
  id: string;
  type: "low_stock" | "pending_damage" | "cycle_count" | "transaction_error";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  read: boolean;
  actionUrl?: string;
  createdAt: Date;
}

export interface AlertSummary {
  lowStockCount: number;
  pendingDamageCount: number;
  cycleCountDue: number;
  totalUnread: number;
}

// Generate Low Stock Alerts from Products
export function generateLowStockAlerts(products: any[]): InAppAlert[] {
  const alerts: InAppAlert[] = [];

  const lowStockItems = products.filter((p) => {
    // Filter Inactive (Robust Check)
    const status = p.status?.toString().trim().toLowerCase() || 'active';
    const inactiveTerms = ['inactive', 'cancel', 'cancelled', 'delete', 'deleted', 'suspend', 'suspended', 'discontinued', 'close', 'closed', 'เลิกขาย', 'ปิด', 'ยกเลิก', 'ไม่ขาย'];
    
    if (inactiveTerms.some(term => status === term || status.includes(term))) return false;

    const stock = p.stock || 0;
    const minStock = p.minStock || 0;
    return minStock > 0 && stock <= minStock;
  });

  lowStockItems.forEach((product) => {
    const isCritical = product.stock === 0;
    alerts.push({
      id: `low-stock-${product.id}`,
      type: "low_stock",
      title: isCritical ? "🚨 สินค้าหมด!" : "⚠️ สินค้าใกล้หมด",
      message: `${product.name} เหลือ ${product.stock} ${
        product.unit || "ชิ้น"
      } (Min: ${product.minStock})`,
      severity: isCritical ? "critical" : "warning",
      read: false,
      actionUrl: `/inventory?status=LOW`,
      createdAt: new Date(),
    });
  });

  return alerts;
}

// Generate Pending Damage Alerts
export function generateDamageAlerts(damageRecords: any[]): InAppAlert[] {
  const alerts: InAppAlert[] = [];

  const pendingDamage = damageRecords.filter(
    (d) => d.status === "Pending" || d.status === "รอดำเนินการ",
  );

  if (pendingDamage.length > 0) {
    alerts.push({
      id: `pending-damage-${Date.now()}`,
      type: "pending_damage",
      title: "📋 รอการอนุมัติของเสีย",
      message: `มี ${pendingDamage.length} รายการรอการอนุมัติ`,
      severity: "warning",
      read: false,
      actionUrl: "/damage",
      createdAt: new Date(),
    });
  }

  return alerts;
}

// Get Alert Summary for Badge count
export function getAlertSummary(
  products: any[],
  damageRecords: any[],
): AlertSummary {
  const lowStockItems = products.filter((p) => {
   // Filter Inactive (Robust Check)
    const status = p.status?.toString().trim().toLowerCase() || 'active';
    const inactiveTerms = ['inactive', 'cancel', 'cancelled', 'delete', 'deleted', 'suspend', 'suspended', 'discontinued', 'close', 'closed', 'เลิกขาย', 'ปิด', 'ยกเลิก', 'ไม่ขาย'];
    
    if (inactiveTerms.some(term => status === term || status.includes(term))) return false;
    
    const stock = p.stock || 0;
    const minStock = p.minStock || 0;
    return minStock > 0 && stock <= minStock;
  });

  const pendingDamage = damageRecords.filter(
    (d) => d.status === "Pending" || d.status === "รอดำเนินการ",
  );

  return {
    lowStockCount: lowStockItems.length,
    pendingDamageCount: pendingDamage.length,
    cycleCountDue: 0,
    totalUnread: lowStockItems.length + (pendingDamage.length > 0 ? 1 : 0),
  };
}

// Get Critical Alerts for Dashboard Top Banner
export function getCriticalAlerts(products: any[]): InAppAlert[] {
  const outOfStock = products.filter(
    (p) => {
        const status = p.status?.toString().trim().toLowerCase() || 'active';
        const inactiveTerms = ['inactive', 'cancel', 'cancelled', 'delete', 'deleted', 'suspend', 'suspended', 'discontinued', 'close', 'closed', 'เลิกขาย', 'ปิด', 'ยกเลิก', 'ไม่ขาย'];
        if (inactiveTerms.some(term => status === term || status.includes(term))) return false;

        return p.stock === 0 && (p.minStock > 0 || p.status === "Active");
    }
  );

  if (outOfStock.length === 0) return [];

  return [
    {
      id: `critical-stock-${Date.now()}`,
      type: "low_stock",
      title: "🚨 สินค้าหมดสต็อก!",
      message: `${outOfStock.length} รายการต้องเติมสินค้าด่วน`,
      severity: "critical",
      read: false,
      actionUrl: "/inventory?status=LOW",
      createdAt: new Date(),
    },
  ];
}

// Combine all alerts
export function getAllAlerts(
  products: any[],
  damageRecords: any[],
): InAppAlert[] {
  const lowStockAlerts = generateLowStockAlerts(products);
  const damageAlerts = generateDamageAlerts(damageRecords);

  // Sort by severity (critical first) then by date
  return [...lowStockAlerts, ...damageAlerts].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
