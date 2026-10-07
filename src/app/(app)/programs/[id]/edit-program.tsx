"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { get } from "@/lib/client/api";
import { ProgramEditor, type ProgramDto } from "../program-editor";

export function EditProgram({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["programs", id], queryFn: () => get<ProgramDto>(`/programs/${id}`), staleTime: 0 });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  return <ProgramEditor program={q.data!} />;
}
