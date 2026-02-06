import { withAuth } from "next-auth/middleware"

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req) {
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
  ],
}
