import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export interface RollTagItem {
  orderNo?: string;
  itemCode?: string;
  description?: string;
  quantity?: number | string;
}

export interface RollTagData {
  tagId?: string;
  customerId?: string;
  customerName?: string;
  note?: string;
  pickingDate?: string;
  shippingDate?: string;
  items: RollTagItem[];
}

export interface DeliveryItem {
  seq?: number | string;
  orderNo?: string;
  itemCode?: string;
  description?: string;
  quantity?: number | string;
}

export interface DeliveryNoteData {
  docNum: string;
  company?: string;
  senderName?: string;
  vehiclePlate?: string;
  loadDate?: string;
  deliveryDate?: string;
  customerName?: string;
  forwardTo?: string;
  items: DeliveryItem[];
  signature?: string | null;
  signatureType?: 'warehouse' | 'driver' | 'customer';
}

function getFontBytes(): { regular: Buffer; bold: Buffer } {
  const fontDir = path.join(process.cwd(), 'assets', 'fonts');
  const regPath = path.join(fontDir, 'tahoma.ttf');
  const boldPath = path.join(fontDir, 'tahomabd.ttf');

  if (fs.existsSync(regPath) && fs.existsSync(boldPath)) {
    return {
      regular: fs.readFileSync(regPath),
      bold: fs.readFileSync(boldPath)
    };
  }

  const sarabunReg = path.join(fontDir, 'Sarabun-Regular.ttf');
  const sarabunBold = path.join(fontDir, 'Sarabun-Bold.ttf');
  if (fs.existsSync(sarabunReg) && fs.existsSync(sarabunBold)) {
    return {
      regular: fs.readFileSync(sarabunReg),
      bold: fs.readFileSync(sarabunBold)
    };
  }

  const winReg = 'C:\\Windows\\Fonts\\tahoma.ttf';
  const winBold = 'C:\\Windows\\Fonts\\tahomabd.ttf';
  if (fs.existsSync(winReg) && fs.existsSync(winBold)) {
    return {
      regular: fs.readFileSync(winReg),
      bold: fs.readFileSync(winBold)
    };
  }

  throw new Error('Thai fonts not found');
}

// Baseline ที่ทำให้ตัวอักษรอยู่กึ่งกลางแถว (ระหว่างเส้นบน-ล่างของแม่แบบ)
// ~0.72em = ความสูงตัวอักษรของ Tahoma — เดิมใส่ y ตายตัวทำให้ตัวหนังสือทับเส้น
function midBaseline(bottom: number, top: number, size: number): number {
  return bottom + (top - bottom - size * 0.72) / 2;
}

function drawCentered(page: any, text: string, centerX: number, y: number, size: number, font: any, color: any) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - w / 2, y, size, font, color });
}

// พิกัดเส้นจริงของ assets/templates/rolltag_blank.pdf (วัดจากไฟล์ แนวนอน A4, หน่วย pt นับจากล่าง)
// แถวรายการ 9 แถว สูงไม่เท่ากัน (แถว 1 = 14.6, แถว 2 = 17.3, ที่เหลือ 15)
const RT_ITEM_LINES = [365.5, 350.9, 333.6, 318.6, 303.6, 288.6, 273.6, 258.6, 243.6, 229.4];
const RT_COLS = { order: [71.6, 144.4], item: [144.4, 352.5], desc: [352.5, 592.9], qtyRight: 740 };

// พิกัดเส้นจริงของ assets/templates/delivery_note_blank.pdf (แนวตั้ง A4)
// ตารางรายการ: ใต้หัวตาราง (625.6) ลงไปถึง 245.7 แถวละ ~18.09pt = 21 แถว
const DN_ITEM_TOP = 625.6;
const DN_ITEM_BOTTOM = 245.7;
const DN_ITEM_ROWS = 21;
const DN_ROW_H = (DN_ITEM_TOP - DN_ITEM_BOTTOM) / DN_ITEM_ROWS;
const DN_COLS = { seq: [53.7, 105.8], order: [105.8, 161.5], item: [161.5, 393.9], qtyRight: 535 };
// กล่องลายเซ็นลูกค้า: คอลัมน์ขวาของช่องลงนาม เหนือคำว่า "ผู้รับสินค้า (Customer)"
const DN_SIG_BOX = { centerX: 459, bottom: 167, width: 150, height: 70 };

/**
 * Generate Roll Tag PDF (A4 Landscape, using original blank sheet template)
 */
