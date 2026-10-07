"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/overlay";
import { errorMessage, patch } from "@/lib/client/api";
import type { Me } from "@/lib/client/types";

type SettingsPatch = Partial<Omit<Me["settings"], "notificationSettings" | "privacySettings">> & {
  notificationSettings?: Record<string, boolean>;
  statsVisibility?: Record<string, boolean>;
};

/** PATCH /me/settings; the response is the fresh `Me`, which replaces the cached copy. */
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SettingsPatch) => patch<Me>("/me/settings", body),
    onSuccess: (me) => {
      qc.setQueryData(["me"], me);
      toast.success("Saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
