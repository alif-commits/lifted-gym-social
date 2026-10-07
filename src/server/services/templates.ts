import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { toLocalDate } from "@/lib/tz";
import type { ProgramInput, TemplateInput } from "@/lib/validators/template";
import type { SessionUser } from "@/server/auth/session";
import { getDb, type DbOrTx } from "@/server/db";
import {
  exercises,
  programAssignments,
  programDays,
  programExercises,
  programWeeks,
  programs,
  workoutExercises,
  workoutSets,
  workoutTemplateExercises,
  workoutTemplates,
  workouts,
} from "@/server/db/schema";
import { notFound } from "@/server/http/errors";
import { assertExercisesAccessible } from "./exercises";

/* --------------------------------- Templates -------------------------------- */

async function templateItems(db: DbOrTx, templateIds: string[]) {
  if (templateIds.length === 0) return [];
  return db
    .select({ item: workoutTemplateExercises, name: exercises.name, muscle: exercises.primaryMuscleGroup, trackingMode: exercises.trackingMode })
    .from(workoutTemplateExercises)
    .innerJoin(exercises, eq(exercises.id, workoutTemplateExercises.exerciseId))
    .where(inArray(workoutTemplateExercises.templateId, templateIds))
    .orderBy(asc(workoutTemplateExercises.orderIndex));
}

function templateDto(t: typeof workoutTemplates.$inferSelect, items: Awaited<ReturnType<typeof templateItems>>) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    updatedAt: t.updatedAt,
    exercises: items
      .filter((i) => i.item.templateId === t.id)
      .map((i) => ({
        exerciseId: i.item.exerciseId,
        name: i.name,
        primaryMuscleGroup: i.muscle,
        trackingMode: i.trackingMode,
        orderIndex: i.item.orderIndex,
        targetSets: i.item.targetSets,
        targetReps: i.item.targetReps,
        targetWeight: i.item.targetWeight,
        restSeconds: i.item.restSeconds,
        notes: i.item.notes,
      })),
  };
}

export async function listTemplates(user: SessionUser) {
  const db = getDb();
  const rows = await db.select().from(workoutTemplates).where(and(eq(workoutTemplates.userId, user.id), eq(workoutTemplates.active, true))).orderBy(desc(workoutTemplates.updatedAt));
  const items = await templateItems(db, rows.map((r) => r.id));
  return rows.map((t) => templateDto(t, items));
}

export async function getTemplate(user: SessionUser, id: string) {
  const db = getDb();
  const [t] = await db.select().from(workoutTemplates).where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, user.id), eq(workoutTemplates.active, true)));
  if (!t) throw notFound("Template");
  return templateDto(t, await templateItems(db, [t.id]));
}

async function writeTemplateItems(tx: DbOrTx, userId: string, templateId: string, input: TemplateInput["exercises"]) {
  await assertExercisesAccessible(userId, input.map((e) => e.exerciseId));
  await tx.delete(workoutTemplateExercises).where(eq(workoutTemplateExercises.templateId, templateId));
  if (input.length === 0) return;
  await tx.insert(workoutTemplateExercises).values(
    input.map((e, i) => ({
      templateId,
      exerciseId: e.exerciseId,
      orderIndex: i,
      targetSets: e.targetSets ?? null,
      targetReps: e.targetReps ?? null,
      targetWeight: e.targetWeight ?? null,
      restSeconds: e.restSeconds ?? null,
      notes: e.notes ?? null,
    })),
  );
}

export async function createTemplate(user: SessionUser, input: TemplateInput) {
  const id = await getDb().transaction(async (tx) => {
    const [t] = await tx.insert(workoutTemplates).values({ userId: user.id, name: input.name, description: input.description }).returning({ id: workoutTemplates.id });
    await writeTemplateItems(tx, user.id, t.id, input.exercises);
    return t.id;
  });
  return getTemplate(user, id);
}

export async function updateTemplate(user: SessionUser, id: string, input: TemplateInput) {
  await getDb().transaction(async (tx) => {
    const [t] = await tx.select().from(workoutTemplates).where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, user.id), eq(workoutTemplates.active, true))).for("update");
    if (!t) throw notFound("Template");
    await tx.update(workoutTemplates).set({ name: input.name, description: input.description }).where(eq(workoutTemplates.id, id));
    await writeTemplateItems(tx, user.id, id, input.exercises);
  });
  return getTemplate(user, id);
}

