import { and, eq, gt, isNull, or } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/server/db";
import { authTokens, profiles, userSettings, users } from "@/server/db/schema";
import { passwordResetEmail, sendEmail, verificationEmail } from "@/server/auth/email";
import { hashPassword, verifyDummy, verifyPassword } from "@/server/auth/password";
import { createSession, revokeAllSessions } from "@/server/auth/session";
import { ApiError, badRequest, conflict } from "@/server/http/errors";
import { randomToken, sha256Hex } from "@/server/lib/ids";
import { isValidTimezone } from "@/lib/tz";
import type { LoginInput, RegisterInput } from "@/lib/validators/auth";
import { writeAudit } from "./audit";

const HOUR = 60 * 60 * 1000;

async function issueToken(userId: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET", ttlMs: number) {
  const token = randomToken(32);
  const db = getDb();
  // One live token per user/type.
  await db.delete(authTokens).where(and(eq(authTokens.userId, userId), eq(authTokens.type, type), isNull(authTokens.usedAt)));
  await db.insert(authTokens).values({ userId, type, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

export async function registerUser(input: RegisterInput) {
  const db = getDb();
  const existing = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(or(eq(users.email, input.email), eq(users.username, input.username)));
  if (existing.some((u) => u.username === input.username)) throw conflict("That username is taken", "USERNAME_TAKEN");
  if (existing.some((u) => u.email === input.email)) throw conflict("An account with that email already exists", "EMAIL_TAKEN");

  const passwordHash = await hashPassword(input.password);
  const timezone = input.timezone && isValidTimezone(input.timezone) ? input.timezone : "UTC";

  const user = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ email: input.email, username: input.username, displayName: input.displayName, passwordHash })
      .returning();
    await tx.insert(profiles).values({ userId: u.id });
    await tx.insert(userSettings).values({ userId: u.id, timezone });
    return u;
  });

  const token = await issueToken(user.id, "EMAIL_VERIFY", 24 * HOUR);
  after(() => sendEmail(verificationEmail(user.email, user.displayName, token)).catch(() => undefined));
  await writeAudit({ userId: user.id, action: "auth.register", entityType: "user", entityId: user.id });
  await createSession(user.id);
  return user;
}

export async function loginUser(input: LoginInput) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, input.identifier), eq(users.username, input.identifier)))
    .limit(1);
  if (!user || user.status === "deleted") {
    await verifyDummy(input.password);
    throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email/username or password");
  }
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email/username or password");
  if (user.status === "suspended") throw new ApiError(403, "ACCOUNT_SUSPENDED", "This account has been suspended");
  await createSession(user.id);
  await writeAudit({ userId: user.id, action: "auth.login", entityType: "user", entityId: user.id });
  return user;
}

export async function resendVerification(userId: string) {
  const [u] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.emailVerifiedAt) return;
  const token = await issueToken(u.id, "EMAIL_VERIFY", 24 * HOUR);
  after(() => sendEmail(verificationEmail(u.email, u.displayName, token)).catch(() => undefined));
}

export async function verifyEmail(token: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, sha256Hex(token)), eq(authTokens.type, "EMAIL_VERIFY"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .limit(1);
  if (!row) throw badRequest("This verification link is invalid or has expired", "INVALID_TOKEN");
  await db.transaction(async (tx) => {
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
    await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId));
  });
}

export async function requestPasswordReset(email: string) {
  const [u] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  // Always behave identically to avoid revealing which emails are registered.
  if (!u || u.status !== "active") return;
  const token = await issueToken(u.id, "PASSWORD_RESET", HOUR);
  after(() => sendEmail(passwordResetEmail(u.email, u.displayName, token)).catch(() => undefined));
}

export async function resetPassword(token: string, newPassword: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, sha256Hex(token)), eq(authTokens.type, "PASSWORD_RESET"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .limit(1);
  if (!row) throw badRequest("This reset link is invalid or has expired", "INVALID_TOKEN");
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
    await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
  });
  await revokeAllSessions(row.userId);
  await writeAudit({ userId: row.userId, action: "auth.password_reset", entityType: "user", entityId: row.userId });
}

export async function changePassword(userId: string, currentSessionId: string | null, current: string, next: string) {
  const db = getDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || !(await verifyPassword(u.passwordHash, current))) {
    throw new ApiError(403, "INVALID_CREDENTIALS", "Your current password is incorrect");
  }
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
  await revokeAllSessions(userId, currentSessionId ?? undefined);
  await writeAudit({ userId, action: "auth.password_change", entityType: "user", entityId: userId });
}
