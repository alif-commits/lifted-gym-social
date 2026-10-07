import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";

export function PersonRow({ user, sub, action }: { user: { username: string; displayName: string; avatarUrl: string | null }; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Link href={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={user.displayName} src={user.avatarUrl} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{user.displayName}</span>
          <span className="block truncate text-xs text-subtle">{sub ?? `@${user.username}`}</span>
        </span>
      </Link>
      {action}
    </div>
  );
}
