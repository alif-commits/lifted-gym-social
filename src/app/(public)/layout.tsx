import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Logo } from "@/components/app/logo";
import { ButtonLink } from "@/components/ui/button";
import { MeProvider } from "@/lib/client/hooks";
import { toClient } from "@/lib/client/serialize";
import { getSession } from "@/server/auth/session";
import { meDto } from "@/server/services/dto";

/** Shareable pages: full app chrome for members, a light header for visitors. */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session) {
    return (
      <MeProvider initial={toClient(meDto(session.user))}>
        <AppShell>{children}</AppShell>
      </MeProvider>
    );
  }
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo />
          <nav aria-label="Account" className="flex items-center gap-2">
            <ButtonLink href="/login" variant="ghost" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register" size="sm">
              Join free
            </ButtonLink>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
