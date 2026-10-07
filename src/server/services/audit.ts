import { getDb, type DbOrTx } from "@/server/db";
import { auditLogs } from "@/server/db/schema";

type AuditInput = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Best-effort audit trail. Never include passwords, tokens or other secrets in metadata. */
export async function writeAudit(input: AuditInput, db: DbOrTx = getDb()): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.error(`[audit] failed to write ${input.action}: ${(err as Error).message}`);
  }
}
