/**
 * Weekly training streak: number of consecutive weeks (Mon-Sun) with at least one workout,
 * counting back from the current week (or the previous week if this week has none yet).
 * `days` are local calendar dates (YYYY-MM-DD).
 */
export function weekKey(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Monday = 0
  return Math.floor((t - dow * 86_400_000) / (7 * 86_400_000));
}

export function weeklyStreak(days: string[], today: string): number {
  const weeks = new Set(days.map(weekKey));
  let current = weekKey(today);
  if (!weeks.has(current)) current -= 1;
  let streak = 0;
  while (weeks.has(current)) {
    streak += 1;
    current -= 1;
  }
  return streak;
}

export type Achievement = { id: string; label: string; description: string };

export function computeAchievements(s: { workouts: number; totalVolumeKg: number; prCount: number; streakWeeks: number }): Achievement[] {
  const out: Achievement[] = [];
  const add = (cond: boolean, id: string, label: string, description: string) => cond && out.push({ id, label, description });
  add(s.workouts >= 1, "first-workout", "First rep", "Logged a first workout");
  add(s.workouts >= 10, "ten-workouts", "Getting serious", "10 workouts logged");
  add(s.workouts >= 50, "fifty-workouts", "Regular", "50 workouts logged");
  add(s.workouts >= 100, "hundred-workouts", "Century club", "100 workouts logged");
  add(s.totalVolumeKg >= 10_000, "volume-10k", "10 tonne club", "Moved 10,000 kg in total");
  add(s.totalVolumeKg >= 100_000, "volume-100k", "100 tonne club", "Moved 100,000 kg in total");
  add(s.prCount >= 1, "first-pr", "New personal best", "Set a personal record");
  add(s.prCount >= 10, "ten-prs", "PR machine", "10 personal records");
  add(s.streakWeeks >= 4, "streak-4", "Month strong", "4-week training streak");
  add(s.streakWeeks >= 12, "streak-12", "Quarter strong", "12-week training streak");
  return out;
}
