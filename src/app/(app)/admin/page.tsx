import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isStaffRole } from "@/lib/constants";
import { getSession } from "@/server/auth/session";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = { title: "Admin" };

export default async function Page() {
  const session = await getSession();
  if (!session || !isStaffRole(session.user.role)) notFound();
  return <AdminDashboard role={session.user.role} />;
}