export async function generateRollTagPdf(data: RollTagData): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), 'assets', 'templates', 'rolltag_blank.pdf');
  let doc: PDFDocument;

  if (fs.existsSync(templatePath)) {
    doc = await PDFDocument.load(fs.readFileSync(templatePath));
  } else {
    // Fallback: create fresh document
    doc = await PDFDocument.create();
    doc.addPage([841.89, 595.28]);
  }

  doc.registerFontkit(fontkit);
  const { regular, bold } = getFontBytes();
  const fontReg = await doc.embedFont(regular);
  const fontBold = await doc.embedFont(bold);

  const page = doc.getPages()[0];
  const black = rgb(0, 0, 0);

  // 1. Header Customer Info
  if (data.customerId) {
    page.drawText(String(data.customerId), { x: 160, y: midBaseline(435.6, 455.1, 10), size: 10, font: fontReg, color: black });
  }
  if (data.customerName) {
    page.drawText(String(data.customerName), { x: 160, y: midBaseline(413.9, 435.6, 10), size: 10, font: fontBold, color: black });
  }
  if (data.note) {
    page.drawText(String(data.note), { x: 160, y: midBaseline(392.1, 413.9, 10), size: 10, font: fontReg, color: black });
  }

  // 2. Dates - Written directly without rectangle overlays
  if (data.pickingDate) {
    page.drawText(data.pickingDate, { x: 660, y: midBaseline(413.9, 435.6, 10), size: 10, font: fontBold, color: black });
  }
  if (data.shippingDate) {
    page.drawText(data.shippingDate, { x: 660, y: midBaseline(392.1, 413.9, 10), size: 10, font: fontBold, color: black });
  }

  // 3. Items (9 rows) — วางตามเส้นจริงของแม่แบบ
  // เดิมเริ่ม y=338 แล้วลดทีละ 18 แต่แถวจริงสูง ~15 ยิ่งแถวหลังยิ่งเลื่อนลงไปทับเส้น
  let totalQty = 0;
  const rtRows = RT_ITEM_LINES.length - 1;

  for (let i = 0; i < Math.min(data.items.length, rtRows); i++) {
    const item = data.items[i];
    const y = midBaseline(RT_ITEM_LINES[i + 1], RT_ITEM_LINES[i], 10);

    if (item.orderNo) {
      drawCentered(page, String(item.orderNo), (RT_COLS.order[0] + RT_COLS.order[1]) / 2, y, 10, fontReg, black);
    }
    if (item.itemCode) {
      drawCentered(page, String(item.itemCode), (RT_COLS.item[0] + RT_COLS.item[1]) / 2, y, 10, fontReg, black);
    }
    if (item.description) {
      page.drawText(String(item.description), { x: RT_COLS.desc[0] + 6, y, size: 10, font: fontReg, color: black });
    }
    if (item.quantity !== undefined && item.quantity !== '') {
      const qNum = Number(item.quantity) || 0;
      totalQty += qNum;
      const qText = `${qNum.toLocaleString()} `;
      const qW = fontBold.widthOfTextAtSize(qText, 10);
      page.drawText(qText, { x: RT_COLS.qtyRight - qW, y, size: 10, font: fontBold, color: black });
    }
  }

  // 4. Total Quantity (แถว TOTAL 203.1..229.0 — เดิม y=202 ทับเส้นล่าง)
  const totalStr = totalQty > 0 ? `${totalQty.toLocaleString()}.00 ` : "-  .00 ";
  const totalW = fontBold.widthOfTextAtSize(totalStr, 11);
  page.drawText(totalStr, { x: RT_COLS.qtyRight - totalW, y: midBaseline(203.1, 229.0, 11), size: 11, font: fontBold, color: black });

  return await doc.save();
}

/**
 * Generate Delivery Note PDF (A4 Portrait, using original blank sheet template)
 */
