"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Input, NumberInput, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/overlay";
import { del, errorMessage, get, patch, upload } from "@/lib/client/api";
import { titleCase } from "@/lib/client/format";
import { useRefreshMe } from "@/lib/client/hooks";
import { ACTIVITY_LEVELS, FITNESS_GOALS, SEX_OPTIONS, TRAINING_EXPERIENCE } from "@/lib/constants";

type Profile = { displayName: string; username: string; bio: string | null; dateOfBirth: string | null; sex: string | null; heightCm: number | null; activityLevel: string | null; trainingExperience: string | null; fitnessGoal: string | null; avatarUrl: string | null; usernameChangedAt: string | null };

export function ProfileTab() {
  const q = useQuery({ queryKey: ["me-profile"], queryFn: () => get<Profile>("/me/profile") });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  return <ProfileForm profile={q.data!} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const refreshMe = useRefreshMe();
  const [f, setF] = useState(profile);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setF((p) => ({ ...p, [k]: v }));
  const nul = (v: string) => (v === "" ? null : v);

  const save = useMutation({
    mutationFn: () =>
      patch<Profile>("/me/profile", {
        displayName: f.displayName,
        ...(f.username !== profile.username ? { username: f.username } : {}),
        bio: f.bio ?? "",
        dateOfBirth: f.dateOfBirth,
        sex: f.sex,
        heightCm: f.heightCm,
        activityLevel: f.activityLevel,
        trainingExperience: f.trainingExperience,
        fitnessGoal: f.fitnessGoal,
      }),
    onSuccess: (p) => { setError(null); qc.setQueryData(["me-profile"], p); refreshMe(); toast.success("Profile updated"); },
    onError: (e) => setError(errorMessage(e)),
  });
  const avatar = useMutation({
    mutationFn: async (action: File | null) => {
      if (!action) return del("/me/avatar");
      const form = new FormData();
      form.append("file", action);
      await upload("/me/avatar", form);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me-profile"] }); refreshMe(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <Card className="flex items-center gap-4 p-5">
        <Avatar name={f.displayName} src={profile.avatarUrl} size="lg" />
        <div className="space-y-2">
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload avatar" onChange={(e) => { const x = e.target.files?.[0]; if (x) avatar.mutate(x); e.target.value = ""; }} />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" loading={avatar.isPending} onClick={() => file.current?.click()}><Camera className="h-4 w-4" aria-hidden /> Change photo</Button>
            {profile.avatarUrl ? <Button size="sm" variant="ghost" onClick={() => avatar.mutate(null)}>Remove</Button> : null}
          </div>
          <p className="text-xs text-subtle">JPEG, PNG or WebP.</p>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="display text-2xl">Public profile</h2>
        <Field label="Display name">{(p) => <Input {...p} required maxLength={80} value={f.displayName} onChange={(e) => set("displayName", e.target.value)} />}</Field>
        <Field label="Username" hint="3–30 letters, numbers or underscores. Changes are rate limited.">{(p) => <Input {...p} required autoCapitalize="none" value={f.username} onChange={(e) => set("username", e.target.value.toLowerCase())} />}</Field>
        <Field label="Bio" optional hint={`${(f.bio ?? "").length}/300`}>{(p) => <Textarea {...p} rows={3} maxLength={300} value={f.bio ?? ""} onChange={(e) => set("bio", e.target.value)} />}</Field>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="display text-2xl">Body & training</h2>
          <p className="text-sm text-muted">Private. Used for the calorie calculator.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" optional>{(p) => <Input {...p} type="date" value={f.dateOfBirth ?? ""} onChange={(e) => set("dateOfBirth", nul(e.target.value))} />}</Field>
          <Field label="Sex" optional>{(p) => <Select {...p} value={f.sex ?? ""} onChange={(e) => set("sex", nul(e.target.value))}><option value="">Not set</option>{SEX_OPTIONS.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}</Select>}</Field>
          <Field label="Height (cm)" optional>{(p) => <NumberInput {...p} value={f.heightCm} onValue={(v) => set("heightCm", v)} />}</Field>
          <Field label="Activity level" optional>{(p) => <Select {...p} value={f.activityLevel ?? ""} onChange={(e) => set("activityLevel", nul(e.target.value))}><option value="">Not set</option>{ACTIVITY_LEVELS.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}</Select>}</Field>
          <Field label="Experience" optional>{(p) => <Select {...p} value={f.trainingExperience ?? ""} onChange={(e) => set("trainingExperience", nul(e.target.value))}><option value="">Not set</option>{TRAINING_EXPERIENCE.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}</Select>}</Field>
          <Field label="Main goal" optional>{(p) => <Select {...p} value={f.fitnessGoal ?? ""} onChange={(e) => set("fitnessGoal", nul(e.target.value))}><option value="">Not set</option>{FITNESS_GOALS.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}</Select>}</Field>
        </div>
      </Card>

      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" size="lg" loading={save.isPending}>Save profile</Button>
    </form>
  );
}
