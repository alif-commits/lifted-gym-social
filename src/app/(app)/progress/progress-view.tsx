"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Tabs } from "@/components/ui/tabs";
import { BodyTab } from "./body-tab";
import { GoalsTab } from "./goals-tab";
import { Overview } from "./overview";
import { PhotosTab } from "./photos-tab";
import { RecordsTab } from "./records-tab";

const TABS = ["overview", "body", "photos", "goals", "records"] as const;
type Tab = (typeof TABS)[number];

export function ProgressView() {
  const router = useRouter();
  const param = useSearchParams().get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(param ?? "") ? (param as Tab) : "overview";

  return (
    <>
      <PageHeader title="Progress" subtitle="Trends, body stats and goals. Body data is private to you." />
      <Tabs
        label="Progress sections"
        value={tab}
        onChange={(t) => router.replace(t === "overview" ? "/progress" : `/progress?tab=${t}`, { scroll: false })}
        tabs={[{ value: "overview", label: "Overview" }, { value: "body", label: "Body" }, { value: "photos", label: "Photos" }, { value: "goals", label: "Goals" }, { value: "records", label: "Records" }]}
        className="mb-6"
      />
      {tab === "overview" ? <Overview /> : null}
      {tab === "body" ? <BodyTab /> : null}
      {tab === "photos" ? <PhotosTab /> : null}
      {tab === "goals" ? <GoalsTab /> : null}
      {tab === "records" ? <RecordsTab /> : null}
    </>
  );
}
