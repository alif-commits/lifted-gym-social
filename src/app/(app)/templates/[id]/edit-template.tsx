"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { get } from "@/lib/client/api";
import { TemplateEditor } from "../template-editor";
import type { TemplateDto } from "../templates-view";

export function EditTemplate({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["templates", id], queryFn: () => get<TemplateDto>(`/templates/${id}`), staleTime: 0 });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  return <TemplateEditor template={q.data!} />;
}
