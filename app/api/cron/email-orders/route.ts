import { NextResponse } from 'next/server';
import { submitPrintNodePdfJob } from '@/lib/printNode';
import { acquireSheetLock, releaseSheetLock, PO_SPREADSHEET_ID } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OrderStatus = {
  pending?: Array<{ id: string; customer?: string; itemCount?: number }>;
  activeForm?: { docNum: string; customer?: string } | null;
  waiting?: unknown[];
  completed?: unknown[];
  error?: string;
};

type ProcessResult = {
  tagId: string;
  ok: boolean;
  docId?: string;
  customer?: string;
  itemCount?: number;
  error?: string;
};

type PrintResult = {
  tagId: string;
  ok: boolean;
  required: boolean;
  skipped?: boolean;
  printJobId?: number;
  customer?: string;
  itemCount?: number;
  error?: string;
};

// In-memory guard: fast-path check within the same instance before hitting Sheets
let automationRunning = false;
let automationStartedAt = 0;

const LOCK_TTL_MS = 8 * 60 * 1000;

function isAuthorized(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

function getBaseUrl(req: Request) {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(req.url).origin;
}

function getAutomationBranches() {
  return (process.env.ORDER_AUTOMATION_BRANCH_IDS || 'hq')
    .split(',')
    .map((branchId) => branchId.trim())
    .filter(Boolean);
}

function isPrintRequired() {
  return process.env.ORDER_AUTOMATION_REQUIRE_PRINT !== 'false';
}

async function readStatus(baseUrl: string, branchId: string): Promise<OrderStatus> {
  const statusUrl = new URL('/api/orders/status', baseUrl);
  statusUrl.searchParams.set('branchId', branchId);
  statusUrl.searchParams.set('automation', '1');
  statusUrl.searchParams.set('noCache', '1');
  statusUrl.searchParams.set('t', Date.now().toString());

  const res = await fetch(statusUrl, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    throw new Error(data.error || `Status check failed (${res.status})`);
  }

  return data;
}

async function printRollTag(
  baseUrl: string,
  branchId: string,
  tag: { id: string; customer?: string; itemCount?: number }
): Promise<PrintResult> {
  const required = isPrintRequired();
  const pdfUrl = new URL('/api/print/roll-tag', baseUrl);
  pdfUrl.searchParams.set('tagId', tag.id);
  pdfUrl.searchParams.set('branchId', branchId);
  pdfUrl.searchParams.set('automation', '1');
  pdfUrl.searchParams.set('t', Date.now().toString());

  try {
    const pdfRes = await fetch(pdfUrl, { cache: 'no-store' });

    if (!pdfRes.ok) {
      const errorText = await pdfRes.text().catch(() => '');
      return {
        tagId: tag.id,
        ok: !required,
        required,
        customer: tag.customer,
        itemCount: tag.itemCount,
        error: errorText || `Roll Tag PDF failed (${pdfRes.status})`,
      };
    }

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const printResult = await submitPrintNodePdfJob({
      title: `Roll Tag ${tag.id}${tag.customer ? ` - ${tag.customer}` : ''}`,
      pdfBase64: pdfBuffer.toString('base64'),
    });

    return {
      tagId: tag.id,
      ok: printResult.ok || !required,
      required,
      skipped: printResult.skipped,
      printJobId: printResult.printJobId,
      customer: tag.customer,
      itemCount: tag.itemCount,
      error: printResult.error,
    };
  } catch (error: any) {
    return {
      tagId: tag.id,
      ok: !required,
      required,
      customer: tag.customer,
      itemCount: tag.itemCount,
      error: error.message || 'Roll Tag print failed',
    };
  }
}

async function scanEmail(baseUrl: string) {
  const res = await fetch(new URL('/api/email/scan', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Email scan failed (${res.status})`);
  }

  return data;
}

async function processPendingTags(
  baseUrl: string,
  branchId: string,
  status: OrderStatus
): Promise<{ printResults: PrintResult[]; processResults: ProcessResult[] }> {
  const pending = status.pending || [];
  const printResults: PrintResult[] = [];
  const processResults: ProcessResult[] = [];

  for (const tag of pending) {
    const printResult = await printRollTag(baseUrl, branchId, tag);
    printResults.push(printResult);

    if (!printResult.ok) {
      processResults.push({
        tagId: tag.id,
        ok: false,
        customer: tag.customer,
        itemCount: tag.itemCount,
        error: printResult.required
          ? `Auto process skipped because Roll Tag print failed: ${printResult.error}`
          : printResult.error,
      });
      continue;
    }

    const res = await fetch(new URL('/api/orders/process', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: tag.id, branchId }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));

    processResults.push({
      tagId: tag.id,
      ok: res.ok && !data.error,
      docId: data.docId,
      customer: tag.customer,
      itemCount: tag.itemCount,
      error: data.error,
    });
  }

  return { printResults, processResults };
}

async function runBranchAutomation(baseUrl: string, branchId: string) {
  const beforeScan = await readStatus(baseUrl, branchId);
  const existing = await processPendingTags(baseUrl, branchId, beforeScan);
  const afterExisting = await readStatus(baseUrl, branchId);

  if ((afterExisting.pending?.length || 0) > 0) {
    return {
      branchId,
      scanSkipped: true,
      scanSkipReason: 'Pending Roll Tags remain after the pre-scan processing attempt.',
      scanProcessed: 0,
      existingPrints: existing.printResults,
      existingProcessed: existing.processResults,
      scannedPrints: [],
      scannedProcessed: [],
      finalPending: afterExisting.pending?.length || 0,
      activeForm: afterExisting.activeForm || null,
      waiting: afterExisting.waiting?.length || 0,
    };
  }

  const scan = await scanEmail(baseUrl);
  const afterScan = await readStatus(baseUrl, branchId);
  const scanned = await processPendingTags(baseUrl, branchId, afterScan);
  const finalStatus = await readStatus(baseUrl, branchId);

  return {
    branchId,
    scanProcessed: scan.processed || 0,
    existingPrints: existing.printResults,
    existingProcessed: existing.processResults,
    scannedPrints: scanned.printResults,
    scannedProcessed: scanned.processResults,
    finalPending: finalStatus.pending?.length || 0,
    activeForm: finalStatus.activeForm || null,
    waiting: finalStatus.waiting?.length || 0,
  };
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Fast-path: same-instance check (avoids Sheets API call in common case)
  const now = Date.now();
  if (automationRunning && now - automationStartedAt < LOCK_TTL_MS) {
    return NextResponse.json({
      success: false,
      skipped: true,
      message: 'Email order automation is already running (same instance).',
    });
  }

  // Cross-instance check: acquire distributed lock via Google Sheets
  const locked = await acquireSheetLock(PO_SPREADSHEET_ID);
  if (!locked) {
    return NextResponse.json({
      success: false,
      skipped: true,
      message: 'Email order automation is already running (another instance).',
    });
  }

  automationRunning = true;
  automationStartedAt = now;

  try {
    const baseUrl = getBaseUrl(req);
    const branches = getAutomationBranches();
    const results = [];

    for (const branchId of branches) {
      results.push(await runBranchAutomation(baseUrl, branchId));
    }

    const processResults = results.flatMap((result) => [
      ...result.existingProcessed,
      ...result.scannedProcessed,
    ]);
    const printResults = results.flatMap((result) => [
      ...result.existingPrints,
      ...result.scannedPrints,
    ]);
    const successfulJobs = processResults.filter((result) => result.ok);
    const failedJobs = processResults.filter((result) => !result.ok);
    const successfulPrints = printResults.filter((result) => result.ok && result.printJobId);
    const failedRequiredPrints = printResults.filter((result) => !result.ok && result.required);

    return NextResponse.json({
      success: failedJobs.length === 0 && failedRequiredPrints.length === 0,
      message: `Printed ${successfulPrints.length} Roll Tag(s), processed ${successfulJobs.length} order job(s). Mobile push notifications are sent by the order process step.`,
      printedRollTags: successfulPrints.length,
      failedPrints: failedRequiredPrints.length,
      processedJobs: successfulJobs.length,
      failedJobs: failedJobs.length,
      results,
    });
  } catch (error: any) {
    console.error('[Cron:EmailOrders] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Email order automation failed' },
      { status: 500 }
    );
  } finally {
    automationRunning = false;
    automationStartedAt = 0;
    await releaseSheetLock(PO_SPREADSHEET_ID);
  }
}
