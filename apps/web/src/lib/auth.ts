import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import { authorizeCredentials } from './authorize';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;
        return authorizeCredentials({
          email: credentials.email,
          password: credentials.password,
        });
      },
    }),
  ],
  // JWT strategy — sessions are stored in signed cookies, not the database.
  // PrismaAdapter is still used for OAuth account/user creation.
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
        // Look up username once at sign-in and cache in JWT (no per-request DB query)
        const profile = await prisma.profile.findUnique({
          where: { userId: user.id },
          select: { username: true },
        });
        token.username = profile?.username ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
        if (token.username) session.user.username = token.username;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
