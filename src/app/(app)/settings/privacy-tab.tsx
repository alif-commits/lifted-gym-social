"use client";

import { Card } from "@/components/ui/feedback";
import { Field, Select, Switch } from "@/components/ui/form";
import { titleCase } from "@/lib/client/format";
import { useMe } from "@/lib/client/hooks";
import { DATA_VISIBILITIES, VISIBILITIES } from "@/lib/constants";
import { useSaveSettings } from "./use-save-settings";

const STATS = [
  ["activities", "Workout count"],
  ["trainingTime", "Total training time"],
  ["totalVolume", "Total volume lifted"],
  ["prCount", "Personal record count"],
  ["streak", "Weekly streak"],
  ["achievements", "Achievements"],
] as const;

export function PrivacyTab() {
  const { settings } = useMe();
  const save = useSaveSettings();
  const stats = (settings.privacySettings.statsVisibility ?? {}) as Record<string, boolean>;
  const label = (v: string) => (v === "ONLY_ME" ? "Only me" : titleCase(v));

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <h2 className="display text-2xl">Account</h2>
        <Switch
          checked={settings.isPrivateAccount}
          disabled={save.isPending}
          onChange={(v) => save.mutate({ isPrivateAccount: v })}
          label="Private account"
          description="New followers need your approval and only approved followers see your posts."
        />
        <Field label="Default post visibility" hint="Applied when you publish a workout. You can change it per post.">
          {(p) => <Select {...p} value={settings.defaultActivityVisibility} onChange={(e) => save.mutate({ defaultActivityVisibility: e.target.value as never })}>{VISIBILITIES.map((v) => <option key={v} value={v}>{label(v)}</option>)}</Select>}
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="display text-2xl">Health data</h2>
          <p className="text-sm text-muted">Private by default. These control what others may see when you share.</p>
        </div>
        {([["nutritionVisibility", "Nutrition"], ["weightVisibility", "Body weight"], ["measurementVisibility", "Measurements"]] as const).map(([key, title]) => (
          <Field key={key} label={title}>
            {(p) => <Select {...p} value={settings[key]} onChange={(e) => save.mutate({ [key]: e.target.value })}>{DATA_VISIBILITIES.map((v) => <option key={v} value={v}>{label(v)}</option>)}</Select>}
          </Field>
        ))}
        <p className="text-xs text-subtle">Progress photos are always private.</p>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="display text-2xl">Profile stats</h2>
          <p className="text-sm text-muted">Choose which stats appear on your public profile.</p>
        </div>
        {STATS.map(([key, title]) => (
          <Switch key={key} checked={stats[key] === true} disabled={save.isPending} onChange={(v) => save.mutate({ statsVisibility: { [key]: v } })} label={title} />
        ))}
      </Card>
    </div>
  );
}
