import { NextResponse } from 'next/server';
import { getProducts, addProduct, editProduct } from '@/lib/googleSheets';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || undefined;
    const products = await getProducts(branchId);
    return NextResponse.json(products);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Validation
        if (!body.name) return NextResponse.json({ error: "Product Name is required" }, { status: 400 });
        
        const success = await addProduct(body);
        if (success) {
            return NextResponse.json({ success: true });
        } else {
             return NextResponse.json({ error: "Failed to add product" }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Add Product Error:", error);
         return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        if (!body.oldName || !body.updates) {
             return NextResponse.json({ error: "Missing oldName or updates" }, { status: 400 });
        }

        const success = await editProduct(body.oldName, body.updates);
        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Failed to update product (not found?)" }, { status: 404 });
        }

    } catch (error: any) {
        console.error("Edit Product Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
