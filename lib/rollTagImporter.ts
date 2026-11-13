import { resolveSpreadsheetId, getSheetData, appendSheetData } from '@/lib/googleSheets';
import { STATUS_PENDING_ROLLTAG } from '@/lib/orderUtils';
import { getThaiDateString } from '@/lib/dateUtils';
import { invalidateStatusCache } from '@/lib/orderStatusCache';

export interface RollTagInputItem {
  orderNo: string;
  itemCode: string;
  quantity: number | string;
}

export interface RollTagCustomerInput {
  customerId: string;
  items: RollTagInputItem[];
}

export interface CreatedRollTagResult {
  tagId: string;
  customer: string;
  itemCount: number;
}

export async function createPendingRollTags(
  customers: RollTagCustomerInput[],
  branchId?: string | null
): Promise<CreatedRollTagResult[]> {
  const ssId = await resolveSpreadsheetId(branchId || null, 'doc');

  // Read existing pending Roll Tags in คลังข้อมูล to determine next available RT numbers
  const archiveData = await getSheetData(ssId, "'คลังข้อมูล'!A:I").catch(() => []);
  const usedRtNums = new Set<number>();

  if (archiveData && archiveData.length > 1) {
    for (let r = 1; r < archiveData.length; r++) {
      const row = archiveData[r];
      const docNum = String(row?.[0] || '').trim();
      const status = String(row?.[6] || '').trim();
      if (status === STATUS_PENDING_ROLLTAG) {
        const match = docNum.match(/^RT(\d+)$/i);
        if (match) {
          usedRtNums.add(parseInt(match[1], 10));
        }
      }
    }
  }

  let nextRtCounter = 1;
  const allocateNextRtId = (): string => {
    while (usedRtNums.has(nextRtCounter)) {
      nextRtCounter++;
    }
    const id = `RT${nextRtCounter}`;
    usedRtNums.add(nextRtCounter);
    return id;
  };

  const createdResults: CreatedRollTagResult[] = [];

  for (const customerData of customers) {
    if (!customerData.items || customerData.items.length === 0) {
      continue;
    }

    const targetTagId = allocateNextRtId();
    const today = getThaiDateString();

    // Col schema: [DocNum, CustName, Seq, OrderNo, ItemCode, Qty, Status, Link, Date]
    const rowsToAppend = customerData.items.map((item, idx) => [
      targetTagId,
      customerData.customerId,
      idx + 1,
      item.orderNo || "",
      item.itemCode || "",
      item.quantity ?? "",
      STATUS_PENDING_ROLLTAG,
      "",
      today
    ]);

    await appendSheetData(ssId, "'คลังข้อมูล'!A:I", rowsToAppend, 'INSERT_ROWS');

    createdResults.push({
      tagId: targetTagId,
      customer: customerData.customerId,
      itemCount: customerData.items.length
    });
  }

  if (createdResults.length > 0) {
    invalidateStatusCache(ssId);
  }

  return createdResults;
}
