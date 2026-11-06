import { NextResponse } from 'next/server';
import { resolveSpreadsheetId } from '@/lib/googleSheets';
import { invalidateStatusCache } from '@/lib/orderStatusCache';
import { withFormLock, reopenOrderForSignature, lockErrorStatus } from '@/lib/orderUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ดึงงานที่เสร็จสิ้นแล้วกลับมาให้ลงนามใหม่ (Re-sign POD)
export async function POST(request: Request) {
  try {
      const { docNum, branchId, reason } = await request.json();
      if (!docNum) return NextResponse.json({ error: "Missing docNum" }, { status: 400, headers: corsHeaders });

      const ssid = await resolveSpreadsheetId(branchId, 'doc');
      invalidateStatusCache(ssid);

      const result = await withFormLock(ssid, async () => {
          const res = await reopenOrderForSignature(ssid, String(docNum).trim());
          
          // Audit Log
          try {
              const { logAction } = await import('@/lib/auditTrail');
              await logAction({
                  userId: 'Admin/Supervisor',
                  userName: 'Order Supervisor',
                  action: 'UPDATE',
                  module: 'Outbound',
                  description: `Reopened Order [${docNum}] for re-signing. Reason: ${reason || 'แก้ไขลายเซ็น/ลายเซ็นไม่ติด'}`,
                  newValues: { docNum, reason }
              });
          } catch (auditErr) {
              console.warn("[Reopen] Audit log warning:", auditErr);
          }

          return res;
      });

      return NextResponse.json({ 
          ...result,
          message: `ดึงออเดอร์ [${docNum}] กลับมาให้ลงนามใหม่เรียบร้อยแล้ว (สถานะ: รอลูกค้า)`, 
      }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Reopen Order Error:", error);
    const status = /not found/i.test(error?.message || '') ? 404 : lockErrorStatus(error);
    return NextResponse.json({ error: error.message }, { status, headers: corsHeaders });
  }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export const maxDuration = 60;
