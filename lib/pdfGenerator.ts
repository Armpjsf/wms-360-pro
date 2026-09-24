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
  const sarabunReg = path.join(fontDir, 'Sarabun-Regular.ttf');
  const sarabunBold = path.join(fontDir, 'Sarabun-Bold.ttf');

  if (fs.existsSync(sarabunReg) && fs.existsSync(sarabunBold)) {
    return {
      regular: fs.readFileSync(sarabunReg),
      bold: fs.readFileSync(sarabunBold)
    };
  }

  const regPath = path.join(fontDir, 'tahoma.ttf');
  const boldPath = path.join(fontDir, 'tahomabd.ttf');

  if (fs.existsSync(regPath) && fs.existsSync(boldPath)) {
    return {
      regular: fs.readFileSync(regPath),
      bold: fs.readFileSync(boldPath)
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
    page.drawText(String(data.customerId), { x: 160, y: 437, size: 10, font: fontReg, color: black });
  }
  if (data.customerName) {
    page.drawText(String(data.customerName), { x: 160, y: 419, size: 10, font: fontBold, color: black });
  }
  if (data.note) {
    page.drawText(String(data.note), { x: 160, y: 401, size: 10, font: fontReg, color: black });
  }

  // 2. Dates
  if (data.pickingDate) {
    // Cover formula date if custom date passed
    page.drawRectangle({ x: 655, y: 415, width: 85, height: 16, color: rgb(1, 1, 1) });
    page.drawText(data.pickingDate, { x: 660, y: 420, size: 10, font: fontBold, color: black });
  }
  if (data.shippingDate) {
    page.drawRectangle({ x: 655, y: 397, width: 85, height: 16, color: rgb(1, 1, 1) });
    page.drawText(data.shippingDate, { x: 660, y: 402, size: 10, font: fontBold, color: black });
  }

  // 3. Items (9 rows max)
  const startY = 338;
  const rowStep = 18;
  let totalQty = 0;

  for (let i = 0; i < Math.min(data.items.length, 9); i++) {
    const item = data.items[i];
    const y = startY - (i * rowStep);

    if (item.orderNo) {
      page.drawText(String(item.orderNo), { x: 105, y, size: 10, font: fontReg, color: black });
    }
    if (item.itemCode) {
      page.drawText(String(item.itemCode), { x: 180, y, size: 10, font: fontReg, color: black });
    }
    if (item.description) {
      page.drawText(String(item.description), { x: 380, y, size: 10, font: fontReg, color: black });
    }
    if (item.quantity !== undefined && item.quantity !== '') {
      const qNum = Number(item.quantity) || 0;
      totalQty += qNum;
      const qText = `${qNum.toLocaleString()} `;
      const qW = fontBold.widthOfTextAtSize(qText, 10);
      page.drawText(qText, { x: 740 - qW, y, size: 10, font: fontBold, color: black });
    }
  }

  // 4. Total Quantity
  // Cover template "-  .00"
  page.drawRectangle({ x: 660, y: 198, width: 85, height: 16, color: rgb(1, 1, 1) });
  const totalStr = totalQty > 0 ? `${totalQty.toLocaleString()}.00 ` : "-  .00 ";
  const totalW = fontBold.widthOfTextAtSize(totalStr, 11);
  page.drawText(totalStr, { x: 740 - totalW, y: 202, size: 11, font: fontBold, color: black });

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

  // Cover old leftover signature from original sheet
  page.drawRectangle({
    x: 60,
    y: 110,
    width: 150,
    height: 70,
    color: rgb(1, 1, 1),
  });

  // 1. Top Order Info
  if (data.docNum) {
    page.drawText(data.docNum, { x: 395, y: 739, size: 10, font: fontBold, color: black });
  }

  const todayStr = data.deliveryDate || new Date().toLocaleDateString('th-TH');
  const loadDateStr = data.loadDate || todayStr;
  page.drawText(loadDateStr, { x: 348, y: 722, size: 10, font: fontReg, color: black });
  page.drawText(todayStr, { x: 348, y: 705, size: 10, font: fontReg, color: black });

  if (data.customerName) {
    page.drawText(data.customerName, { x: 348, y: 688, size: 10, font: fontBold, color: black });
  }
  if (data.forwardTo) {
    page.drawText(data.forwardTo, { x: 348, y: 671, size: 10, font: fontReg, color: black });
  }

  if (data.company) {
    page.drawText(data.company, { x: 105, y: 722, size: 10, font: fontReg, color: black });
  }
  if (data.senderName) {
    page.drawText(data.senderName, { x: 105, y: 705, size: 10, font: fontReg, color: black });
  }
  if (data.vehiclePlate) {
    page.drawText(data.vehiclePlate, { x: 105, y: 688, size: 10, font: fontReg, color: black });
  }

  // 2. Items (16 rows max)
  const startY = 608;
  const rowStep = 17.5;

  for (let i = 0; i < Math.min(data.items.length, 16); i++) {
    const item = data.items[i];
    const y = startY - (i * rowStep);

    if (item.seq !== undefined && item.seq !== '') {
      page.drawText(String(item.seq), { x: 75, y, size: 10, font: fontReg, color: black });
    }
    if (item.orderNo) {
      page.drawText(String(item.orderNo), { x: 115, y, size: 10, font: fontReg, color: black });
    }
    if (item.itemCode || item.description) {
      const itemDesc = item.description || item.itemCode || '';
      page.drawText(itemDesc, { x: 235, y, size: 10, font: fontReg, color: black });
    }
    if (item.quantity !== undefined && item.quantity !== '') {
      const qNum = Number(item.quantity) || 0;
      const qText = `${qNum.toLocaleString()}`;
      const qW = fontReg.widthOfTextAtSize(qText, 10);
      page.drawText(qText, { x: 535 - qW, y, size: 10, font: fontReg, color: black });
    }
  }

  // 3. Signature Image Overlay
  if (data.signature) {
    try {
      let imageBytes: ArrayBuffer;
      let isPng = true;
      if (data.signature.startsWith('data:')) {
        const mime = data.signature.match(/data:([^;]+);/)?.[1] || 'image/png';
        isPng = mime === 'image/png';
        const base64 = data.signature.split(',')[1];
        imageBytes = Buffer.from(base64, 'base64').buffer;
      } else {
        isPng = !data.signature.toLowerCase().endsWith('.jpg') && !data.signature.toLowerCase().endsWith('.jpeg');
        imageBytes = await fetch(data.signature).then(r => r.arrayBuffer());
      }

      const sigImage = isPng
        ? await doc.embedPng(imageBytes)
        : await doc.embedJpg(imageBytes);

      // Box is 100 x 50
      const boxW = 100;
      const boxH = 50;
      const scale = Math.min(boxW / sigImage.width, boxH / sigImage.height);
      const finalW = sigImage.width * scale;
      const finalH = sigImage.height * scale;

      // Position in the 3rd column: ผู้รับสินค้า (Customer)
      const sigX = 415 + (110 - finalW) / 2;
      const sigY = 125;

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
