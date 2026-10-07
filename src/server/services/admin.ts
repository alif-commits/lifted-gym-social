import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { isAdminRole, isStaffRole, type UserRole } from "@/lib/constants";
import { revokeAllSessions, type SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { activities, reports, users, workouts } from "@/server/db/schema";
import { badRequest, forbidden, notFound } from "@/server/http/errors";
import { decodeCursor, encodeCursor, type Page } from "@/server/lib/cursor";
import { writeAudit } from "./audit";
import { userSummary } from "./dto";

export async function adminStats() {
  const db = getDb();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const count = async (query: Promise<{ n: number }[]>) => (await query)[0]?.n ?? 0;
  const [totalUsers, activeUsers, newUsers7d, workouts7d, workoutsAll, publishedActivities, openReports] = await Promise.all([
    count(db.select({ n: sql<number>`count(*)::int` }).from(users).where(sql`${users.status} <> 'deleted'`)),
    count(db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.status, "active"))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(users).where(and(sql`${users.status} <> 'deleted'`, sql`${users.createdAt} >= ${weekAgo}`))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(workouts).where(and(eq(workouts.status, "COMPLETED"), sql`coalesce(${workouts.completedAt}, ${workouts.startedAt}) >= ${weekAgo}`))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(workouts).where(eq(workouts.status, "COMPLETED"))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(activities).where(eq(activities.status, "PUBLISHED"))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(reports).where(eq(reports.status, "OPEN"))),
  ]);
  return { totalUsers, activeUsers, newUsers7d, workouts7d, workoutsAll, publishedActivities, openReports };
}

export type AdminUserDto = ReturnType<typeof userSummary> & {
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: Date;
  workoutCount: number;
};

function toAdminUser(u: typeof users.$inferSelect, workoutCount: number): AdminUserDto {
  return {
    ...userSummary(u),
    email: u.email,
    role: u.role,
    status: u.status,
    emailVerified: u.emailVerifiedAt !== null,
    createdAt: u.createdAt,
    workoutCount,
  };
}

export async function listAdminUsers(q: string | undefined, status: string | undefined, role: string | undefined, limit: number, cursor?: string): Promise<Page<AdminUserDto>> {
  const db = getDb();
  const c = decodeCursor<{ t: string; id: string }>(cursor);
  const like = q ? `%${q.replace(/[%_\\]/g, "\\$&")}%` : null;
  const rows = await db
    .select({
      u: users,
      workoutCount: sql<number>`(select count(*)::int from workouts w where w.user_id = ${users.id} and w.status = 'COMPLETED')`,
    })
    .from(users)
    .where(
      and(
        status ? eq(users.status, status) : sql`${users.status} <> 'deleted'`,
        role ? eq(users.role, role) : undefined,
        like ? or(ilike(users.email, like), ilike(users.username, like), ilike(users.displayName, like)) : undefined,
        c ? sql`(${users.createdAt}, ${users.id}) < (${c.t}::timestamptz, ${c.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  return {
    items: page.map(({ u, workoutCount }) => toAdminUser(u, workoutCount)),
    next_cursor: rows.length > limit ? encodeCursor({ t: page[page.length - 1].u.createdAt.toISOString(), id: page[page.length - 1].u.id }) : null,
  };
}

export async function updateAdminUser(actor: SessionUser, userId: string, patch: { role?: UserRole; status?: "active" | "suspended" }) {
  if (!isAdminRole(actor.role)) throw forbidden("Only admins can change accounts");
  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target || target.status === "deleted") throw notFound("User");
  if (target.id === actor.id) throw badRequest("You can't change your own role or status");

  if (patch.role && patch.role !== target.role && target.role === "admin" && patch.role !== "admin") {
    const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(and(eq(users.role, "admin"), eq(users.status, "active")));
    if ((n?.n ?? 0) <= 1) throw badRequest("Can't demote the last admin");
  }

  const nextRole = patch.role ?? target.role;
  const nextStatus = patch.status ?? target.status;
  if (nextStatus === "suspended" && isStaffRole(nextRole)) {
    throw badRequest("Demote staff to a regular user before suspending them");
  }

  await db.update(users).set({ role: nextRole, status: nextStatus }).where(eq(users.id, userId));
  if (nextStatus === "suspended" && target.status !== "suspended") await revokeAllSessions(userId);
  await writeAudit({
    userId: actor.id,
    action: "admin.user.update",
    entityType: "user",
    entityId: userId,
    metadata: { role: nextRole, status: nextStatus },
  });
  const [updated] = await db
    .select({
      u: users,
      workoutCount: sql<number>`(select count(*)::int from workouts w where w.user_id = ${users.id} and w.status = 'COMPLETED')`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return toAdminUser(updated!.u, updated!.workoutCount);
}
