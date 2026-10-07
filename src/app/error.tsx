"use client";

import { ErrorState } from "@/components/ui/feedback";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-6">
      <ErrorState message="Something went wrong on our side. Your data is safe." onRetry={reset} className="w-full" />
    </main>
  );
}
