import { NextResponse } from 'next/server';
import { getProducts, getBranchesFromSheet } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const branches = await getBranchesFromSheet();
        const statsPromises = branches.map(async (branch) => {
            try {
                const products = await getProducts(branch.spreadsheetId);
                
                const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
                const totalValue = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
                const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
                const activeCount = products.filter(p => p.status !== 'Inactive').length;

                return {
                    id: branch.id,
                    name: branch.name,
                    color: branch.color,
                    totalStock,
                    totalValue,
                    lowStockCount,
                    activeCount,
                    status: 'Online'
                };
            } catch (err) {
                console.error(`Failed to fetch stats for branch ${branch.name}:`, err);
                return {
                    id: branch.id,
                    name: branch.name,
                    color: branch.color,
                    totalStock: 0,
                    totalValue: 0,
                    lowStockCount: 0,
                    activeCount: 0,
                    status: 'Offline'
                };
            }
        });

        const results = await Promise.all(statsPromises);
        
        // Calculate Global Totals
        const globalTotal = {
            totalStock: results.reduce((sum, r) => sum + r.totalStock, 0),
            totalValue: results.reduce((sum, r) => sum + r.totalValue, 0),
            lowStockCount: results.reduce((sum, r) => sum + r.lowStockCount, 0)
        };

        return NextResponse.json({
            branches: results,
            global: globalTotal
        });

    } catch (error) {
        console.error("HQ Stats API Error:", error);
        return NextResponse.json({ error: "Failed to fetch HQ stats" }, { status: 500 });
    }
}
