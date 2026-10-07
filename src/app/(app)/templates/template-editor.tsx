"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { TargetRows, type TargetRow } from "@/components/app/target-rows";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/overlay";
import { errorMessage, post, put } from "@/lib/client/api";
import type { TemplateDto } from "./templates-view";

export function TemplateEditor({ template }: { template?: TemplateDto }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [rows, setRows] = useState<TargetRow[]>(() => template?.exercises.map((e) => ({ key: crypto.randomUUID(), exerciseId: e.exerciseId, name: e.name, targetSets: e.targetSets, targetReps: e.targetReps ?? "", targetWeight: e.targetWeight })) ?? []);

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim() || null, exercises: rows.map((r) => ({ exerciseId: r.exerciseId, targetSets: r.targetSets, targetReps: r.targetReps.trim() || null, targetWeight: r.targetWeight })) };
      return template ? put(`/templates/${template.id}`, body) : post("/templates", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template saved");
      router.replace("/templates");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title={template ? "Edit template" : "New template"} />
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Card className="space-y-4 p-5">
          <Field label="Name">{(p) => <Input {...p} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!template} />}</Field>
          <Field label="Description" optional>{(p) => <Textarea {...p} rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        </Card>
        <TargetRows rows={rows} onChange={setRows} label="Template exercises" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={save.isPending} disabled={!name.trim()}>Save template</Button>
        </div>
      </form>
    </>
  );
}
