"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, ErrorState, Skeleton, Stat } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form";
import { ConfirmDialog, toast } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { errorMessage, get, patch } from "@/lib/client/api";
import { useList } from "@/lib/client/hooks";
import { shortDate, titleCase } from "@/lib/client/format";
import { isAdminRole, type UserRole } from "@/lib/constants";
import { ModerationQueue } from "./moderation-queue";

type Tab = "overview" | "users" | "reports";
type Stats = {
  totalUsers: number;
  activeUsers: number;
  newUsers7d: number;
  workouts7d: number;
  workoutsAll: number;
  publishedActivities: number;
  openReports: number;
};
type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  workoutCount: number;
};

export function AdminDashboard({ role }: { role: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const admin = isAdminRole(role);
  return (
    <>
      <PageHeader title="Admin" subtitle="Staff console — stats, people, and reports." />
      <Tabs
        label="Admin sections"
        value={tab}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "users", label: "Users" },
          { value: "reports", label: "Reports" },
        ]}
      />
      {tab === "overview" ? <Overview /> : null}
      {tab === "users" ? <UserDirectory admin={admin} /> : null}
      {tab === "reports" ? <ModerationQueue embedded /> : null}
    </>
  );
}

function Overview() {
  const q = useQuery({ queryKey: ["admin", "stats"], queryFn: () => get<Stats>("/admin/stats") });
  if (q.isLoading) return <Skeleton className="h-48" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const s = q.data!;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Card className="p-4">
        <Stat label="Members" value={s.totalUsers.toLocaleString()} sub={`${s.activeUsers} active`} />
      </Card>
      <Card className="p-4">
        <Stat label="New this week" value={s.newUsers7d.toLocaleString()} />
      </Card>
      <Card className="p-4">
        <Stat label="Workouts" value={s.workoutsAll.toLocaleString()} sub={`${s.workouts7d} this week`} />
      </Card>
      <Card className="p-4">
        <Stat label="Published posts" value={s.publishedActivities.toLocaleString()} />
      </Card>
      <Card className="p-4">
        <Stat label="Open reports" value={s.openReports.toLocaleString()} />
      </Card>
    </div>
  );
}

function UserDirectory({ admin }: { admin: boolean }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [pending, setPending] = useState<{ user: AdminUser; status: "active" | "suspended" } | null>(null);
  const list = useList<AdminUser>(["admin", "users"], "/admin/users", { q: q.trim() || undefined, status: status || undefined, role: role || undefined });

  const mutate = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: UserRole; status?: "active" | "suspended" } }) => patch<AdminUser>(`/admin/users/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      setPending(null);
      toast.success("Account updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, @username or email" aria-label="Search users" className="sm:flex-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className="sm:w-40">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className="sm:w-40">
          <option value="">Any role</option>
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </Select>
      </div>

      {list.isLoading ? <Skeleton className="h-48" /> : null}
      {list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : null}
      {!list.isLoading && list.items.length === 0 ? <EmptyState icon={<Users className="h-7 w-7" aria-hidden />} title="No accounts" description="Nothing matches these filters." /> : null}

      <ul className="space-y-3">
        {list.items.map((u) => (
          <li key={u.id}>
            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <Avatar name={u.displayName} src={u.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {u.displayName} <span className="font-normal text-subtle">@{u.username}</span>
                </p>
                <p className="truncate text-xs text-muted">{u.email}</p>
                <p className="mt-1 text-xs text-subtle">
                  Joined {shortDate(u.createdAt)} · {u.workoutCount} workouts
                  {u.emailVerified ? "" : " · email unverified"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={u.status === "suspended" ? "danger" : "neutral"}>{titleCase(u.status)}</Badge>
                {admin ? (
                  <>
                    <Select
                      value={u.role}
                      aria-label={`Role for ${u.displayName}`}
                      className="w-36"
                      onChange={(e) => mutate.mutate({ id: u.id, body: { role: e.target.value as UserRole } })}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </Select>
                    <Button
                      size="sm"
                      variant={u.status === "suspended" ? "secondary" : "danger"}
                      onClick={() => setPending({ user: u, status: u.status === "suspended" ? "active" : "suspended" })}
                    >
                      {u.status === "suspended" ? "Reactivate" : "Suspend"}
                    </Button>
                  </>
                ) : (
                  <Badge tone={u.role === "admin" ? "accent" : "neutral"}>{titleCase(u.role)}</Badge>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {list.hasNextPage ? (
        <Button variant="secondary" className="w-full" onClick={() => list.fetchNextPage()} loading={list.isFetchingNextPage}>
          Load more
        </Button>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => pending && mutate.mutate({ id: pending.user.id, body: { status: pending.status } })}
        loading={mutate.isPending}
        danger={pending?.status === "suspended"}
        title={pending?.status === "suspended" ? "Suspend this account?" : "Reactivate this account?"}
        confirmLabel={pending?.status === "suspended" ? "Suspend" : "Reactivate"}
        message={
          pending?.status === "suspended"
            ? `${pending.user.displayName} is signed out everywhere and can't log in.`
            : `${pending?.user.displayName} can sign in again.`
        }
      />
    </div>
  );
}