export async function deleteTemplate(user: SessionUser, id: string) {
  const res = await getDb().delete(workoutTemplates).where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, user.id))).returning({ id: workoutTemplates.id });
  if (!res.length) throw notFound("Template");
}

/** Save a finished workout as a reusable template (set counts + best working weight/reps as targets). */
export async function templateFromWorkout(user: SessionUser, workoutId: string, name?: string) {
  const db = getDb();
  const [w] = await db.select().from(workouts).where(and(eq(workouts.id, workoutId), eq(workouts.userId, user.id)));
  if (!w) throw notFound("Workout");
  const wes = await db.select().from(workoutExercises).where(eq(workoutExercises.workoutId, workoutId)).orderBy(asc(workoutExercises.orderIndex));
  const sets = wes.length ? await db.select().from(workoutSets).where(inArray(workoutSets.workoutExerciseId, wes.map((x) => x.id))) : [];
  const input: TemplateInput = {
    name: name ?? w.title,
    description: null,
    exercises: wes.map((we) => {
      const own = sets.filter((s) => s.workoutExerciseId === we.id && s.setType !== "WARMUP");
      const top = own.reduce<typeof own[number] | undefined>((a, b) => (!a || (b.weight ?? 0) > (a.weight ?? 0) ? b : a), undefined);
      return {
        exerciseId: we.exerciseId,
        targetSets: own.length || 3,
        targetReps: top?.reps ? String(top.reps) : null,
        targetWeight: top?.weight ?? null,
        restSeconds: we.restSeconds,
        notes: null,
      };
    }),
  };
  return createTemplate(user, input);
}

/* ---------------------------------- Programs -------------------------------- */

export async function listPrograms(user: SessionUser) {
  const db = getDb();
  const rows = await db
    .select({
      p: programs,
      weeks: sql<number>`(select count(*)::int from program_weeks w where w.program_id = ${programs.id})`,
      assigned: sql<boolean>`exists (select 1 from program_assignments a where a.program_id = ${programs.id} and a.user_id = ${user.id}::uuid and a.status = 'ACTIVE')`,
    })
    .from(programs)
    .where(and(eq(programs.userId, user.id), eq(programs.active, true)))
    .orderBy(desc(programs.updatedAt));
  return rows.map((r) => ({ id: r.p.id, name: r.p.name, description: r.p.description, weeks: r.weeks, assigned: r.assigned }));
}

async function programTree(db: DbOrTx, programId: string) {
  const weeks = await db.select().from(programWeeks).where(eq(programWeeks.programId, programId)).orderBy(asc(programWeeks.weekNumber));
  const days = weeks.length ? await db.select().from(programDays).where(inArray(programDays.programWeekId, weeks.map((w) => w.id))).orderBy(asc(programDays.dayNumber)) : [];
  const items = days.length
    ? await db
        .select({ pe: programExercises, name: exercises.name })
        .from(programExercises)
        .innerJoin(exercises, eq(exercises.id, programExercises.exerciseId))
        .where(inArray(programExercises.programDayId, days.map((d) => d.id)))
        .orderBy(asc(programExercises.orderIndex))
    : [];
  return weeks.map((w) => ({
    id: w.id,
    weekNumber: w.weekNumber,
    name: w.name,
    days: days
      .filter((d) => d.programWeekId === w.id)
      .map((d) => ({
        id: d.id,
        dayNumber: d.dayNumber,
        name: d.name,
        notes: d.notes,
        exercises: items
          .filter((i) => i.pe.programDayId === d.id)
          .map((i) => ({ exerciseId: i.pe.exerciseId, name: i.name, targetSets: i.pe.targetSets, targetReps: i.pe.targetReps, targetWeight: i.pe.targetWeight, notes: i.pe.notes })),
      })),
  }));
}

export async function getProgram(user: SessionUser, id: string) {
  const db = getDb();
  const [p] = await db.select().from(programs).where(and(eq(programs.id, id), eq(programs.userId, user.id), eq(programs.active, true)));
  if (!p) throw notFound("Program");
  const [assignment] = await db
    .select()
    .from(programAssignments)
    .where(and(eq(programAssignments.programId, id), eq(programAssignments.userId, user.id), eq(programAssignments.status, "ACTIVE")));
  return { id: p.id, name: p.name, description: p.description, weeks: await programTree(db, p.id), assignment: assignment ? { id: assignment.id, startDate: assignment.startDate } : null };
}

