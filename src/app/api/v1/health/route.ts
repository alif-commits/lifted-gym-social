import { NextResponse } from "next/server";

/** Liveness: the process is up. */
export const GET = () => NextResponse.json({ status: "ok" });
