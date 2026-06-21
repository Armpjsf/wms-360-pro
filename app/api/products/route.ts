import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getProducts, addProduct, editProduct, getBranchSpreadsheetId, ProductLocationConflictError } from '@/lib/googleSheets';

export async function GET(request: Request) {
    try {
        // @ts-ignore
        const session = await getServerSession(authOptions);
        const allowedOwners = (session?.user as any)?.allowedOwners;
        
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get('branchId');
        
        const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
        const targetSheetId = await resolveSpreadsheetId(branchId, 'inventory');
        
        // Manual Revalidate Trigger
        if (searchParams.get('revalidate') === 'true') {
            // @ts-ignore
            revalidateTag('products-sheet-only-v3');
            console.log("Manual revalidation triggered for 'products-sheet-only-v3'");
        }
    
        // Pass allowedOwners to filtered fetcher
        console.log(`[API] Fetching products for branch: ${branchId || 'HQ'} -> SSID: ${targetSheetId}`);
        const products = await getProducts(targetSheetId, allowedOwners);
        
        // Debug: Log first 3 products' movement status
        if (products.length > 0) {
            console.log("API Products Debug (First 3):", products.slice(0, 3).map((p: any) => ({
                id: p.id,
                name: p.name,
                movementStatus: p.movementStatus
            })));
        }
    
        return NextResponse.json(products);
    } catch (error: any) {
        console.error("API GET Products Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { branchId, ...productData } = body;
        
        // Validation
        if (!productData.name) return NextResponse.json({ error: "Product Name is required" }, { status: 400 });
        
        const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
        const targetSheetId = await resolveSpreadsheetId(branchId, 'inventory');

        console.log(`[API] Adding product to branch: ${branchId || 'HQ'} -> SSID: ${targetSheetId}`);
        const success = await addProduct(productData, targetSheetId);
        if (success) {
            // Audit Log
            try {
                const { logAction } = await import('@/lib/auditTrail');
                const { getServerSession } = await import("next-auth/next");
                const { authOptions } = await import("@/lib/auth");
                // @ts-ignore
                const session = await getServerSession(authOptions);

                await logAction({
                    userId: session?.user?.email || 'System',
                    userName: session?.user?.name || 'Inventory Manager',
                    action: 'CREATE',
                    module: 'Inventory',
                    description: `Added new product: ${productData.name}`,
                    newValues: productData
                });
            } catch (auditErr) {
                console.warn("Audit Log Failed:", auditErr);
            }

            return NextResponse.json({ success: true });
        } else {
             return NextResponse.json({ error: "Failed to add product" }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Add Product Error:", error);
        if (error instanceof ProductLocationConflictError) {
            return NextResponse.json(
                { error: error.message, conflict: error.conflict },
                { status: 409 }
            );
        }
         return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { branchId, oldName, updates } = body;

        if (!oldName || !updates) {
             return NextResponse.json({ error: "Missing oldName or updates" }, { status: 400 });
        }

        const { resolveSpreadsheetId } = await import('@/lib/googleSheets');
        const targetSheetId = await resolveSpreadsheetId(branchId, 'inventory');

        console.log(`[API] Editing product in branch: ${branchId || 'HQ'} -> SSID: ${targetSheetId}`);
        const success = await editProduct(oldName, updates, targetSheetId);
        if (success) {
            // Audit Log
            try {
                const { logAction } = await import('@/lib/auditTrail');
                const { getServerSession } = await import("next-auth/next");
                const { authOptions } = await import("@/lib/auth");
                // @ts-ignore
                const session = await getServerSession(authOptions);

                await logAction({
                    userId: session?.user?.email || 'System',
                    userName: session?.user?.name || 'Inventory Manager',
                    action: 'UPDATE',
                    module: 'Inventory',
                    description: `Updated product: ${oldName}`,
                    newValues: updates
                });
            } catch (auditErr) {
                console.warn("Audit Log Failed:", auditErr);
            }

            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Failed to update product (not found?)" }, { status: 404 });
        }

    } catch (error: any) {
        console.error("Edit Product Error:", error);
        if (error instanceof ProductLocationConflictError) {
            return NextResponse.json(
                { error: error.message, conflict: error.conflict },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