async function writeProgramTree(tx: DbOrTx, userId: string, programId: string, weeks: ProgramInput["weeks"]) {
  await assertExercisesAccessible(userId, weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))));
  await tx.delete(programWeeks).where(eq(programWeeks.programId, programId));
  for (const [wi, w] of weeks.entries()) {
    const [week] = await tx.insert(programWeeks).values({ programId, weekNumber: wi + 1, name: w.name ?? null }).returning({ id: programWeeks.id });
    for (const [di, d] of w.days.entries()) {
      const [day] = await tx.insert(programDays).values({ programWeekId: week.id, dayNumber: di + 1, name: d.name, notes: d.notes }).returning({ id: programDays.id });
      if (d.exercises.length) {
        await tx.insert(programExercises).values(
          d.exercises.map((e, i) => ({ programDayId: day.id, exerciseId: e.exerciseId, orderIndex: i, targetSets: e.targetSets, targetReps: e.targetReps, targetWeight: e.targetWeight ?? null, notes: e.notes })),
        );
      }
    }
  }
}

export async function createProgram(user: SessionUser, input: ProgramInput) {
  const id = await getDb().transaction(async (tx) => {
    const [p] = await tx.insert(programs).values({ userId: user.id, name: input.name, description: input.description }).returning({ id: programs.id });
    await writeProgramTree(tx, user.id, p.id, input.weeks);
    return p.id;
  });
  return getProgram(user, id);
}

export async function updateProgram(user: SessionUser, id: string, input: ProgramInput) {
  await getDb().transaction(async (tx) => {
    const [p] = await tx.select().from(programs).where(and(eq(programs.id, id), eq(programs.userId, user.id), eq(programs.active, true))).for("update");
    if (!p) throw notFound("Program");
    await tx.update(programs).set({ name: input.name, description: input.description }).where(eq(programs.id, id));
    await writeProgramTree(tx, user.id, id, input.weeks);
  });
  return getProgram(user, id);
}

export async function deleteProgram(user: SessionUser, id: string) {
  const res = await getDb().delete(programs).where(and(eq(programs.id, id), eq(programs.userId, user.id))).returning({ id: programs.id });
  if (!res.length) throw notFound("Program");
}

export async function assignProgram(user: SessionUser, id: string, startDate?: string) {
  const db = getDb();
  const [p] = await db.select().from(programs).where(and(eq(programs.id, id), eq(programs.userId, user.id), eq(programs.active, true)));
  if (!p) throw notFound("Program");
  await db.transaction(async (tx) => {
    await tx.update(programAssignments).set({ status: "CANCELLED", endDate: toLocalDate(new Date(), user.settings.timezone) }).where(and(eq(programAssignments.userId, user.id), eq(programAssignments.status, "ACTIVE")));
    await tx.insert(programAssignments).values({ programId: id, userId: user.id, startDate: startDate ?? toLocalDate(new Date(), user.settings.timezone), status: "ACTIVE" });
  });
}

export async function unassignProgram(user: SessionUser) {
  await getDb().update(programAssignments).set({ status: "CANCELLED" }).where(and(eq(programAssignments.userId, user.id), eq(programAssignments.status, "ACTIVE")));
}

/** Today's planned session for the active program (Day 1 = start date; days map to consecutive calendar days). */
export async function todaysProgramDay(user: SessionUser) {
  const db = getDb();
  const [a] = await db
    .select({ a: programAssignments, name: programs.name })
    .from(programAssignments)
    .innerJoin(programs, eq(programs.id, programAssignments.programId))
    .where(and(eq(programAssignments.userId, user.id), eq(programAssignments.status, "ACTIVE")))
    .limit(1);
  if (!a) return null;
  const today = toLocalDate(new Date(), user.settings.timezone);
  const elapsed = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${a.a.startDate}T00:00:00Z`)) / 86_400_000);
  if (elapsed < 0) return { programId: a.a.programId, programName: a.name, state: "NOT_STARTED" as const, startDate: a.a.startDate, day: null };
  const tree = await programTree(db, a.a.programId);
  const week = tree[Math.floor(elapsed / 7)];
  if (!week) return { programId: a.a.programId, programName: a.name, state: "COMPLETED" as const, startDate: a.a.startDate, day: null };
  const day = week.days.find((d) => d.dayNumber === (elapsed % 7) + 1) ?? null;
  return { programId: a.a.programId, programName: a.name, state: day ? ("WORKOUT" as const) : ("REST" as const), startDate: a.a.startDate, weekNumber: week.weekNumber, day };
}
