"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { get, qs, type Page } from "./api";
import type { UnitSystem } from "./format";
import type { Me } from "./types";

const MeContext = createContext<Me | null>(null);

/** Provides the signed-in user. The server layout seeds it, so the first render never flashes a loading state. */
export function MeProvider({ initial, children }: { initial: Me; children: ReactNode }) {
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => get<Me>("/me"), initialData: initial, staleTime: 5 * 60_000 });
  return <MeContext.Provider value={data}>{children}</MeContext.Provider>;
}

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside <MeProvider>");
  return me;
}

/** Like useMe, but returns null on public pages rendered for signed-out visitors. */
export const useOptionalMe = (): Me | null => useContext(MeContext);

export const useUnits = (): UnitSystem => useOptionalMe()?.settings.unitSystem ?? "metric";

export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}

/** Cursor-paginated list helper: `useList(["feed"], "/feed")`. */
export function useList<T>(key: unknown[], path: string, params: Record<string, string | number | undefined> = {}, enabled = true) {
  const q = useInfiniteQuery({
    queryKey: [...key, params],
    queryFn: ({ pageParam, signal }) => get<Page<T>>(`${path}${qs({ limit: 20, ...params, cursor: pageParam })}`, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled,
  });
  return { ...q, items: q.data?.pages.flatMap((p) => p.items) ?? [] };
}
