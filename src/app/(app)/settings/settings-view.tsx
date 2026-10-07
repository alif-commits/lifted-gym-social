"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Tabs } from "@/components/ui/tabs";
import { AccountTab } from "./account-tab";
import { ConnectionsTab } from "./connections-tab";
import { PeopleTab } from "./people-tab";
import { PreferencesTab } from "./preferences-tab";
import { PrivacyTab } from "./privacy-tab";
import { ProfileTab } from "./profile-tab";

const TABS = ["profile", "privacy", "preferences", "people", "connections", "account"] as const;
type Tab = (typeof TABS)[number];

export function SettingsView() {
  const router = useRouter();
  const param = useSearchParams().get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(param ?? "") ? (param as Tab) : "profile";

  return (
    <>
      <PageHeader title="Settings" />
      <Tabs
        label="Settings sections"
        value={tab}
        onChange={(t) => router.replace(t === "profile" ? "/settings" : `/settings?tab=${t}`, { scroll: false })}
        tabs={[{ value: "profile", label: "Profile" }, { value: "privacy", label: "Privacy" }, { value: "preferences", label: "Preferences" }, { value: "people", label: "People" }, { value: "connections", label: "Connections" }, { value: "account", label: "Account" }]}
        className="mb-6"
      />
      {tab === "profile" ? <ProfileTab /> : null}
      {tab === "privacy" ? <PrivacyTab /> : null}
      {tab === "preferences" ? <PreferencesTab /> : null}
      {tab === "people" ? <PeopleTab /> : null}
      {tab === "connections" ? <ConnectionsTab /> : null}
      {tab === "account" ? <AccountTab /> : null}
    </>
  );
}
