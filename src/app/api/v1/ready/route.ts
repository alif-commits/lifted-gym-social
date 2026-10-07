import { NextResponse } from "next/server";
import { pingDb } from "@/server/db";

/** Readiness: dependencies reachable. */
export async function GET() {
  const db = await pingDb().then(() => true, () => false);
  return NextResponse.json({ status: db ? "ready" : "degraded", checks: { database: db } }, { status: db ? 200 : 503 });
}
