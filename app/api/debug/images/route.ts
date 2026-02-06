
import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const products = await getProducts();
        
        const debugData = products.map((p: any) => ({
            name: p.name,
            image: p.image,
            // Check if it looks like a direct link
            isDirect: p.image?.includes('uc?export=view')
        })).filter((p: any) => p.image); // Only show items with images

        return NextResponse.json({ 
            count: products.length,
            withImages: debugData.length,
            sample: debugData.slice(0, 10) 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
