import { NextResponse } from 'next/server';
import {
  resolveSpreadsheetId,
  batchUpdateSheetData,
  appendSheetData,
  deleteSheetRows,
} from '@/lib/googleSheets';
import {
  withFormLock,
  readArchive,
  STATUS_DONE,
  STATUS_PENDING_ROLLTAG,
} from '@/lib/orderUtils';
import { writeReversalTransaction, writeTransactionData } from '@/lib/transactionUtils';
import { invalidateStatusCache } from '@/lib/orderStatusCache';
import { getThaiDateString } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { docNum, branchId, items } = body;

    if (!docNum || !String(docNum).trim()) {
      return NextResponse.json({ error: 'Missing docNum' }, { status: 400, headers: corsHeaders });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' }, { status: 400, headers: corsHeaders });
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.itemCode || !String(it.itemCode).trim()) {
        return NextResponse.json({ error: `กรุณาระบุรหัสสินค้า (Item Code) ในรายการที่ ${i + 1}` }, { status: 400, headers: corsHeaders });
      }
      if (Number(it.qty) <= 0 || isNaN(Number(it.qty))) {
        return NextResponse.json({ error: `จำนวนสินค้าของ ${it.itemCode} ต้องมากกว่า 0` }, { status: 400, headers: corsHeaders });
      }
    }

    const targetDoc = String(docNum).trim();
    const ssid = await resolveSpreadsheetId(branchId, 'doc');
    const invSSID = await resolveSpreadsheetId(branchId, 'inventory');

    console.log(`[Edit Items] Request for ${targetDoc} on SSID: ${ssid}`);
    invalidateStatusCache(ssid);

    return await withFormLock(ssid, async () => {
      const archiveData = await readArchive(ssid);
      if (!archiveData || archiveData.length <= 1) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลในคลังข้อมูล' }, { status: 404, headers: corsHeaders });
      }

      // Find matching row indices (1-based)
      const matchingRowIndices: number[] = [];
      const matchingRows: any[][] = [];
      let resolvedDocNum = targetDoc;

      for (let i = 1; i < archiveData.length; i++) {
        const row = archiveData[i];
        const dNum = String(row[0] || '').trim();
        const ordNo = String(row[3] || '').trim();

        if (dNum.toUpperCase() === targetDoc.toUpperCase()) {
          matchingRowIndices.push(i + 1); // 1-based row in sheet
          matchingRows.push(row);
          resolvedDocNum = dNum;
        } else if (ordNo.toUpperCase() === targetDoc.toUpperCase()) {
          matchingRowIndices.push(i + 1);
          matchingRows.push(row);
          resolvedDocNum = dNum;
        }
      }

      if (matchingRows.length === 0) {
        return NextResponse.json({ error: `ไม่พบเอกสารหมายเลข ${targetDoc} ในคลังข้อมูล` }, { status: 404, headers: corsHeaders });
      }

      // If all rows are completed, reject
      const isCompleted = matchingRows.every(r => String(r[6] || '').trim() === STATUS_DONE);
      if (isCompleted) {
        return NextResponse.json(
          { error: `เอกสาร ${resolvedDocNum} จัดส่งเสร็จสิ้นและออกใบส่งแล้ว ไม่สามารถแก้ไขรายการสินค้าได้` },
          { status: 400, headers: corsHeaders }
        );
      }

      const custName = String(matchingRows[0][1] || '').trim();
      const currentStatus = String(matchingRows[0][6] || STATUS_PENDING_ROLLTAG).trim();
      const currentLink = String(matchingRows[0][7] || '').trim();
      const currentDate = String(matchingRows[0][8] || '').trim() || getThaiDateString();
      const fallbackOrderNo = String(matchingRows[0][3] || '').trim();

      // Check if transactions were already written (e.g. status is "กำลังดำเนินการ" or "รอลูกค้า")
      const hasWrittenTransactions = currentStatus !== STATUS_PENDING_ROLLTAG;

      if (hasWrittenTransactions) {
        const oldItemsToReverse = matchingRows
          .map(r => ({
            itemCode: String(r[4] || '').trim(),
            quantity: Number(r[5]) || 0,
            orderNumber: String(r[3] || '').trim(),
            docNumber: resolvedDocNum,
          }))
          .filter(it => it.itemCode && it.quantity > 0);

        const newItemsToWrite = items.map((it: any) => ({
          itemCode: String(it.itemCode).trim().toUpperCase(),
          quantity: Number(it.qty) || 0,
          orderNumber: String(it.orderNo || fallbackOrderNo).trim(),
          docNumber: resolvedDocNum,
        }));

        if (oldItemsToReverse.length > 0) {
          try {
            await writeReversalTransaction(
              oldItemsToReverse,
              invSSID,
              `แก้ไขรายการสินค้า (Reversal) ${resolvedDocNum}`
            );
            console.log(`[Edit Items] Reversed ${oldItemsToReverse.length} items`);
          } catch (e) {
            console.error('[Edit Items] Reversal transaction error:', e);
          }
        }

        if (newItemsToWrite.length > 0) {
          try {
            await writeTransactionData(newItemsToWrite, invSSID);
            console.log(`[Edit Items] Written ${newItemsToWrite.length} new items to transaction`);
          } catch (e) {
            console.error('[Edit Items] Write transaction error:', e);
          }
        }
      }

      // Update rows in 'คลังข้อมูล'!A:I
      const M = matchingRowIndices.length;
      const N = items.length;
      const updates: Array<{ range: string; values: any[][] }> = [];

      for (let i = 0; i < Math.min(M, N); i++) {
        const rowNum = matchingRowIndices[i];
        const it = items[i];
        const ordNo = String(it.orderNo || matchingRows[i]?.[3] || fallbackOrderNo).trim();
        const itemCode = String(it.itemCode).trim().toUpperCase();
        const qty = Number(it.qty) || 1;

        updates.push({
          range: `'คลังข้อมูล'!A${rowNum}:I${rowNum}`,
          values: [[
            resolvedDocNum,
            custName,
            i + 1,
            ordNo,
            itemCode,
            qty,
            currentStatus,
            currentLink,
            currentDate,
          ]],
        });
      }

      if (updates.length > 0) {
        await batchUpdateSheetData(ssid, updates);
        console.log(`[Edit Items] Updated ${updates.length} rows in คลังข้อมูล`);
      }

      // If more items added (N > M)
      if (N > M) {
        const extraRows = [];
        for (let i = M; i < N; i++) {
          const it = items[i];
          const ordNo = String(it.orderNo || fallbackOrderNo).trim();
          const itemCode = String(it.itemCode).trim().toUpperCase();
          const qty = Number(it.qty) || 1;
          extraRows.push([
            resolvedDocNum,
            custName,
            i + 1,
            ordNo,
            itemCode,
            qty,
            currentStatus,
            currentLink,
            currentDate,
          ]);
        }
        await appendSheetData(ssid, "'คลังข้อมูล'!A:I", extraRows, 'INSERT_ROWS');
        console.log(`[Edit Items] Appended ${extraRows.length} extra rows in คลังข้อมูล`);
      }

      // If fewer items (N < M)
      if (N < M) {
        const extraIndices = matchingRowIndices.slice(N);
        await deleteSheetRows(ssid, 'คลังข้อมูล', extraIndices);
        console.log(`[Edit Items] Deleted ${extraIndices.length} excess rows in คลังข้อมูล`);
      }

      invalidateStatusCache(ssid);

      return NextResponse.json({
        success: true,
        message: `แก้ไขรายการสินค้าของ ${resolvedDocNum} สำเร็จ (${N} รายการ)`,
        docNum: resolvedDocNum,
      }, { headers: corsHeaders });
    });
  } catch (error) {
    console.error('API /api/orders/edit-items error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500, headers: corsHeaders });
  }
}
