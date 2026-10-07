"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiClientError } from "@/lib/client/api";
import { Toaster } from "@/components/ui/overlay";

function makeClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        // Session expired while the app was open: send the user to sign in again.
        if (error instanceof ApiClientError && error.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload drops all signed-in client state
          window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => !(error instanceof ApiClientError && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
