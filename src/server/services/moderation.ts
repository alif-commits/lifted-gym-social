import { and, desc, eq, sql } from "drizzle-orm";
import type { REPORT_REASONS, REPORT_TARGETS } from "@/lib/constants";
import { revokeAllSessions, type SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { activities, comments, moderationActions, reports, users } from "@/server/db/schema";
import { badRequest, conflict, notFound } from "@/server/http/errors";
import { writeAudit } from "./audit";
import { deleteActivityById, getVisibleActivityRow } from "./activities";

type ReportInput = { targetType: (typeof REPORT_TARGETS)[number]; targetId: string; reason: (typeof REPORT_REASONS)[number]; details: string | null };

/** Who owns the reported thing? Also validates that the reporter can actually see it. */
async function resolveTarget(reporter: SessionUser, targetType: ReportInput["targetType"], targetId: string): Promise<string> {
  const db = getDb();
  if (targetType === "ACTIVITY" || targetType === "IMAGE") {
    const { a } = await getVisibleActivityRow(reporter.id, targetId);
    return a.userId;
  }
  if (targetType === "COMMENT") {
    const [c] = await db.select({ userId: comments.userId, activityId: comments.activityId }).from(comments).where(eq(comments.id, targetId)).limit(1);
    if (!c) throw notFound("Comment");
    await getVisibleActivityRow(reporter.id, c.activityId);
    return c.userId;
  }
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
  if (!u) throw notFound("User");
  return u.id;
}

export async function createReport(reporter: SessionUser, input: ReportInput) {
  const ownerId = await resolveTarget(reporter, input.targetType, input.targetId);
  if (ownerId === reporter.id) throw badRequest("You can't report your own content");
  const [dupe] = await getDb()
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.reporterUserId, reporter.id), eq(reports.targetType, input.targetType), eq(reports.targetId, input.targetId), eq(reports.status, "OPEN")))
    .limit(1);
  if (dupe) throw conflict("You've already reported this. We're reviewing it.", "ALREADY_REPORTED");
  const [r] = await getDb().insert(reports).values({ reporterUserId: reporter.id, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details }).returning({ id: reports.id });
  return { id: r.id };
}

export async function listReports(status: string, limit: number) {
  const rows = await getDb()
    .select({
      r: reports,
      reporter: users.username,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterUserId))
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(limit);
  return rows.map(({ r, reporter }) => ({
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.createdAt,
    reporter,
  }));
}

export type ModerationAction = "DISMISS" | "REMOVE_CONTENT" | "SUSPEND_USER";

/** Resolve a report. Every action is recorded in moderation_actions and the audit log. */
export async function resolveReport(moderator: SessionUser, reportId: string, action: ModerationAction, reason: string | null) {
  const db = getDb();
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!report) throw notFound("Report");
  if (report.status !== "OPEN") throw conflict("This report is already resolved", "INVALID_STATE");

  if (action === "REMOVE_CONTENT") {
    if (report.targetType === "COMMENT") {
      await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, report.targetId));
    } else if (report.targetType === "ACTIVITY" || report.targetType === "IMAGE") {
      await deleteActivityById(report.targetId);
    } else {
      throw badRequest("Profiles can't be removed; suspend the user instead");
    }
  }
  if (action === "SUSPEND_USER") {
    const targetUserId = await ownerOf(report.targetType, report.targetId);
    if (!targetUserId) throw notFound("User");
    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, targetUserId)).limit(1);
    if (target?.role !== "user") throw badRequest("Staff accounts can't be suspended here");
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, targetUserId));
    await revokeAllSessions(targetUserId);
  }

  await db.transaction(async (tx) => {
    await tx.update(reports).set({ status: action === "DISMISS" ? "DISMISSED" : "RESOLVED", resolvedAt: new Date() }).where(eq(reports.id, reportId));
    await tx.insert(moderationActions).values({ moderatorUserId: moderator.id, reportId, targetType: report.targetType, targetId: report.targetId, action, reason });
  });
  await writeAudit({ userId: moderator.id, action: `moderation.${action.toLowerCase()}`, entityType: "report", entityId: reportId });
  return { id: reportId, action };
}

async function ownerOf(targetType: string, targetId: string): Promise<string | null> {
  const db = getDb();
  if (targetType === "PROFILE") return targetId;
  if (targetType === "COMMENT") {
    const [c] = await db.select({ u: comments.userId }).from(comments).where(eq(comments.id, targetId)).limit(1);
    return c?.u ?? null;
  }
  const [a] = await db.select({ u: activities.userId }).from(activities).where(eq(activities.id, targetId)).limit(1);
  return a?.u ?? null;
}

export async function reportCounts() {
  const rows = await getDb().select({ status: reports.status, n: sql<number>`count(*)::int` }).from(reports).groupBy(reports.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
