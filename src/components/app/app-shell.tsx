"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Dumbbell, Flame, Home, LineChart, Search, Settings, ShieldCheck, Compass, Utensils, Play } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/client/cn";
import { get } from "@/lib/client/api";
import { useMe } from "@/lib/client/hooks";
import type { Workout } from "@/lib/client/types";
import { Logo } from "./logo";

const NAV = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/nutrition", label: "Nutrition", icon: Utensils },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/notifications", label: "Notifications", icon: Bell },
] as const;

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const path = usePathname();
  const { data: unread } = useQuery({ queryKey: ["unread"], queryFn: () => get<{ count: number }>("/notifications/unread-count"), refetchInterval: 60_000, staleTime: 20_000 });
  const { data: active } = useQuery({ queryKey: ["active-workout"], queryFn: () => get<Workout | null>("/workouts/active"), staleTime: 15_000 });
  const count = unread?.count ?? 0;
  const recording = path.startsWith("/workout/");
  const isStaff = me.role === "admin" || me.role === "moderator";

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1400px]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
        <Logo href="/feed" className="px-2" />
        <nav aria-label="Primary" className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined} className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors", isActive(path, href) ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-fg")}>
              <Icon className="h-5 w-5" aria-hidden />
              {label}
              {href === "/notifications" && count > 0 ? <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg">{count > 99 ? "99+" : count}</span> : null}
            </Link>
          ))}
          <Link href="/search" className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors", isActive(path, "/search") ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-fg")}>
            <Search className="h-5 w-5" aria-hidden />
            Search
          </Link>
          {isStaff ? (
            <Link href="/admin" className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold", isActive(path, "/admin") ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-fg")}>
              <ShieldCheck className="h-5 w-5" aria-hidden />
              Admin
            </Link>
          ) : null}
          <ButtonLink href="/workout/new" size="lg" className="mt-4">
            <Play className="h-5 w-5" aria-hidden />
            {active ? "Resume workout" : "Start workout"}
          </ButtonLink>
        </nav>
        <div className="mt-4 space-y-1 border-t border-line pt-4">
          <Link href={`/u/${me.username}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
            <Avatar name={me.displayName} src={me.avatarUrl} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{me.displayName}</span>
              <span className="block truncate text-xs text-subtle">@{me.username}</span>
            </span>
          </Link>
          <Link href="/settings" className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
            <Settings className="h-4 w-4" aria-hidden />
            Settings
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
          <Logo href="/feed" />
          <div className="flex items-center gap-1">
            <Link href="/search" aria-label="Search" className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2">
              <Search className="h-5 w-5" />
            </Link>
            <Link href="/notifications" aria-label={count ? `Notifications, ${count} unread` : "Notifications"} className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2">
              <Bell className="h-5 w-5" />
              {count > 0 ? <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" /> : null}
            </Link>
            <Link href={`/u/${me.username}`} aria-label="Your profile">
              <Avatar name={me.displayName} src={me.avatarUrl} size="sm" />
            </Link>
          </div>
        </header>

        {active && !recording ? (
          <Link href={`/workout/${active.id}`} className="flex items-center justify-between gap-3 bg-accent px-4 py-2.5 text-sm font-bold text-accent-fg">
            <span className="flex items-center gap-2">
              <Flame className="h-4 w-4" aria-hidden />
              Workout in progress · {active.title}
            </span>
            <span className="underline">Resume</span>
          </Link>
        ) : null}

        <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav aria-label="Primary" className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-bg/95 backdrop-blur lg:hidden">
        {[NAV[0], NAV[1]].map(({ href, label, icon: Icon }) => (
          <TabLink key={href} href={href} label={label} active={isActive(path, href)}>
            <Icon className="h-6 w-6" aria-hidden />
          </TabLink>
        ))}
        <Link href="/workout/new" aria-label={active ? "Resume workout" : "Start workout"} className="relative flex items-center justify-center">
          <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-accent/20">
            <Play className="h-6 w-6" aria-hidden />
          </span>
        </Link>
        {[NAV[3], NAV[4]].map(({ href, label, icon: Icon }) => (
          <TabLink key={href} href={href} label={label} active={isActive(path, href)}>
            <Icon className="h-6 w-6" aria-hidden />
          </TabLink>
        ))}
      </nav>
    </div>
  );
}

function TabLink({ href, label, active, children }: { href: string; label: string; active: boolean; children: ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", active ? "text-accent" : "text-subtle")}>
      {children}
      {label}
    </Link>
  );
}
