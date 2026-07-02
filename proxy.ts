import { withAuth } from "next-auth/middleware"
import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Page guard (redirects to /login) — unchanged behavior.
const pageAuth = withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function proxy(req) {
    // Custom Logic if needed
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // 1. Require Token for protected routes
        if (!token) return false;

        const path = req.nextUrl.pathname;
        const role = token.role as string;

        // 2. Viewer & User Restrictions
        if (role === 'Viewer') {
           if (path.startsWith('/orders') ||
               path.startsWith('/ops/inbound') ||
               path.startsWith('/ops/outbound') ||
               path.startsWith('/admin/users')) {
               return false;
           }
        }

        // Block Standard User from Admin Pages
        if (role === 'User') {
            if (path.startsWith('/admin/users')) {
                return false;
            }
        }

        return true;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
)

// API guard (returns 401 JSON instead of redirecting). Closes the gap where
// 57 of 66 /api routes were callable without a session.
// Public exceptions:
//  - /api/auth/* — NextAuth's own endpoints (login must work logged-out)
//  - /api/cron/* — protected by their own CRON_SECRET bearer check
export default async function proxy(req: NextRequest, event: any) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/cron')) {
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

  return (pageAuth as any)(req, event);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/inventory/:path*",
    "/ops/:path*",
    "/stock-card/:path*",
    "/po-log/:path*",
    "/orders/:path*",
    "/mobile/:path*",
    "/admin/:path*",
    "/damage/:path*",
    "/analytics/:path*",
    "/api/:path*",
  ],
}
