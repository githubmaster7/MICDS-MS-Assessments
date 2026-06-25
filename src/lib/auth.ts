import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { AccountStatus, Role } from '@prisma/client'
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/constants'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required.')
        }

        const email = credentials.email.toLowerCase().trim()

        // Enforce school domain
        const domain = email.split('@')[1]
        if (domain !== ALLOWED_EMAIL_DOMAIN) {
          throw new Error(`Only @${ALLOWED_EMAIL_DOMAIN} accounts are permitted.`)
        }

        const user = await db.user.findUnique({
          where: { email },
          include: {
            studentProfile: { select: { firstName: true, lastName: true } },
            teacherProfile: { select: { firstName: true, lastName: true } },
            parentProfile:  { select: { firstName: true, lastName: true } },
          },
        })

        if (!user) {
          throw new Error('Invalid email or password.')
        }

        const passwordValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!passwordValid) {
          throw new Error('Invalid email or password.')
        }

        if (user.status === AccountStatus.PENDING_EMAIL_VERIFICATION) {
          throw new Error('Please verify your email address before signing in.')
        }

        if (user.status === AccountStatus.PENDING_ADMIN_APPROVAL) {
          throw new Error('Your account is pending administrator approval.')
        }

        if (user.status === AccountStatus.REJECTED) {
          throw new Error('Your account registration was not approved.')
        }

        if (user.status === AccountStatus.DEACTIVATED) {
          throw new Error('Your account has been deactivated. Contact an administrator.')
        }

        if (user.status !== AccountStatus.ACTIVE) {
          throw new Error('Your account is not active.')
        }

        // Resolve display name from role-specific profile
        let name: string | null = null
        if (user.studentProfile) {
          name = `${user.studentProfile.firstName} ${user.studentProfile.lastName}`
        } else if (user.teacherProfile) {
          name = `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`
        } else if (user.parentProfile) {
          name = `${user.parentProfile.firstName} ${user.parentProfile.lastName}`
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          name,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id     = user.id
        token.role   = (user as typeof user & { role: Role }).role
        token.status = (user as typeof user & { status: AccountStatus }).status
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id     = token.id as string
        session.user.role   = token.role as Role
        session.user.status = token.status as AccountStatus
      }
      return session
    },
  },
}

// Augment next-auth types so callers get full type safety
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: Role
      status: AccountStatus
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    status: AccountStatus
  }
}
