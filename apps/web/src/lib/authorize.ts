import { prisma } from './prisma';
import { verifyPassword } from './password';

export interface AuthorizeInput {
  email: string;
  password: string;
}

export interface AuthorizedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export async function authorizeCredentials(
  input: AuthorizeInput
): Promise<AuthorizedUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
    include: { profile: true },
  });

  if (!user || !user.passwordHash) return null;

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.profile?.displayName ?? null,
    image: user.profile?.avatarUrl ?? null,
  };
}
