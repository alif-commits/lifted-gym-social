"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Dialog, toast } from "@/components/ui/overlay";
import { errorMessage, post } from "@/lib/client/api";

const REASONS = [
  ["SPAM", "Spam"],
  ["HARASSMENT", "Harassment or bullying"],
  ["HATE", "Hate speech"],
  ["SEXUAL", "Sexual content"],
  ["DANGEROUS", "Dangerous advice"],
  ["MISLEADING", "Misleading"],
  ["OTHER", "Something else"],
] as const;

export type ReportTarget = { targetType: "PROFILE" | "ACTIVITY" | "COMMENT" | "IMAGE"; targetId: string };

export function ReportDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const [reason, setReason] = useState<string>("SPAM");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={target !== null} onClose={onClose} title="Report content">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!target) return;
          setLoading(true);
          try {
            await post("/reports", { ...target, reason, details: details || undefined });
            toast.success("Thanks. Our moderators will take a look.");
            setDetails("");
            onClose();
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setLoading(false);
          }
        }}
      >
        <Field label="Reason">
          {(p) => (
            <Select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Details" optional>
          {(p) => <Textarea {...p} rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Submit report
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
