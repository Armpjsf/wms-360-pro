import { NextResponse } from 'next/server';
import { getAuditLogs, logAction } from '@/lib/auditTrail';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleFilter = searchParams.get('module') || undefined;
    const action = searchParams.get('action') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');

    const logs = await getAuditLogs({ module: moduleFilter, action, limit });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('[Audit API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const log = await logAction({
      userId: body.userId || 'anonymous',
      userName: body.userName || 'Anonymous User',
      action: body.action || 'VIEW',
      module: body.module || 'unknown',
      recordId: body.recordId,
      description: body.description || 'No description',
      oldValues: body.oldValues,
      newValues: body.newValues
    });

    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('[Audit API] Error:', error);
    return NextResponse.json({ error: 'Failed to log action' }, { status: 500 });
  }
}
