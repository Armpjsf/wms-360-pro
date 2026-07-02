import { NextResponse } from 'next/server';
import { archiveCurrentForm } from '@/lib/orderUtils';

export const dynamic = 'force-dynamic';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
  try {
    const { branchId } = await request.json().catch(() => ({}));
    
    // Resolver for Multi-Branch Isolation
    const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
    const ssid = await resolveSpreadsheetId(branchId, 'doc');

    // Only clear the active form. Do NOT clear the Roll Tag source sheets here:
    // `process` already clears the specific Roll Tag it consumes, so wiping both
    // tags would destroy any OTHER pending Roll Tag that hasn't been processed yet
    // (data loss when multiple Roll Tags are staged at once).
    const { clearFormSheet } = await import('@/lib/orderUtils');
    await clearFormSheet(ssid);

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Archive API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}
