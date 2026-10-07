"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton, Spinner } from "@/components/ui/feedback";

type ListState = { isLoading: boolean; isError: boolean; error: unknown; hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown; refetch: () => unknown };

/** Handles loading / error / empty / pagination for a `useList` result. Auto-loads more when scrolled near the end. */
export function InfiniteList<T>({
  list,
  items,
  render,
  empty,
  skeleton,
  skeletonCount = 3,
  as: Wrapper = "div",
  className = "space-y-4",
}: {
  list: ListState;
  items: T[];
  render: (item: T, index: number) => ReactNode;
  empty: ReactNode;
  skeleton?: ReactNode;
  skeletonCount?: number;
  as?: "div" | "ul";
  className?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && !isFetchingNextPage && fetchNextPage(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (list.isLoading) {
    return (
      <div className={className} aria-busy>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div key={i}>{skeleton ?? <Skeleton className="h-40" />}</div>
        ))}
      </div>
    );
  }
  if (list.isError) return <ErrorState message={list.error instanceof Error ? list.error.message : undefined} onRetry={() => list.refetch()} />;
  if (items.length === 0) return <>{empty}</>;

  return (
    <>
      <Wrapper className={className}>{items.map((item, i) => render(item, i))}</Wrapper>
      {hasNextPage ? (
        <div ref={sentinel} className="flex justify-center py-6">
          {isFetchingNextPage ? <Spinner /> : (
            <Button variant="outline" onClick={() => fetchNextPage()}>
              Load more
            </Button>
          )}
        </div>
      ) : null}
    </>
  );
}
