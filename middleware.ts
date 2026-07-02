import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * API auth guard. Pages already redirect to /login; this closes the gap where
 * every /api/* route was callable without a session (57 of 66 routes had no
 * auth check at all).
 *
 * Public exceptions:
 *  - /api/auth/*  — NextAuth's own endpoints (login must work logged-out)
 *  - /api/cron/*  — protected by their own CRON_SECRET bearer check
 */
export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/cron')
    ) {
        return NextResponse.next();
    }

    // Let CORS preflights through; the actual request still gets checked.
    if (req.method === 'OPTIONS') {
        return NextResponse.next();
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/api/:path*',
};
