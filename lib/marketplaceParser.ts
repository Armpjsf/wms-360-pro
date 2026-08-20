/**
 * Marketplace Order Parser & Normalizer (WMS 360 PRO)
 * Supports Shopee, TikTok Shop, Lazada, and Custom Excel/CSV formats.
 */

import * as XLSX from 'xlsx';

export type MarketplacePlatform = 'SHOPEE' | 'TIKTOK' | 'LAZADA' | 'LINE_SHOPPING' | 'CUSTOM';

export interface NormalizedMarketplaceOrder {
  id: string;
  platform: MarketplacePlatform;
  orderNo: string;
  trackingNo: string;
  customerName: string;
  phone: string;
  address: string;
  postalCode: string;
  sku: string;
  productName: string;
  qty: number;
  price: number;
  orderDate: string;
  status: string;
  raw?: any;
}

/**
 * Detect platform from column headers
 */
export function detectPlatform(headers: string[]): MarketplacePlatform {
  const h = headers.map(x => (x || '').toLowerCase().trim());

  if (h.some(x => x.includes('shopee') || x.includes('หมายเลขคำสั่งซื้อ') || x.includes('sku อ้างอิง'))) {
    return 'SHOPEE';
  }
  if (h.some(x => x.includes('tiktok') || x.includes('seller sku') || x.includes('tracking id'))) {
    return 'TIKTOK';
  }
  if (h.some(x => x.includes('lazada') || x.includes('ordernumber') || x.includes('sellersku'))) {
    return 'LAZADA';
  }
  if (h.some(x => x.includes('line shopping') || x.includes('line myhop'))) {
    return 'LINE_SHOPPING';
  }

  return 'CUSTOM';
}

/**
 * Parse Excel or CSV buffer into normalized marketplace orders
 */
export function parseMarketplaceFile(fileBuffer: ArrayBuffer): {
  platform: MarketplacePlatform;
  orders: NormalizedMarketplaceOrder[];
  totalOrders: number;
  totalItemsCount: number;
} {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) {
    return { platform: 'CUSTOM', orders: [], totalOrders: 0, totalItemsCount: 0 };
  }

  const headers = Object.keys(rawRows[0] || {});
  const platform = detectPlatform(headers);

  const orders: NormalizedMarketplaceOrder[] = [];

  rawRows.forEach((row, idx) => {
    // Find matching keys dynamically
    const findVal = (...keys: string[]) => {
      for (const k of keys) {
        const foundKey = Object.keys(row).find(
          rk => rk.toLowerCase().trim() === k.toLowerCase().trim() || rk.toLowerCase().includes(k.toLowerCase())
        );
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
          return String(row[foundKey]).trim();
        }
      }
      return '';
    };

    const orderNo = findVal(
      'หมายเลขคำสั่งซื้อ',
      'order id',
      'ordernumber',
      'order no',
      'order_id',
      'เลขที่คำสั่งซื้อ'
    ) || `ORD-${Date.now()}-${idx + 1}`;

    const trackingNo = findVal(
      'หมายเลขพัสดุ',
      'tracking number',
      'tracking id',
      'trackingcode',
      'tracking_no',
      'เลขพัสดุ'
    );

    const customerName = findVal(
      'ชื่อผู้รับ',
      'recipient name',
      'customername',
      'buyer name',
      'ชื่อผู้ซื้อ',
      'ผู้รับ'
    ) || 'ลูกค้าทั่วไป';

    const phone = findVal('เบอร์โทรศัพท์', 'phone number', 'phonenumber', 'buyer phone', 'เบอร์โทร');
    const address = findVal('ที่อยู่จัดส่ง', 'shipping address', 'delivery address', 'ที่อยู่');
    const postalCode = findVal('รหัสไปรษณีย์', 'postal code', 'postcode', 'zip code');

    const sku = findVal(
      'sku อ้างอิง',
      'seller sku',
      'sellersku',
      'sku',
      'รหัสสินค้า',
      'product code'
    ) || findVal('ชื่อสินค้า', 'product name', 'itemname', 'สินค้า') || `SKU-${idx + 1}`;

    const productName = findVal('ชื่อสินค้า', 'product name', 'itemname', 'รายละเอียดสินค้า') || sku;
    const qtyStr = findVal('จำนวน', 'quantity', 'qty', 'จำนวนสินค้า');
    const qty = parseInt(qtyStr, 10) || 1;

    const priceStr = findVal('ราคา', 'price', 'total amount', 'ยอดรวม');
    const price = parseFloat(priceStr) || 0;

    const orderDate = findVal('วันที่สั่งซื้อ', 'order creation date', 'created time', 'date') || new Date().toISOString().slice(0, 10);

    orders.push({
      id: `mkt-${idx + 1}`,
      platform,
      orderNo,
      trackingNo,
      customerName,
      phone,
      address,
      postalCode,
      sku,
      productName,
      qty,
      price,
      orderDate,
      status: 'READY_TO_PICK',
      raw: row,
    });
  });

  const uniqueOrders = new Set(orders.map(o => o.orderNo)).size;

  return {
    platform,
    orders,
    totalOrders: uniqueOrders,
    totalItemsCount: orders.length,
  };
}
