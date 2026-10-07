import { eq, or } from "drizzle-orm";
import { RESERVED_USERNAMES, USERNAME_REGEX } from "@/lib/constants";
import { hashPassword } from "@/server/auth/password";
import { createSession, getSession } from "@/server/auth/session";
import { config } from "@/server/config";
import { getDb } from "@/server/db";
import { profiles, userSettings, users } from "@/server/db/schema";
import { ApiError, conflict } from "@/server/http/errors";
import { randomToken } from "@/server/lib/ids";
import { writeAudit } from "./audit";

type GoogleProfile = { sub: string; email: string; email_verified?: boolean; name?: string };

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new ApiError(401, "OAUTH_FAILED", "Google sign-in failed");
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) throw new ApiError(401, "OAUTH_FAILED", "Google sign-in failed");
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  if (!profileRes.ok) throw new ApiError(401, "OAUTH_FAILED", "Google sign-in failed");
  const profile = (await profileRes.json()) as GoogleProfile;
  if (!profile.sub || !profile.email) throw new ApiError(401, "OAUTH_FAILED", "Google did not return an email");
  return { ...profile, email: profile.email.trim().toLowerCase() };
}

async function uniqueUsername(base: string) {
  const db = getDb();
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const [hit] = await db.select({ id: users.id }).from(users).where(eq(users.username, candidate)).limit(1);
    if (!hit) return candidate;
    candidate = `${base.slice(0, 16)}${i + 2}`;
  }
  return `user_${randomToken(4).toLowerCase()}`;
}

function usernameFromEmail(email: string) {
  const raw = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "_") ?? "lifter";
  const padded = raw.length < 3 ? `${raw}xx` : raw.slice(0, 20);
  return USERNAME_REGEX.test(padded) && !RESERVED_USERNAMES.has(padded) ? padded : `lifter_${padded.slice(0, 12)}`;
}

export async function loginOrCreateWithGoogle(profile: GoogleProfile) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(or(eq(users.googleSub, profile.sub), eq(users.email, profile.email)))
    .limit(1);
  if (existing) {
    if (existing.status === "deleted") throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email/username or password");
    if (existing.status === "suspended") throw new ApiError(403, "ACCOUNT_SUSPENDED", "This account has been suspended");
    if (existing.googleSub && existing.googleSub !== profile.sub) throw conflict("This email is already on another account", "EMAIL_TAKEN");
    if (existing.googleSub && existing.email !== profile.email && existing.googleSub === profile.sub) {
      /* same Google account, email changed at Google — keep LIFTED email */
    }
    if (!existing.googleSub) {
      await db.update(users).set({ googleSub: profile.sub, emailVerifiedAt: existing.emailVerifiedAt ?? (profile.email_verified ? new Date() : null) }).where(eq(users.id, existing.id));
    }
    await createSession(existing.id);
    await writeAudit({ userId: existing.id, action: "auth.google_login", entityType: "user", entityId: existing.id });
    return existing;
  }

  const username = await uniqueUsername(usernameFromEmail(profile.email));
  const displayName = (profile.name?.trim() || username).slice(0, 80);
  const user = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({
        email: profile.email,
        username,
        displayName,
        passwordHash: await hashPassword(randomToken(32)),
        googleSub: profile.sub,
        emailVerifiedAt: profile.email_verified ? new Date() : null,
        role: config.adminBootstrapEmail && profile.email === config.adminBootstrapEmail ? "admin" : "user",
      })
      .returning();
    await tx.insert(profiles).values({ userId: u.id });
    await tx.insert(userSettings).values({ userId: u.id });
    return u;
  });
  await createSession(user.id);
  await writeAudit({ userId: user.id, action: "auth.google_register", entityType: "user", entityId: user.id });
  return user;
}

export async function linkGoogleToSession(profile: GoogleProfile) {
  const session = await getSession();
  if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue");
  const db = getDb();
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.googleSub, profile.sub)).limit(1);
  if (taken && taken.id !== session.user.id) throw conflict("That Google account is already linked to someone else", "GOOGLE_TAKEN");
  if (session.user.email !== profile.email) {
    const [emailOwner] = await db.select({ id: users.id }).from(users).where(eq(users.email, profile.email)).limit(1);
    if (emailOwner && emailOwner.id !== session.user.id) throw conflict("That Google email belongs to another LIFTED account", "EMAIL_TAKEN");
  }
  await db.update(users).set({ googleSub: profile.sub, emailVerifiedAt: session.user.emailVerifiedAt ?? (profile.email_verified ? new Date() : null) }).where(eq(users.id, session.user.id));
  await writeAudit({ userId: session.user.id, action: "auth.google_link", entityType: "user", entityId: session.user.id });
}

export async function unlinkGoogle(userId: string) {
  const [u] = await getDb().select({ googleSub: users.googleSub }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.googleSub) return;
  await getDb().update(users).set({ googleSub: null }).where(eq(users.id, userId));
  await writeAudit({ userId, action: "auth.google_unlink", entityType: "user", entityId: userId });
}
