export type PrintNodeJob = {
  title: string;
  pdfBase64: string;
  printerId?: string | number;
};

export type PrintNodeResult = {
  ok: boolean;
  printJobId?: number;
  skipped?: boolean;
  error?: string;
};

function getPrintNodeConfig() {
  return {
    apiKey: process.env.PRINTNODE_API_KEY,
    printerId: process.env.PRINTNODE_PRINTER_ID,
  };
}

export function isPrintNodeConfigured() {
  const { apiKey, printerId } = getPrintNodeConfig();
  return Boolean(apiKey && printerId);
}

export async function submitPrintNodePdfJob(job: PrintNodeJob): Promise<PrintNodeResult> {
  const { apiKey, printerId } = getPrintNodeConfig();
  const targetPrinterId = job.printerId || printerId;

  if (!apiKey || !targetPrinterId) {
    return {
      ok: false,
      skipped: true,
      error: 'PrintNode is not configured. Set PRINTNODE_API_KEY and PRINTNODE_PRINTER_ID.',
    };
  }

  const authToken = Buffer.from(`${apiKey}:`).toString('base64');

  const res = await fetch('https://api.printnode.com/printjobs', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      printerId: Number(targetPrinterId),
      title: job.title,
      contentType: 'pdf_base64',
      content: job.pdfBase64,
      source: 'WMS 360 PRO',
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    return {
      ok: false,
      error: text || `PrintNode print job failed (${res.status})`,
    };
  }

  const printJobId = Number(text);

  return {
    ok: true,
    printJobId: Number.isFinite(printJobId) ? printJobId : undefined,
  };
}
