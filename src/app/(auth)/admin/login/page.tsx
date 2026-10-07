import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isStaffRole } from "@/lib/constants";
import { getSession } from "@/server/auth/session";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session && isStaffRole(session.user.role)) redirect("/admin");
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
