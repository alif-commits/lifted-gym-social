import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AnnouncementBanner } from "@/components/app/announcement-banner";
import { AppShell } from "@/components/app/app-shell";
import { MaintenanceView } from "@/components/app/maintenance-view";
import { VerifyBanner } from "@/components/app/verify-banner";
import { isStaffRole } from "@/lib/constants";
import { MeProvider } from "@/lib/client/hooks";
import { toClient } from "@/lib/client/serialize";
import { getSession } from "@/server/auth/session";
import { meDto } from "@/server/services/dto";
import { getSiteSettings } from "@/server/services/site-settings";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const me = toClient(meDto(session.user));
  const site = await getSiteSettings();
  if (site.maintenanceMode && !isStaffRole(session.user.role)) {
    return (
      <MeProvider initial={me}>
        <MaintenanceView siteName={site.siteName} supportEmail={site.supportEmail} />
      </MeProvider>
    );
  }
  return (
    <MeProvider initial={me}>
      <AppShell>
        <AnnouncementBanner />
        <VerifyBanner />
        {children}
      </AppShell>
    </MeProvider>
  );
}
