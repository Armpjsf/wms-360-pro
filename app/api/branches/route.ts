import { NextResponse } from 'next/server';
import { getBranchesFromSheet, saveBranchToSheet, deleteBranchFromSheet, BranchConfig } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const branches = await getBranchesFromSheet();
        return NextResponse.json(branches);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
    }
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAction } from "@/lib/auditTrail";

// ... existing imports

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const adminUser = session?.user as any;

        const body = await request.json();
        
        // Basic Validation
        if (!body.id || !body.name || !body.spreadsheetId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const newBranch: BranchConfig = {
            id: body.id,
            name: body.name,
            spreadsheetId: body.spreadsheetId,
            color: body.color || 'slate',
            status: 'Active'
        };

        await saveBranchToSheet(newBranch);
        
        await logAction({
             userId: adminUser?.id || 'admin',
             userName: adminUser?.username || 'Unknown Admin',
             action: 'CREATE',
             module: 'branches',
             description: `Created/Updated branch: ${newBranch.name} (${newBranch.id})`,
             newValues: newBranch
        });

        return NextResponse.json({ success: true, branch: newBranch });

    } catch (error) {
        return NextResponse.json({ error: "Failed to save branch" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const adminUser = session?.user as any;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        await deleteBranchFromSheet(id);

        await logAction({
             userId: adminUser?.id || 'admin',
             userName: adminUser?.username || 'Unknown Admin',
             action: 'DELETE',
             module: 'branches',
             description: `Deactivated branch: ${id}`
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 });
    }
}
