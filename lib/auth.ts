import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { verifyUser } from "@/lib/users"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        
        const user = await verifyUser(credentials.username, credentials.password)
        
        if (user) {
          return {
              id: user.id || 'admin',
              name: user.username,
              email: user.role, // Hack: Storing Role in Email field since next-auth default user object has email
              allowedBranches: user.allowedBranches,
          }
        }
        return null
      }
    })
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user } : any) {
        if (user) {
            token.role = user.email // Mapping Role
            token.username = user.name
            token.allowedBranches = (user as any).allowedBranches // New
            token.allowedOwners = (user as any).allowedOwners // Enterprise
        }
        return token
    },
    async session({ session, token } : any) {
        if (session.user) {
            (session.user as any).role = token.role;
            (session.user as any).username = token.username;
            (session.user as any).allowedBranches = token.allowedBranches; // New
            (session.user as any).allowedOwners = token.allowedOwners; // Enterprise
        }
        return session
    }
  },
  session: {
      strategy: "jwt",
      maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET || 'secret-key-change-me-in-production',
}
