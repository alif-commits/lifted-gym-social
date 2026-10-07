#!/usr/bin/env node
/**
 * End-to-end API smoke test against a running server (default http://localhost:3000).
 * Creates two throwaway users and walks the main product flows. Usage: `npm run smoke`.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000") + "/api/v1";
const stamp = Date.now().toString(36);

class Client {
  jar = new Map();
  constructor(name) {
    this.name = name;
  }
  async call(method, path, body, { raw = false } = {}) {
    const headers = { cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ") };
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      pair.slice(i + 1) ? this.jar.set(pair.slice(0, i), pair.slice(i + 1)) : this.jar.delete(pair.slice(0, i));
    }
    if (raw) return res;
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    return { status: res.status, data: json?.data, error: json?.error };
  }
  get = (p) => this.call("GET", p);
  post = (p, b) => this.call("POST", p, b ?? {});
  put = (p, b) => this.call("PUT", p, b);
  patch = (p, b) => this.call("PATCH", p, b);
  del = (p) => this.call("DELETE", p);
}

let step = 0;
const ok = (res, status = 200, label = "") => {
  step++;
  assert.equal(res.status, status, `${label || "step " + step}: expected ${status}, got ${res.status} ${JSON.stringify(res.error ?? res.data)?.slice(0, 300)}`);
  console.log(`  ✓ ${label || "step " + step}`);
  return res.data;
};

const PNG = await sharp({ create: { width: 96, height: 96, channels: 3, background: { r: 200, g: 240, b: 49 } } }).png().toBuffer();
const imageForm = (name = "x.png") => {
  const f = new FormData();
  f.set("file", new File([PNG], name, { type: "image/png" }));
  return f;
};

async function main() {
  const alice = new Client("alice");
  const bob = new Client("bob");

  console.log("Auth");
  for (const [c, n] of [[alice, "alice"], [bob, "bob"]]) {
    ok(await c.post("/auth/register", { email: `${n}.${stamp}@example.com`, password: "Lifted12345", username: `${n}_${stamp}`.slice(0, 20), displayName: n, timezone: "Asia/Jakarta" }), 201, `register ${n}`);
  }
  ok(await new Client("anon").post("/auth/login", { identifier: "nobody", password: "wrong-password" }), 401, "bad login rejected");
  ok(await alice.post("/auth/register", { email: "bad", password: "x", username: "!", displayName: "" }), 422, "validation errors are 422");
  const aliceName = `alice_${stamp}`.slice(0, 20);
  const bobName = `bob_${stamp}`.slice(0, 20);

  console.log("Exercises, workout, PRs");
  const ex = ok(await alice.get("/exercises?q=barbell bench&limit=1"), 200, "search exercises").items[0];
  const squat = ok(await alice.get("/exercises?q=barbell back squat&limit=1"), 200, "search squat").items[0];
  const w = ok(await alice.post("/workouts", { title: "Push day" }), 201, "start workout");
  ok(await alice.post("/workouts", { title: "Second" }), 409, "only one active workout");
  const weId = randomUUID();
  const state = {
    title: "Push day",
    exercises: [
      { id: weId, exerciseId: ex.id, restSeconds: 90, sets: [
        { id: randomUUID(), setType: "WARMUP", weight: 40, reps: 10, completed: true },
        { id: randomUUID(), setType: "NORMAL", weight: 80, reps: 8, completed: true },
        { id: randomUUID(), setType: "NORMAL", weight: 85, reps: 5, completed: true },
      ] },
      { id: randomUUID(), exerciseId: squat.id, sets: [{ id: randomUUID(), weight: 100, reps: 5, completed: true }] },
    ],
  };
  ok(await alice.put(`/workouts/${w.id}`, state), 200, "autosave");
  ok(await alice.put(`/workouts/${w.id}`, state), 200, "autosave is idempotent");
  const done = ok(await alice.post(`/workouts/${w.id}/complete`), 200, "complete workout");
  assert.equal(done.workout?.stats?.setCount ?? done.stats?.setCount, 3, "warm-up excluded from set count");
  ok(await alice.post(`/workouts/${w.id}/complete`), 200, "complete is idempotent");
  const w2 = ok(await alice.post("/workouts", { repeatWorkoutId: w.id }), 201, "repeat workout");
  ok(await alice.post(`/workouts/${w2.id}/discard`), 204, "discard");

  console.log("Activity, privacy, social");
  const draft = ok(await alice.post("/activities", { workoutId: w.id }), 201, "create draft");
  ok(await bob.get(`/activities/${draft.id}`), 404, "drafts are hidden from others");
  ok(await alice.post(`/activities/${draft.id}/photos`, imageForm()), 201, "upload activity photo");
  const pub = ok(await alice.patch(`/activities/${draft.id}`, { title: "Chest day #push @" + bobName, description: "felt strong #pr", showExerciseDetails: false }), 200, "edit draft");
  ok(await alice.post(`/activities/${draft.id}/publish`), 200, "publish");
  const shortId = pub.shortId;
  assert.ok(shortId, "short id present");
  const asBob = ok(await bob.get(`/activities/${shortId}`), 200, "public activity visible via short id");
  assert.deepEqual(asBob.summary, [], "exercise summary hidden when the owner opts out");
  assert.equal(asBob.exercises, null, "exercise sets hidden when the owner opts out");
  ok(await bob.get("/feed"), 200, "feed (not following)").items.length === 0 || assert.fail("feed should be empty before following");
  ok(await bob.post(`/users/${aliceName}/follow`), 200, "follow");
  assert.equal(ok(await bob.get("/feed"), 200, "feed after follow").items.length, 1);
  ok(await bob.post(`/activities/${draft.id}/like`), 200, "like");
  ok(await bob.post(`/activities/${draft.id}/like`), 200, "like is idempotent").likesCount === 1 || assert.fail("likes must not double count");
  const c = ok(await bob.post(`/activities/${draft.id}/comments`, { text: "Nice one @" + aliceName }), 201, "comment");
  ok(await alice.post(`/activities/${draft.id}/comments`, { text: "thanks!", parentCommentId: c.id }), 201, "reply");
  assert.equal(ok(await alice.get(`/activities/${draft.id}/comments`), 200, "list comments").items[0].replies.length, 1);
  assert.ok(ok(await alice.get("/notifications/unread-count"), 200, "unread count").count >= 2);
  ok(await bob.post(`/activities/${draft.id}/bookmark`), 200, "bookmark");
  const explore = ok(await bob.get("/explore?sort=recent"), 200, "explore");
  assert.ok(explore.items.some((a) => a.id === draft.id));
  ok(await alice.patch("/me/settings", { isPrivateAccount: true }), 200, "make account private");
  ok(await new Client("anon").get(`/activities/${shortId}`), 404, "private account hides activity from anonymous");
  ok(await bob.get(`/activities/${shortId}`), 200, "followers still see it");
  ok(await alice.patch("/me/settings", { isPrivateAccount: false }), 200, "make public again");
  ok(await bob.post("/reports", { targetType: "ACTIVITY", targetId: draft.id, reason: "SPAM" }), 201, "report activity");
  ok(await bob.post("/reports", { targetType: "ACTIVITY", targetId: draft.id, reason: "SPAM" }), 409, "duplicate report rejected");
  ok(await bob.post(`/users/${aliceName}/block`), 204, "block");
  ok(await bob.get(`/activities/${shortId}`), 404, "blocked users cannot see activity");
  ok(await bob.del(`/users/${aliceName}/block`), 204, "unblock");

  console.log("Media");
  const photo = pub.photos?.[0] ?? (await alice.get(`/activities/${draft.id}`)).data.photos[0];
  const media = await bob.call("GET", photo.url.replace("/api/v1", ""), undefined, { raw: true });
  assert.equal(media.status, 200, "published photo is viewable");
  console.log("  ✓ media delivery");

  console.log("Nutrition");
  const calc = ok(await alice.post("/calories/calculate", { age: 28, sex: "MALE", heightCm: 178, weightKg: 78, activityLevel: "MODERATE", goal: "LOSE", save: true }), 200, "calculate + save goal");
  assert.ok(calc.targetCalories > 1500);
  const foods = ok(await alice.get("/foods?q=chicken breast"), 200, "search foods");
  const chicken = foods[0];
  const entry = ok(await alice.post("/nutrition/entries", { mealName: "Lunch", foodItemId: chicken.id, foodName: chicken.name, quantity: 200, unit: "g", calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }), 201, "log food");
  assert.ok(entry.calories > 200 && entry.proteinG > 30, "macros are derived from the food, not the client");
  const day = ok(await alice.get("/nutrition/day"), 200, "day summary");
  assert.equal(day.meals[0].items.length, 1);
  const card = ok(await alice.post("/nutrition/share-cards", { date: day.date, metrics: ["calories", "proteinG"] }), 201, "share card");
  const publicCard = ok(await new Client("anon").get(`/nutrition/share-cards/${card.id}`), 200, "public share card");
  assert.ok(!JSON.stringify(publicCard).includes("chicken"), "share card must not leak food names");

  console.log("AI food scan");
  const scan = ok(await alice.call("POST", "/food-scans", imageForm("meal.png")), 201, "upload scan");
  let s;
  for (let i = 0; i < 30; i++) {
    s = ok(await alice.get(`/food-scans/${scan.id}`), 200, `poll ${i + 1}`);
    if (s.status !== "PROCESSING") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(s.status, "COMPLETED", `scan finished (${s.errorCode ?? "no error"})`);
  assert.ok(s.items.length > 0);
  const incomplete = s.items.find((i) => i.calories === null);
  if (incomplete) ok(await alice.post(`/food-scans/${scan.id}/confirm`, { mealName: "Dinner" }), 400, "cannot confirm items without nutrition");
  if (incomplete) ok(await alice.del(`/food-scans/${scan.id}/items/${incomplete.id}`), 204, "remove unresolved item");
  const confirmed = ok(await alice.post(`/food-scans/${scan.id}/confirm`, { mealName: "Dinner" }), 200, "confirm scan");
  const again = ok(await alice.post(`/food-scans/${scan.id}/confirm`, { mealName: "Dinner" }), 200, "confirm is idempotent");
  assert.equal(again.alreadyConfirmed, true);
  assert.equal(again.entries.length, confirmed.entries.length);
  const day2 = ok(await alice.get("/nutrition/day"), 200, "day after scan");
  assert.equal(day2.meals.flatMap((m) => m.items).length, 1 + confirmed.entries.length, "no duplicate entries");

  console.log("Progress");
  ok(await alice.post("/progress/weights", { weightKg: 78.4 }), 201, "log weight");
  ok(await alice.post("/progress/measurements", { measurementType: "WAIST", valueCm: 84 }), 201, "log measurement");
  ok(await alice.post("/progress/photos", (() => { const f = imageForm(); f.set("photoType", "FRONT"); return f; })()), 201, "progress photo");
  const myPhoto = ok(await alice.get("/progress/photos"), 200, "list photos").items[0];
  assert.equal((await bob.call("GET", myPhoto.imageUrl.replace("/api/v1", ""), undefined, { raw: true })).status, 404, "progress photos are private");
  ok(await alice.post("/progress/goals", { name: "Hit 75kg", goalType: "BODY_WEIGHT", startValue: 80, targetValue: 75 }), 201, "create goal");
  const an = ok(await alice.get("/progress/analytics?range=90d"), 200, "analytics");
  assert.equal(an.summary.workouts, 1);
  ok(await alice.get("/progress/records"), 200, "personal records");
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(ok(await alice.get(`/nutrition/history?from=${today}&to=${today}`), 200, "nutrition history").days.length, 1);
  ok(await alice.get(`/progress/calendar?from=${new Date().toISOString().slice(0, 8)}01&to=${new Date().toISOString().slice(0, 10)}`), 200, "calendar");

  console.log("Templates & export");
  const tpl = ok(await alice.post(`/workouts/${w.id}/save-template`), 201, "save as template");
  ok(await alice.post("/workouts", { templateId: tpl.id }), 201, "start from template");
  const exp = ok(await alice.post("/me/exports", { format: "JSON" }), 201, "request export");
  for (let i = 0; i < 10; i++) {
    const list = ok(await alice.get("/me/exports"), 200, "poll export");
    if (list[0].status === "READY") break;
    await new Promise((r) => setTimeout(r, 700));
  }
  assert.ok(exp.id);

  console.log("Account deletion");
  ok(await bob.call("DELETE", "/me", { password: "wrong", confirm: "DELETE" }), 403, "wrong password refused");
  ok(await bob.call("DELETE", "/me", { password: "Lifted12345", confirm: "DELETE" }), 204, "bob deleted");
  ok(await alice.call("DELETE", "/me", { password: "Lifted12345", confirm: "DELETE" }), 204, "alice deleted");
  console.log("\nAll smoke checks passed.");
}

main().catch((e) => {
  console.error("\n✗ " + e.message);
  process.exit(1);
});
