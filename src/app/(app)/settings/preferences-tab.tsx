"use client";

import { useSyncExternalStore } from "react";
import { Card } from "@/components/ui/feedback";
import { Field, Segmented, Select, Switch } from "@/components/ui/form";
import { useMe } from "@/lib/client/hooks";
import type { NotificationType } from "@/lib/constants";
import { useSaveSettings } from "./use-save-settings";

type Theme = "dark" | "light";

// The theme lives on <html data-theme>, set by the inline script in the root layout.
const themeListeners = new Set<() => void>();
const subscribeTheme = (cb: () => void) => {
  themeListeners.add(cb);
  return () => void themeListeners.delete(cb);
};
const readTheme = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

const NOTIFICATIONS: Array<[NotificationType, string]> = [
  ["NEW_FOLLOWER", "New followers"],
  ["FOLLOW_REQUEST", "Follow requests"],
  ["FOLLOW_ACCEPTED", "Accepted follow requests"],
  ["ACTIVITY_LIKE", "Likes on your posts"],
  ["COMMENT", "Comments"],
  ["COMMENT_REPLY", "Replies to your comments"],
  ["MENTION", "Mentions"],
  ["PR", "Personal records"],
  ["GOAL_MILESTONE", "Goal milestones"],
];

// The browser and the server ship different IANA lists, so the full list is client-only; SSR renders just the current zone.
let browserZones: string[] | null = null;
const EMPTY_ZONES: string[] = [];
const noopSubscribe = () => () => {};
const readZones = () => (browserZones ??= typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []);

export function PreferencesTab() {
  const { settings } = useMe();
  const save = useSaveSettings();
  const zones = useSyncExternalStore(noopSubscribe, readZones, () => EMPTY_ZONES);
  const zoneOptions = zones.includes(settings.timezone) ? zones : [settings.timezone, ...zones];
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);

  const changeTheme = (t: Theme) => {
    document.documentElement.dataset.theme = t;
    themeListeners.forEach((cb) => cb());
    try {
      localStorage.setItem("lifted-theme", t);
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-5 p-5">
        <h2 className="display text-2xl">Display</h2>
        <Field label="Theme">{() => <Segmented label="Theme" value={theme} onChange={changeTheme} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />}</Field>
        <Field label="Units" hint="Weights are stored in kg and converted for display.">
          {() => <Segmented label="Units" value={settings.unitSystem} onChange={(v) => save.mutate({ unitSystem: v })} options={[{ value: "metric", label: "Metric (kg)" }, { value: "imperial", label: "Imperial (lb)" }]} />}
        </Field>
        <Field label="Timezone" hint="Used for streaks, calendars and daily nutrition.">
          {(p) => <Select {...p} value={settings.timezone} onChange={(e) => save.mutate({ timezone: e.target.value })}>{zoneOptions.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</Select>}
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="display text-2xl">Notifications</h2>
        {NOTIFICATIONS.map(([type, title]) => (
          <Switch key={type} checked={settings.notificationSettings[type] !== false} disabled={save.isPending} onChange={(v) => save.mutate({ notificationSettings: { [type]: v } })} label={title} />
        ))}
      </Card>
    </div>
  );
}
