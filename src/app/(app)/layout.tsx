import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { VerifyBanner } from "@/components/app/verify-banner";
import { MeProvider } from "@/lib/client/hooks";
import { toClient } from "@/lib/client/serialize";
import { getSession } from "@/server/auth/session";
import { meDto } from "@/server/services/dto";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const me = toClient(meDto(session.user));
  return (
    <MeProvider initial={me}>
      <AppShell>
        <VerifyBanner />
        {children}
      </AppShell>
    </MeProvider>
  );
}
