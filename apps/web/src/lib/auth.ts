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
    jwt({ token, user }) {
      // Attach user ID to the JWT on initial sign-in
      if (user?.id) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      // Expose user ID in the session object available to client components
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
