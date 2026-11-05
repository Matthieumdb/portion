// Workout rules, the same as the iPhone app where it matters (1RM, prefill, progression).
import { getState } from "./store.js";
import { iso } from "./backup.js";

export const oneRepMax = (weight, reps) => (weight > 0 && reps > 0 ? (reps === 1 ? weight : weight * (1 + reps / 30)) : 0);

export const isWarmup = (set) => set.kind === "warmup";

export function setVolume(set) {
  return set.isCompleted && !isWarmup(set) ? set.weight * set.reps : 0;
}

export const workoutVolume = (w) => w.exercises.reduce((t, e) => t + e.sets.reduce((a, s) => a + setVolume(s), 0), 0);

export function bestOneRepMax(entry) {
  return Math.max(0, ...entry.sets.filter((s) => s.isCompleted && !isWarmup(s)).map((s) => oneRepMax(s.weight, s.reps)));
}

export const findExercise = (name) => getState().exercises.find((e) => e.name === name);

/** Finished entries of an exercise, newest first. */
export function history(name) {
  const out = [];
  for (const w of [...getState().workouts].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    for (const e of w.exercises) if (e.exercise === name && e.sets.some((s) => s.isCompleted)) out.push({ workout: w, entry: e });
  }
  return out;
}

/** Smallest sensible jump: 1,25 kg on light loads, 2,5 kg above 40 kg. */
function increment(weight, exerciseName) {
  const step = findExercise(exerciseName)?.weightStep;
  if (step) return step;
  return weight >= 40 ? 2.5 : 1.25;
}

/** Sets for an exercise, from the last time it was done. When every set reached the
 *  top of the rep range last time, the weight goes up one step. */
export function prefilledSets(name, { targetSets = 3, targetReps = 10, minReps = null } = {}) {
  const last = history(name)[0]?.entry;
  const lastSets = last?.sets.filter((s) => s.isCompleted && !isWarmup(s)) || [];
  const allHit = lastSets.length > 0 && lastSets.every((s) => s.reps >= targetReps);
  const sets = [];
  for (let i = 0; i < targetSets; i++) {
    const ref = lastSets[Math.min(i, lastSets.length - 1)];
    let weight = ref?.weight ?? 0;
    let reps = ref ? ref.reps : targetReps;
    if (ref && allHit && weight > 0) {
      weight += increment(weight, name);
      reps = minReps ?? targetReps;
    }
    sets.push({ reps, weight, isCompleted: false, rpe: null, kind: null });
  }
  return { sets, progressed: allHit && lastSets.some((s) => s.weight > 0) };
}

export function newWorkout(title) {
  return { title, startedAt: iso(), endedAt: null, notes: "", exercises: [] };
}

export function entryFor(name, item = {}) {
  const { sets } = prefilledSets(name, item);
  return {
    exercise: name,
    targetReps: item.targetReps ?? null,
    minReps: item.minReps ?? null,
    restSeconds: item.restSeconds ?? null,
    note: item.notes ?? null,
    supersetGroup: null,
    sets,
  };
}

export function workoutFromTemplate(template) {
  const w = newWorkout(template.name);
  w.exercises = template.items.filter((i) => i.exercise).map((i) => entryFor(i.exercise, i));
  return w;
}

/** Removes unchecked sets and empty exercises before the workout goes to the history. */
export function cleanUp(workout) {
  workout.exercises = workout.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.isCompleted) }))
    .filter((e) => e.sets.length);
  return workout;
}

/** Records beaten in this workout: best estimated 1RM above everything before. */
export function records(workout) {
  const out = [];
  for (const e of workout.exercises) {
    const now = bestOneRepMax(e);
    if (!now) continue;
    const before = Math.max(
      0,
      ...history(e.exercise)
        .filter((h) => h.workout !== workout && h.workout.startedAt < workout.startedAt)
        .map((h) => bestOneRepMax(h.entry))
    );
    if (before > 0 && now > before) out.push({ exercise: e.exercise, now, before });
  }
  return out;
}
