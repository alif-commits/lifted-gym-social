"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { del, errorMessage, post } from "@/lib/client/api";

export type FollowState = "NONE" | "FOLLOWING" | "REQUESTED";

export function FollowButton({ username, initial, size = "sm", onChange }: { username: string; initial: FollowState; size?: "sm" | "md"; onChange?: (s: FollowState) => void }) {
  const [state, setState] = useState<FollowState>(initial);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => (state === "NONE" ? post<{ state: FollowState }>(`/users/${username}/follow`) : del<{ state: FollowState }>(`/users/${username}/follow`)),
    onSuccess: (r) => {
      setState(r.state);
      onChange?.(r.state);
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["profile", username] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Button size={size} variant={state === "NONE" ? "primary" : "outline"} loading={m.isPending} onClick={() => m.mutate()} aria-pressed={state !== "NONE"}>
      {state === "NONE" ? "Follow" : state === "REQUESTED" ? "Requested" : "Following"}
    </Button>
  );
}
