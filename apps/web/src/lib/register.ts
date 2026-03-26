import { prisma } from './prisma';
import { hashPassword, validateEmail, validatePassword, validateUsername } from './password';

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
  userId?: string;
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const emailErr = validateEmail(input.email);
  if (emailErr) return { ok: false, error: emailErr };

  const passwordErr = validatePassword(input.password);
  if (passwordErr) return { ok: false, error: passwordErr };

  const usernameErr = validateUsername(input.username);
  if (usernameErr) return { ok: false, error: usernameErr };

  const email = input.email.toLowerCase().trim();
  const username = input.username.trim();

  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.profile.findUnique({ where: { username } }),
  ]);

  if (existingEmail) return { ok: false, error: 'Email already in use' };
  if (existingUsername) return { ok: false, error: 'Username already taken' };

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx: any) => {
    const newUser = await tx.user.create({
      data: { email, passwordHash },
    });
    await tx.profile.create({
      data: {
        userId: newUser.id,
        username,
        displayName: username,
      },
    });
    return newUser;
  });

  return { ok: true, userId: user.id };
}
