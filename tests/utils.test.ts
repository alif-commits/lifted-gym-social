import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAchievements, weekKey, weeklyStreak } from "@/lib/streak";
import { extractHashtags, extractMentions } from "@/lib/text-entities";
import { addDaysToDateString, isDateString, isValidTimezone, localDayRange, toLocalDate } from "@/lib/tz";
import { decodeCursor, encodeCursor } from "@/server/lib/cursor";
import { goalPercent } from "@/server/services/progress";

describe("text entities", () => {
  it("extracts unique, lowercased hashtags", () => assert.deepEqual(extractHashtags("Leg day #Squats #squats and #PR_day, not a#hash"), ["squats", "pr_day"]));
  it("extracts mentions but not email addresses", () => assert.deepEqual(extractMentions("great set @Alif_01 and @bob, mail me at x@y.com"), ["alif_01", "bob"]));
  it("handles empty input", () => assert.deepEqual(extractHashtags(null), []));
});

describe("time zones", () => {
  it("resolves the local date across the day boundary", () => {
    const instant = new Date("2026-03-10T18:30:00Z"); // 01:30 next day in Jakarta
    assert.equal(toLocalDate(instant, "UTC"), "2026-03-10");
    assert.equal(toLocalDate(instant, "Asia/Jakarta"), "2026-03-11");
  });
  it("computes the UTC range of a local day", () => {
    const { start, end } = localDayRange("2026-03-11", "Asia/Jakarta");
    assert.equal(start.toISOString(), "2026-03-10T17:00:00.000Z");
    assert.equal(end.toISOString(), "2026-03-11T17:00:00.000Z");
  });
  it("handles DST days (23 hour day in New York)", () => {
    const { start, end } = localDayRange("2026-03-08", "America/New_York");
    assert.equal((end.getTime() - start.getTime()) / 3_600_000, 23);
  });
  it("adds days and validates input", () => {
    assert.equal(addDaysToDateString("2026-02-28", 1), "2026-03-01");
    assert.equal(isDateString("2026-02-30"), false);
    assert.equal(isValidTimezone("Mars/Base"), false);
    assert.equal(isValidTimezone("Asia/Jakarta"), true);
  });
});

describe("streaks and achievements", () => {
  it("counts consecutive weeks with a workout", () => {
    // 2026-03-09 is a Monday
    const days = ["2026-03-09", "2026-03-03", "2026-02-24", "2026-02-02"];
    assert.equal(weeklyStreak(days, "2026-03-11"), 3);
  });
  it("does not break the streak before the current week has a workout", () => {
    assert.equal(weeklyStreak(["2026-03-03", "2026-02-24"], "2026-03-11"), 2);
    assert.equal(weeklyStreak([], "2026-03-11"), 0);
  });
  it("uses Monday as the start of the week", () => assert.equal(weekKey("2026-03-08"), weekKey("2026-03-02")));
  it("unlocks achievements by stats", () => {
    const ids = computeAchievements({ workouts: 12, totalVolumeKg: 12_000, prCount: 1, streakWeeks: 4 }).map((a) => a.id);
    assert.deepEqual(ids, ["first-workout", "ten-workouts", "volume-10k", "first-pr", "streak-4"]);
  });
});

describe("cursors and goals", () => {
  it("round-trips cursors and rejects garbage", () => {
    assert.deepEqual(decodeCursor(encodeCursor({ t: "x", id: "y" })), { t: "x", id: "y" });
    assert.equal(decodeCursor(undefined), null);
    assert.throws(() => decodeCursor("%%%not-json"));
  });
  it("computes goal progress in both directions", () => {
    assert.equal(goalPercent(90, 85, 80), 50); // cutting
    assert.equal(goalPercent(60, 70, 80), 50); // gaining
    assert.equal(goalPercent(90, 100, 80), 0); // wrong direction is clamped
    assert.equal(goalPercent(60, 90, 80), 100);
    assert.equal(goalPercent(null, null, 80), null);
  });
});
