import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { editProduct, ProductLocationConflictError } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { branchId, oldName, updates } = body;

    if (!oldName || !updates) {
      return NextResponse.json({ error: "Missing oldName or updates" }, { status: 400 });
    }

    const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
    const targetSheetId = await resolveSpreadsheetId(branchId, 'inventory');

    const success = await editProduct(oldName, updates, targetSheetId);
    if (!success) {
      return NextResponse.json({ error: "Failed to update product in ชื่อสินค้า" }, { status: 404 });
    }

    try {
      const { logAction } = await import('@/lib/auditTrail');
      // @ts-ignore
      const session = await getServerSession(authOptions);

      await logAction({
        userId: session?.user?.email || 'System',
        userName: session?.user?.name || 'Inventory Manager',
        action: 'UPDATE',
        module: 'Inventory',
        description: `Updated product master data: ${oldName}`,
        newValues: updates,
      });
    } catch (auditErr) {
      console.warn("Audit Log Failed:", auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Product Update Error:", error);
    if (error instanceof ProductLocationConflictError) {
      return NextResponse.json(
        { error: error.message, conflict: error.conflict },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