export async function generateDeliveryNotePdf(data: DeliveryNoteData): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), 'assets', 'templates', 'delivery_note_blank.pdf');
  let doc: PDFDocument;

  if (fs.existsSync(templatePath)) {
    doc = await PDFDocument.load(fs.readFileSync(templatePath));
  } else {
    // Fallback: create fresh document
    doc = await PDFDocument.create();
    doc.addPage([595.28, 841.89]);
  }

  doc.registerFontkit(fontkit);
  const { regular, bold } = getFontBytes();
  const fontReg = await doc.embedFont(regular);
  const fontBold = await doc.embedFont(bold);

  const page = doc.getPages()[0];
  const black = rgb(0, 0, 0);

  // 1. Top Order Info
  if (data.docNum) {
    page.drawText(data.docNum, { x: 395, y: midBaseline(734.1, 752.2, 10), size: 10, font: fontBold, color: black });
  }

  const todayStr = data.deliveryDate || new Date().toLocaleDateString('th-TH');
  const loadDateStr = data.loadDate || todayStr;
  page.drawText(loadDateStr, { x: 348, y: midBaseline(716.0, 734.1, 10), size: 10, font: fontReg, color: black });
  page.drawText(todayStr, { x: 348, y: midBaseline(697.9, 716.0, 10), size: 10, font: fontReg, color: black });

  if (data.customerName) {
    page.drawText(data.customerName, { x: 348, y: midBaseline(679.8, 697.9, 10), size: 10, font: fontBold, color: black });
  }
  if (data.forwardTo) {
    page.drawText(data.forwardTo, { x: 348, y: midBaseline(661.7, 679.8, 10), size: 10, font: fontReg, color: black });
  }

  // Only draw company/sender if different from the template's baked-in text ("FORMICA" / "DD Service And Transport")
  if (data.company && data.company !== 'FORMICA') {
    page.drawText(data.company, { x: 105, y: midBaseline(716.0, 734.1, 10), size: 10, font: fontReg, color: black });
  }
  if (data.senderName && data.senderName !== 'DD Service And Transport') {
    page.drawText(data.senderName, { x: 105, y: midBaseline(697.9, 716.0, 10), size: 10, font: fontReg, color: black });
  }
  if (data.vehiclePlate) {
    page.drawText(data.vehiclePlate, { x: 105, y: midBaseline(679.8, 697.9, 10), size: 10, font: fontReg, color: black });
  }

  // 2. Items (21 แถวตามแม่แบบ) — เดิมเริ่ม y=608 ซึ่งคือเส้นใต้แถวแรกพอดี และลดทีละ 17.5
  //    ขณะที่แถวจริงสูง ~18.09 ตัวหนังสือจึงนั่งบนเส้น
  if (data.items.length > DN_ITEM_ROWS) {
    console.warn(`[generateDeliveryNotePdf] ${data.items.length} items; template fits ${DN_ITEM_ROWS}`);
  }
  for (let i = 0; i < Math.min(data.items.length, DN_ITEM_ROWS); i++) {
    const item = data.items[i];
    const rowTop = DN_ITEM_TOP - i * DN_ROW_H;
    const y = midBaseline(rowTop - DN_ROW_H, rowTop, 10);

    if (item.seq !== undefined && item.seq !== '') {
      drawCentered(page, String(item.seq), (DN_COLS.seq[0] + DN_COLS.seq[1]) / 2, y, 10, fontReg, black);
    }
    if (item.orderNo) {
      drawCentered(page, String(item.orderNo), (DN_COLS.order[0] + DN_COLS.order[1]) / 2, y, 10, fontReg, black);
    }
    if (item.itemCode || item.description) {
      const itemDesc = item.description || item.itemCode || '';
      drawCentered(page, itemDesc, (DN_COLS.item[0] + DN_COLS.item[1]) / 2, y, 10, fontReg, black);
    }
    if (item.quantity !== undefined && item.quantity !== '') {
      const qNum = Number(item.quantity) || 0;
      const qText = `${qNum.toLocaleString()}`;
      const qW = fontReg.widthOfTextAtSize(qText, 10);
      page.drawText(qText, { x: DN_COLS.qtyRight - qW, y, size: 10, font: fontReg, color: black });
    }
  }

  // 3. Signature Image Overlay (Customer Signature)
  if (data.signature) {
    try {
      let imageBytes: Uint8Array | ArrayBuffer;
      let isPng = true;
      if (data.signature.startsWith('data:')) {
        const mime = data.signature.match(/data:([^;]+);/)?.[1] || 'image/png';
        isPng = mime === 'image/png';
        const base64 = data.signature.split(',')[1];
        // ส่ง Buffer ตรงๆ ห้ามใช้ .buffer — รูปเล็กกว่า 4KB Node จะใช้ pool ร่วม
        // .buffer จึงได้ ArrayBuffer ทั้ง pool (ขยะ) แล้ว embed ล้ม ลายเซ็นหายเงียบๆ
        imageBytes = Buffer.from(base64, 'base64');
      } else {
        isPng = !data.signature.toLowerCase().endsWith('.jpg') && !data.signature.toLowerCase().endsWith('.jpeg');
        imageBytes = await fetch(data.signature).then(r => r.arrayBuffer());
      }

      const sigImage = isPng
        ? await doc.embedPng(imageBytes)
        : await doc.embedJpg(imageBytes);

      // กล่อง 150x70 เหนือคำว่า "ผู้รับสินค้า (Customer)" วางชิดล่างให้เหมือนเซ็นบนเส้น
      // (มือถือ crop ให้เหลือแต่เส้นหมึกแล้ว จึงขยายได้เต็มกล่อง — เดิมส่งทั้งผืนผ้าใบขาวมา
      //  แล้วย่อลงกล่อง 85x40 ลายเซ็นจริงเลยเล็กนิดเดียว)
      const { centerX, bottom, width: boxW, height: boxH } = DN_SIG_BOX;
      const scale = Math.min(boxW / sigImage.width, boxH / sigImage.height);
      const finalW = sigImage.width * scale;
      const finalH = sigImage.height * scale;
      const sigX = centerX - finalW / 2;
      const sigY = bottom;

      page.drawImage(sigImage, {
        x: sigX,
        y: sigY,
        width: finalW,
        height: finalH,
      });
    } catch (sigErr) {
      console.error("[generateDeliveryNotePdf] Failed to overlay signature:", sigErr);
    }
  }

  return await doc.save();
}
