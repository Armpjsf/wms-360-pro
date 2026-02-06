import { NextResponse } from 'next/server';
import { getPOLogs } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const logs = await getPOLogs();
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("PO Log API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
