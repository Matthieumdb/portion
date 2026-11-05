// Training model: exercises, workouts, sets and templates, ported from the iPhone app
// (Workout.swift, Exercise.swift, WorkoutTemplate.swift, Equipment.swift, Programs.swift…).
import { S, commit, newId, dayKey } from "./store.js";
import { rnd } from "./ui.js";

// MARK: Calendar (weeks start on Monday, as in France)

export const DAY = 86_400_000;
export function startOfDay(d = Date.now()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
export function startOfWeek(d = Date.now()) {
  const x = new Date(startOfDay(d));
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  return x.getTime();
}
export function addDays(t, n) {
  const x = new Date(t);
  x.setDate(x.getDate() + n);
  return x.getTime();
}
export function addWeeks(t, n) {
  return addDays(t, 7 * n);
}
/** Calendar days from a to b (like dateComponents([.day])). */
export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
}
export const dateFromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

// MARK: Muscle groups

export const MUSCLES = {
  chest: { label: "Pectoraux", color: "var(--red)", icon: "strength" },
  back: { label: "Dos", color: "var(--blue)", icon: "rower" },
  shoulders: { label: "Épaules", color: "var(--orange)", icon: "armsOpen" },
  biceps: { label: "Biceps", color: "var(--purple)", icon: "dumbbell" },
  triceps: { label: "Triceps", color: "var(--indigo)", icon: "functional" },
  legs: { label: "Jambes", color: "var(--green)", icon: "run" },
  glutes: { label: "Fessiers", color: "var(--pink)", icon: "cross" },
  abs: { label: "Abdos", color: "var(--teal)", icon: "core" },
  fullBody: { label: "Full body", color: "var(--brown)", icon: "mixed" },
  cardio: { label: "Cardio", color: "var(--mint)", icon: "heart" },
};
export const MUSCLE_IDS = Object.keys(MUSCLES);
export const muscle = (id) => MUSCLES[id] || MUSCLES.fullBody;

// MARK: Library (Free Exercise DB, public domain)

export const LIB = { all: [], byId: new Map(), byFR: new Map() };

export async function loadLibrary() {
  try {
    const res = await fetch("data/exercise-library.json");
    LIB.all = await res.json();
  } catch {
    LIB.all = [];
  }
  for (const e of LIB.all) {
    if (!LIB.byId.has(e.id)) LIB.byId.set(e.id, e);
    const k = e.nameFR.toLowerCase();
    if (!LIB.byFR.has(k)) LIB.byFR.set(k, e);
  }
}

const BUILT_IN_IDS = {
  "Développé couché": "Barbell_Bench_Press_-_Medium_Grip",
  "Développé incliné haltères": "Incline_Dumbbell_Press",
  "Écarté à la poulie": "Flat_Bench_Cable_Flyes",
  Dips: "Dips_-_Chest_Version",
  Tractions: "Pullups",
  "Rowing barre": "Bent_Over_Barbell_Row",
  "Tirage vertical": "Wide-Grip_Lat_Pulldown",
  "Rowing haltère": "One-Arm_Dumbbell_Row",
  "Soulevé de terre": "Barbell_Deadlift",
  "Développé militaire": "Standing_Military_Press",
  "Élévations latérales": "Side_Lateral_Raise",
  "Face pull": "Face_Pull",
  "Curl barre": "Barbell_Curl",
  "Curl marteau": "Hammer_Curls",
  "Extension triceps poulie": "Triceps_Pushdown",
  "Barre au front": "EZ-Bar_Skullcrusher",
  Squat: "Barbell_Squat",
  "Presse à cuisses": "Leg_Press",
  Fentes: "Dumbbell_Lunges",
  "Leg curl": "Lying_Leg_Curls",
  "Leg extension": "Leg_Extensions",
  "Mollets debout": "Standing_Calf_Raises",
  "Soulevé de terre roumain": "Romanian_Deadlift",
  "Hip thrust": "Barbell_Hip_Thrust",
  Gainage: "Plank",
  Crunch: "Crunches",
  "Rowing poitrine appuyée": "Dumbbell_Incline_Row",
  "Tirage vertical prise neutre": "V-Bar_Pulldown",
  "Curl barre EZ": "EZ-Bar_Curl",
  "Extension triceps au-dessus de la tête": "Cable_Rope_Overhead_Triceps_Extension",
  "Leg curl assis": "Seated_Leg_Curl",
  "Crunch poulie": "Cable_Crunch",
  "Développé incliné machine": "Smith_Machine_Incline_Bench_Press",
  "Développé épaules": "Dumbbell_Shoulder_Press",
  "Pec deck": "Butterfly",
  "Pushdown triceps": "Triceps_Pushdown_-_Rope_Attachment",
  "Rowing assis poulie": "Seated_Cable_Rows",
  "Pull-over poulie": "Straight-Arm_Pulldown",
  "Oiseau (reverse pec deck)": "Reverse_Machine_Flyes",
  "Curl incliné haltères": "Incline_Dumbbell_Curl",
  "Fentes bulgares": "Split_Squat_with_Dumbbells",
  "Leg curl allongé": "Lying_Leg_Curls",
  "Mollets assis": "Seated_Calf_Raise",
  "Adducteurs machine": "Thigh_Adductor",
};
const BUNDLED = new Set(Object.values(BUILT_IN_IDS));

export function libEntryForName(name) {
  const id = BUILT_IN_IDS[name];
  if (id) return LIB.byId.get(id);
  return LIB.byFR.get(name.toLowerCase());
}
export function libEntry(ex) {
  if (!ex) return null;
  if (ex.libraryId && LIB.byId.has(ex.libraryId)) return LIB.byId.get(ex.libraryId);
  return libEntryForName(ex.name) || null;
}
export function imageURL(id, frame) {
  return BUNDLED.has(id) ? `img/exercises/exo_${id}_${frame}.jpg` : `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${id}/${frame}.jpg`;
}

export function libMuscleGroup(e) {
  switch (e.primary[0]) {
    case "chest": return "chest";
    case "lats": case "middle back": case "lower back": case "traps": return "back";
    case "shoulders": case "neck": return "shoulders";
    case "biceps": case "forearms": return "biceps";
    case "triceps": return "triceps";
    case "glutes": return "glutes";
    case "abdominals": return "abs";
    default: return "legs";
  }
}
export function libAppEquipment(e) {
  switch (e.equipment) {
    case "barbell": case "e-z curl bar": return "barbell";
    case "dumbbell": case "kettlebells": return "dumbbell";
    case "cable": return "cable";
    case "machine": return "machine";
    case "body only": return "bodyweight";
    default: return null;
  }
}
export const LIB_MUSCLES = ["chest", "lats", "middle back", "lower back", "traps", "shoulders", "biceps", "triceps", "forearms", "abdominals", "quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors", "neck"];
export const LIB_EQUIPMENTS = ["barbell", "dumbbell", "machine", "cable", "body only", "e-z curl bar", "kettlebells", "bands", "exercise ball", "medicine ball", "other"];
const MUSCLE_LABELS = {
  abdominals: "Abdominaux", abductors: "Abducteurs", adductors: "Adducteurs", biceps: "Biceps", calves: "Mollets", chest: "Pectoraux",
  forearms: "Avant-bras", glutes: "Fessiers", hamstrings: "Ischio-jambiers", lats: "Grand dorsal", "lower back": "Lombaires",
  "middle back": "Milieu du dos", neck: "Cou", quadriceps: "Quadriceps", shoulders: "Épaules", traps: "Trapèzes", triceps: "Triceps",
};
export const libMuscleLabel = (m) => MUSCLE_LABELS[m] || m.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
const EQUIP_LABELS = {
  barbell: "Barre", dumbbell: "Haltères", machine: "Machine", cable: "Poulie", "body only": "Poids du corps", "e-z curl bar": "Barre EZ",
  kettlebells: "Kettlebell", bands: "Élastiques", "exercise ball": "Swiss ball", "medicine ball": "Médecine-ball",
};
export const libEquipmentLabel = (e) => EQUIP_LABELS[e] || "Autre";
export const libLevelLabel = (l) => (l === "beginner" ? "Débutant" : l === "intermediate" ? "Intermédiaire" : "Avancé");
export const libPrimaryLabel = (e) => e.primary.map(libMuscleLabel).join(", ");
export const libInstructions = (e) => e.instructionsFR || e.instructions;
/** localizedStandardContains: case and accent insensitive. */
export const fold = (t) => (t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export const contains = (text, search) => fold(text).includes(fold(search));
export const libMatches = (e, search) => !search || contains(e.nameFR, search) || contains(e.name, search);

// MARK: Equipment

export const EQUIPMENT = {
  barbell: { label: "barre", step: 2.5 },
  dumbbell: { label: "haltères", step: 2 },
  machine: { label: "machine", step: 5 },
  cable: { label: "poulie", step: 2.5 },
  bodyweight: { label: "poids du corps", step: 2.5 },
};
export const STEP_OPTIONS = [0.5, 1, 1.25, 2, 2.5, 5, 10];

export function inferEquipment(name) {
  const n = name.toLowerCase();
  const has = (...w) => w.some((x) => n.includes(x));
  if (has("haltère")) return "dumbbell";
  if (has("poulie", "pushdown", "face pull", "tirage", "pull-over", "extension triceps")) return "cable";
  if (has("machine", "presse", "leg extension", "leg curl", "pec deck", "mollets", "adducteur", "abducteur", "smith")) return "machine";
  if (has("traction", "dips", "gainage", "crunch", "pompes")) return "bodyweight";
  if (has("élévations", "curl marteau", "fentes", "appuyée", "oiseau")) return "dumbbell";
  return "barbell";
}
export function equipmentOf(ex) {
  if (ex.libraryId) {
    const e = libEntry(ex);
    const eq = e && libAppEquipment(e);
    if (eq) return eq;
  }
  return inferEquipment(ex.name);
}
export const effectiveStep = (ex) => ex.weightStep ?? EQUIPMENT[equipmentOf(ex)].step;
export function progressionIncrement(ex, weight) {
  const step = effectiveStep(ex);
  if (!(step > 0)) return 0;
  const target = (weight * S.settings.progressionPercent) / 100;
  return Math.max(step, rnd(target / step) * step);
}

// MARK: Lookups and derived values

export const exById = (id) => S.exercises.find((e) => e.id === id);
export const exByName = (name) => S.exercises.find((e) => e.name === name);
export const activeWorkout = () => S.workouts.find((w) => w.endedAt == null) || null;
export const finishedWorkouts = () => S.workouts.filter((w) => w.endedAt != null).sort((a, b) => b.startedAt - a.startedAt);

export const epley = (w, r) => (w <= 0 || r <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30));
export const setVolume = (s) => (s.kind === "warmup" ? 0 : s.reps * s.weight);
export const set1RM = (s) => (s.kind === "warmup" ? 0 : epley(s.weight, s.reps));
export const entryVolume = (e) => e.sets.reduce((a, s) => a + setVolume(s), 0);
export const entryMaxWeight = (e) => (e.sets.length ? Math.max(...e.sets.map((s) => s.weight)) : 0);
export const entryBest1RM = (e) => (e.sets.length ? Math.max(...e.sets.map(set1RM)) : 0);
export const entryBestSet = (e) => e.sets.reduce((best, s) => (!best || set1RM(s) > set1RM(best) ? s : best), null);
export const workoutVolume = (w) => w.exercises.reduce((a, e) => a + entryVolume(e), 0);
export const workoutSetCount = (w) => w.exercises.reduce((a, e) => a + e.sets.length, 0);
export const workoutDuration = (w) => (w.endedAt ?? Date.now()) - w.startedAt;
export const entrySummary = (e) => e.sets.map((s) => `${fmtKg(s.weight)} × ${s.reps}`).join(" · ");
const fmtKg = (v) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} kg`;

export function reachedTarget(set) {
  if (set.targetReps == null) return false;
  return set.weight >= (set.targetWeight ?? 0) && set.reps >= set.targetReps;
}

/** Cached index: exercise id → history entries [{entry, workout}] newest first. */
let histCache = { key: null, map: new Map() };
export function historyOf(exId) {
  const key = S.workouts;
  const stamp = S.workouts.length + ":" + S.workouts.reduce((a, w) => a + (w.endedAt || 0) % 9973, 0);
  if (histCache.key !== key || histCache.stamp !== stamp || histCache.dirty) {
    const map = new Map();
    for (const w of S.workouts) {
      if (w.endedAt == null) continue;
      for (const e of w.exercises) {
        if (!e.sets.length || !e.exerciseId) continue;
        if (!map.has(e.exerciseId)) map.set(e.exerciseId, []);
        map.get(e.exerciseId).push({ entry: e, workout: w });
      }
    }
    for (const list of map.values()) list.sort((a, b) => b.workout.startedAt - a.workout.startedAt);
    histCache = { key, stamp, map, dirty: false };
  }
  return histCache.map.get(exId) || [];
}
export function invalidateHistory() {
  histCache.dirty = true;
}

export function previousBest1RM(entry, workout) {
  const list = historyOf(entry.exerciseId).filter((h) => h.workout.id !== workout.id);
  if (!list.length) return null;
  return Math.max(...list.map((h) => entryBest1RM(h.entry)));
}

export function mainMuscleGroup(w) {
  const counts = {};
  for (const e of w.exercises) {
    const ex = exById(e.exerciseId);
    if (!ex) continue;
    counts[ex.muscleGroup] = (counts[ex.muscleGroup] || 0) + e.sets.length;
  }
  let best = null;
  for (const [g, c] of Object.entries(counts)) if (best == null || c > counts[best]) best = g;
  return best;
}

export function templateMuscleGroups(t) {
  const groups = [];
  for (const it of t.items) {
    const ex = exById(it.exerciseId);
    if (ex && !groups.includes(ex.muscleGroup)) groups.push(ex.muscleGroup);
  }
  return groups;
}
export const templateSummary = (t) => t.items.map((i) => exById(i.exerciseId)?.name).filter(Boolean).join(" · ");

export function exerciseSections(search = "") {
  const list = search ? S.exercises.filter((e) => contains(e.name, search)) : S.exercises;
  return MUSCLE_IDS.map((g) => ({ group: g, exercises: list.filter((e) => e.muscleGroup === g).sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })) })).filter((s) => s.exercises.length);
}

// MARK: Targets (double progression)

export function repRange(minReps, targetReps, previous) {
  if (minReps != null && targetReps != null && minReps <= targetReps) return [minReps, targetReps];
  if (targetReps != null) return [targetReps, targetReps];
  const typical = previous.length ? Math.max(...previous.map((s) => s.reps)) : 10;
  if (typical <= 6) return [4, 6];
  if (typical <= 12) return [8, 12];
  return [12, 20];
}

export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
export function estimateRPE(weight, reps, reference) {
  if (!(reference > 0) || !(weight > 0) || !(reps > 0)) return null;
  const possible = 30 * (reference / weight - 1);
  const rpe = (10 - (possible - reps)) * 2;
  return Math.min(10, Math.max(5, rnd(rpe) / 2));
}
export function rpeMeaning(r) {
  return { 10: "Échec, plus aucune rep possible", 9.5: "Peut-être une rep de plus", 9: "1 rep en réserve", 8.5: "1 à 2 reps en réserve", 8: "2 reps en réserve", 7.5: "2 à 3 reps en réserve", 7: "3 reps en réserve", 6.5: "3 à 4 reps en réserve", 6: "4 reps en réserve" }[r] ?? "5 reps ou plus en réserve";
}

export function nextTarget(set, [lo, hi], ex, oneRepMax) {
  const { weight, reps } = set;
  if (!(weight > 0)) return { weight: 0, reps: reps + 1 };
  const effort = set.rpe ?? estimateRPE(weight, reps, oneRepMax);
  const inc = progressionIncrement(ex, weight);
  if (reps >= hi) return { weight: weight + inc, reps: lo };
  if (effort != null && effort <= 7 && reps >= lo) return { weight: weight + inc, reps };
  if (reps < lo - 2) return { weight: Math.max(0, weight - inc), reps: lo };
  if (effort != null && effort >= 10 && reps < lo) return { weight, reps: lo };
  return { weight, reps: Math.min(reps + 1, hi) };
}

export const SET_KINDS = {
  normal: { label: "Série normale", letter: null, icon: "list" },
  warmup: { label: "Échauffement", letter: "É", icon: "flame" },
  drop: { label: "Série dégressive", letter: "D", icon: "arrowDown" },
  failure: { label: "Jusqu'à l'échec", letter: "X", icon: "bolt" },
};
export const kindOf = (s) => s.kind || "normal";

export function newSet(reps, weight) {
  return { id: newId(), reps, weight, isCompleted: false, rpe: null, targetWeight: null, targetReps: null, kind: null };
}

/** Adds an exercise, prefilled from the last time it was done (or from template targets). */
export function addExercise(w, ex, { targetSets, targetReps, minReps, restSeconds, note, allowProgression = true } = {}) {
  const hist = historyOf(ex.id);
  const previous = hist[0]?.entry.sets ?? [];
  const entry = {
    id: newId(), exerciseId: ex.id, targetReps: targetReps ?? null, minReps: minReps ?? null, restSeconds: restSeconds ?? null,
    note: note ?? null, progressionIncrement: null, supersetGroup: null, sets: [],
  };
  const range = repRange(minReps, targetReps, previous);
  const ref1RM = hist[0] ? entryBest1RM(hist[0].entry) : null;
  let increment = 0;
  const count = targetSets ?? Math.max(previous.length, 1);
  for (let i = 0; i < count; i++) {
    const reference = previous.length ? previous[Math.min(i, previous.length - 1)] : null;
    if (reference && reference.reps > 0) {
      const t = allowProgression ? nextTarget(reference, range, ex, ref1RM) : { weight: reference.weight, reps: Math.min(reference.reps, range[1]) };
      increment = Math.max(increment, t.weight - reference.weight);
      const s = newSet(t.reps, t.weight);
      s.targetWeight = t.weight;
      s.targetReps = t.reps;
      entry.sets.push(s);
    } else {
      entry.sets.push(newSet(targetReps ?? 10, 0));
    }
  }
  entry.progressionIncrement = increment > 0 ? increment : null;
  w.exercises.push(entry);
  return entry;
}

/** Swaps the exercise of an entry, prefilling the sets not done yet. */
export function replaceExercise(entry, ex) {
  const hist = historyOf(ex.id);
  const previous = hist[0]?.entry.sets ?? [];
  entry.exerciseId = ex.id;
  entry.progressionIncrement = null;
  const range = repRange(entry.minReps, entry.targetReps, previous);
  const ref1RM = hist[0] ? entryBest1RM(hist[0].entry) : null;
  entry.sets.forEach((set, i) => {
    if (set.isCompleted) return;
    if (!previous.length) {
      set.weight = 0;
      set.targetWeight = null;
      set.targetReps = null;
      return;
    }
    const t = nextTarget(previous[Math.min(i, previous.length - 1)], range, ex, ref1RM);
    set.weight = t.weight;
    set.reps = t.reps;
    set.targetWeight = t.weight;
    set.targetReps = t.reps;
  });
}

export function templatesUsing(w, exId) {
  return S.templates.filter((t) => t.name === w.title && t.items.some((i) => i.exerciseId === exId));
}

export function moveEntry(w, entry, offset) {
  const i = w.exercises.indexOf(entry);
  const j = i + offset;
  if (i < 0 || j < 0 || j >= w.exercises.length) return;
  [w.exercises[i], w.exercises[j]] = [w.exercises[j], w.exercises[i]];
}

/** Ends the workout, dropping unchecked sets (and the workout if nothing was done). */
export function finishWorkout(w) {
  w.endedAt = Date.now();
  const kept = w.exercises.filter((e) => e.sets.some((s) => s.isCompleted));
  if (!kept.length) {
    S.workouts = S.workouts.filter((x) => x !== w);
    return null;
  }
  w.exercises = kept.map((e) => ({ ...e, sets: e.sets.filter((s) => s.isCompleted) }));
  // A superset of one is no superset
  const counts = {};
  w.exercises.forEach((e) => e.supersetGroup != null && (counts[e.supersetGroup] = (counts[e.supersetGroup] || 0) + 1));
  w.exercises.forEach((e) => e.supersetGroup != null && counts[e.supersetGroup] < 2 && (e.supersetGroup = null));
  invalidateHistory();
  return w;
}
export function discardWorkout(w) {
  S.workouts = S.workouts.filter((x) => x !== w);
}

export function toggleSuperset(w, entry) {
  if (entry.supersetGroup != null) {
    const g = entry.supersetGroup;
    entry.supersetGroup = null;
    const left = w.exercises.filter((e) => e.supersetGroup === g);
    if (left.length === 1) left[0].supersetGroup = null;
    return;
  }
  const i = w.exercises.indexOf(entry);
  if (i < 0 || i + 1 >= w.exercises.length) return;
  const next = w.exercises[i + 1];
  const group = next.supersetGroup ?? Math.max(0, ...w.exercises.map((e) => e.supersetGroup ?? 0)) + 1;
  entry.supersetGroup = group;
  next.supersetGroup = group;
}
export function restsAfter(w, entry) {
  if (entry.supersetGroup == null) return true;
  const same = w.exercises.filter((e) => e.supersetGroup === entry.supersetGroup);
  return same[same.length - 1] === entry;
}
export function supersetLetter(w, group) {
  const groups = [];
  for (const e of w.exercises) if (e.supersetGroup != null && !groups.includes(e.supersetGroup)) groups.push(e.supersetGroup);
  const i = Math.max(0, groups.indexOf(group));
  return String.fromCharCode(65 + (i % 26));
}

/** Inserts warm-up sets before the first working set: the bar, then about 50, 70 and 85 %. */
export function addWarmUp(entry, barWeight) {
  const working = entry.sets.find((s) => s.kind !== "warmup" && s.weight > 0);
  if (!working) return false;
  const top = working.weight;
  const ex = exById(entry.exerciseId);
  const step = ex ? progressionIncrement(ex, top) : 2.5;
  const round = (w) => Math.max(0, rnd(w / step) * step);
  const plan = [];
  if (barWeight > 0 && barWeight < top * 0.5) plan.push([barWeight, 10]);
  for (const [share, reps] of [[0.5, 8], [0.7, 5], [0.85, 3]]) {
    const w = round(top * share);
    if (w > (plan.length ? plan[plan.length - 1][0] : 0) && w < top) plan.push([w, reps]);
  }
  if (!plan.length) return false;
  entry.sets.unshift(...plan.map(([w, r]) => ({ ...newSet(r, w), kind: "warmup" })));
  return true;
}

export function targetDescription(entry) {
  if (entry.targetReps == null) return null;
  const reps = entry.minReps != null ? `${entry.minReps}-${entry.targetReps}` : `${entry.targetReps}`;
  let text = `${entry.sets.length} × ${reps} reps`;
  if (entry.restSeconds != null) text += ` · repos ${restText(entry.restSeconds)}`;
  return text;
}
export const restText = (s) => (s % 60 === 0 ? `${s / 60} min` : `${Math.trunc(s / 60)} min ${s % 60}`);

// MARK: Exercises and templates

export function newExercise(name, muscleGroup, { notes = "", libraryId = null, weightStep = null } = {}) {
  return { id: newId(), name, muscleGroup, notes, createdAt: Date.now(), weightStep, libraryId };
}
export function newTemplate(name) {
  return { id: newId(), name, createdAt: Date.now(), programName: null, programOrder: null, items: [] };
}
export function newTemplateItem(exId) {
  return { id: newId(), exerciseId: exId, targetSets: 3, targetReps: 10, minReps: null, restSeconds: null, notes: null };
}
export function deleteExercise(ex) {
  S.exercises = S.exercises.filter((e) => e !== ex);
  // nullify, as in SwiftData
  for (const w of S.workouts) for (const e of w.exercises) if (e.exerciseId === ex.id) e.exerciseId = null;
  for (const t of S.templates) for (const i of t.items) if (i.exerciseId === ex.id) i.exerciseId = null;
  invalidateHistory();
}
export function replaceInTemplate(t, oldId, newEx) {
  for (const i of t.items) if (i.exerciseId === oldId) i.exerciseId = newEx.id;
}

// MARK: Training mode (light day / deload week asked by the recovery coach)

export const isLightToday = () => S.settings.lightDay === dayKey();
export const deloadEnd = () => (S.settings.deloadUntil && S.settings.deloadUntil > Date.now() ? S.settings.deloadUntil : null);
export const isReduced = () => isLightToday() || deloadEnd() != null;

/** Starts a workout from a template. A deload halves the sets and skips the weight increase. */
export function startFromTemplate(t, deload = isReduced()) {
  const w = newWorkout(t.name);
  for (const item of t.items) {
    const ex = exById(item.exerciseId);
    if (!ex) continue;
    addExercise(w, ex, {
      targetSets: deload ? Math.max(1, Math.trunc((item.targetSets + 1) / 2)) : item.targetSets,
      targetReps: item.targetReps, minReps: item.minReps, restSeconds: item.restSeconds, note: item.notes, allowProgression: !deload,
    });
  }
  S.workouts.push(w);
  return w;
}
export function newWorkout(title) {
  return { id: newId(), title, startedAt: Date.now(), endedAt: null, notes: "", exercises: [] };
}

/** "Refaire": a new workout with the same exercises and targets. */
export function repeatWorkout(src) {
  const w = newWorkout(src.title);
  for (const e of src.exercises) {
    const ex = exById(e.exerciseId);
    if (!ex) continue;
    addExercise(w, ex, { targetSets: e.sets.filter((s) => s.kind !== "warmup").length || e.sets.length, targetReps: e.targetReps, minReps: e.minReps, restSeconds: e.restSeconds, note: e.note });
  }
  S.workouts.push(w);
  return w;
}

// MARK: Programs

const NO_FAILURE = "Pas d'échec : garde 1 à 2 reps en réserve.";
const LAST_FAIL = "Dernière série à l'échec.";
const pe = (name, group, sets, minReps, maxReps, rest, note = null) => ({ name, group, sets, minReps, maxReps, rest, note });
export const PROGRAMS = [
  {
    name: "Hypertrophie 5 séances",
    summary: "Upper / Lower / Push / Pull / Legs. Chaque muscle 2 fois par semaine, 12 à 16 séries dures par muscle, double progression et décharge toutes les 8 semaines.",
    sessions: [
      { name: "Upper", day: "Lundi", exercises: [
        pe("Développé couché", "chest", 3, 6, 8, 180, NO_FAILURE), pe("Rowing poitrine appuyée", "back", 3, 8, 10, 150),
        pe("Développé incliné haltères", "chest", 2, 8, 12, 120), pe("Tirage vertical prise neutre", "back", 3, 8, 12, 120),
        pe("Élévations latérales", "shoulders", 3, 12, 20, 90, LAST_FAIL), pe("Curl barre EZ", "biceps", 2, 8, 12, 90, LAST_FAIL),
        pe("Extension triceps au-dessus de la tête", "triceps", 2, 10, 15, 90, "À la poulie. Dernière série à l'échec."),
      ] },
      { name: "Lower", day: "Mardi", exercises: [
        pe("Squat", "legs", 3, 6, 8, 180, NO_FAILURE), pe("Soulevé de terre roumain", "glutes", 3, 8, 10, 150, NO_FAILURE),
        pe("Leg extension", "legs", 3, 10, 15, 90, LAST_FAIL), pe("Leg curl assis", "legs", 3, 10, 15, 90, LAST_FAIL),
        pe("Mollets debout", "legs", 3, 8, 12, 90, "Pause d'une seconde en bas."), pe("Crunch poulie", "abs", 3, 10, 15, 60),
      ] },
      { name: "Push", day: "Jeudi", exercises: [
        pe("Développé incliné machine", "chest", 3, 8, 10, 150, "Smith ou machine."), pe("Développé épaules", "shoulders", 2, 8, 12, 120),
        pe("Pec deck", "chest", 3, 12, 15, 90, "Ou écarté à la poulie. Dernière série à l'échec."), pe("Élévations latérales", "shoulders", 3, 12, 20, 90, LAST_FAIL),
        pe("Dips", "chest", 2, 8, 12, 120), pe("Pushdown triceps", "triceps", 3, 10, 15, 90, LAST_FAIL),
      ] },
      { name: "Pull", day: "Vendredi", exercises: [
        pe("Tractions", "back", 3, 6, 10, 150, "Lestées si besoin pour rester dans la fourchette."), pe("Rowing assis poulie", "back", 3, 8, 12, 120),
        pe("Pull-over poulie", "back", 2, 10, 15, 90), pe("Oiseau (reverse pec deck)", "shoulders", 3, 12, 20, 90, LAST_FAIL),
        pe("Curl incliné haltères", "biceps", 3, 10, 15, 90, LAST_FAIL), pe("Curl marteau", "biceps", 2, 10, 15, 90, LAST_FAIL),
      ] },
      { name: "Legs", day: "Samedi", exercises: [
        pe("Presse à cuisses", "legs", 3, 10, 15, 150), pe("Fentes bulgares", "legs", 2, 8, 12, 120, "Reps par jambe."),
        pe("Leg curl allongé", "legs", 3, 10, 15, 90, LAST_FAIL), pe("Hip thrust", "glutes", 2, 8, 12, 120),
        pe("Leg extension", "legs", 2, 12, 15, 90, LAST_FAIL), pe("Mollets assis", "legs", 3, 12, 15, 90), pe("Adducteurs machine", "legs", 2, 12, 15, 60),
      ] },
    ],
    rules: [
      "Toutes les séries à 1 ou 2 répétitions de l'échec (RIR 1-2).",
      "Pas d'échec sur le squat, le soulevé de terre roumain et le développé couché lourd.",
      "Double progression : monte les reps jusqu'au haut de la fourchette sur toutes les séries, puis augmente la charge. L'app le fait pour toi.",
      "Semaine type : lundi Upper, mardi Lower, jeudi Push, vendredi Pull, samedi Legs.",
    ],
  },
];
export const CYCLE_WEEKS = 8;

export function programPhase(start, now = Date.now()) {
  const days = daysBetween(start, now);
  const week = (Math.trunc(Math.max(0, days) / 7) % CYCLE_WEEKS) + 1;
  if (week <= 2) return { week, title: "Reprise", detail: "Garde 2 à 3 répétitions en réserve.", isDeload: false };
  if (week <= 6) return { week, title: "Progression", detail: "1 à 2 répétitions en réserve, dernière série des isolations à l'échec.", isDeload: false };
  if (week === 7) return { week, title: "Surcharge", detail: "Ajoute 1 série sur 1 ou 2 muscles en retard.", isDeload: false };
  return { week, title: "Décharge", detail: "Moitié des séries, 3 à 4 répétitions en réserve.", isDeload: true };
}
export const programTemplates = (name) => S.templates.filter((t) => t.programName === name);

export function installProgram(p) {
  S.templates = S.templates.filter((t) => t.programName !== p.name);
  const byName = new Map();
  for (const e of S.exercises) if (!byName.has(e.name.toLowerCase())) byName.set(e.name.toLowerCase(), e);
  p.sessions.forEach((session, index) => {
    const t = newTemplate(session.name);
    t.programName = p.name;
    t.programOrder = index;
    for (const pe of session.exercises) {
      const key = pe.name.toLowerCase();
      let ex = byName.get(key);
      if (!ex) {
        ex = newExercise(pe.name, pe.group);
        S.exercises.push(ex);
        byName.set(key, ex);
      }
      const it = newTemplateItem(ex.id);
      Object.assign(it, { targetSets: pe.sets, minReps: pe.minReps, targetReps: pe.maxReps, restSeconds: pe.rest, notes: pe.note });
      t.items.push(it);
    }
    S.templates.push(t);
  });
  S.settings.programStartDate = Date.now();
}
export function uninstallProgram(name) {
  S.templates = S.templates.filter((t) => t.programName !== name);
  S.settings.programStartDate = null;
}

// MARK: Seed

const SEED = [
  ["Développé couché", "chest"], ["Développé incliné haltères", "chest"], ["Écarté à la poulie", "chest"], ["Dips", "chest"],
  ["Tractions", "back"], ["Rowing barre", "back"], ["Tirage vertical", "back"], ["Rowing haltère", "back"], ["Soulevé de terre", "back"],
  ["Développé militaire", "shoulders"], ["Élévations latérales", "shoulders"], ["Face pull", "shoulders"],
  ["Curl barre", "biceps"], ["Curl marteau", "biceps"], ["Extension triceps poulie", "triceps"], ["Barre au front", "triceps"],
  ["Squat", "legs"], ["Presse à cuisses", "legs"], ["Fentes", "legs"], ["Leg curl", "legs"], ["Leg extension", "legs"], ["Mollets debout", "legs"],
  ["Soulevé de terre roumain", "glutes"], ["Hip thrust", "glutes"], ["Gainage", "abs"], ["Crunch", "abs"],
];
export function seedIfNeeded() {
  if (S.meta.seeded) return;
  if (!S.exercises.length) S.exercises = SEED.map(([n, g]) => newExercise(n, g));
  S.meta.seeded = true;
}

// MARK: Settings

export const REST_OPTIONS = [60, 90, 120, 150, 180, 240];
export const PROGRESSION_OPTIONS = [2.5, 5];
export const BAR_OPTIONS = [20, 15, 10, 0];
export const APPEARANCES = [["light", "Clair"], ["dark", "Sombre"], ["system", "Comme l'iPhone"]];

// MARK: Body data

export const MEASUREMENTS = {
  bodyFat: { label: "Masse grasse", unit: "%", icon: "percent" },
  waist: { label: "Tour de taille", unit: "cm", icon: "armsOpen" },
  chest: { label: "Poitrine", unit: "cm", icon: "strength" },
  shoulders: { label: "Épaules", unit: "cm", icon: "strength" },
  arm: { label: "Bras", unit: "cm", icon: "dumbbell" },
  forearm: { label: "Avant-bras", unit: "cm", icon: "dumbbell" },
  thigh: { label: "Cuisse", unit: "cm", icon: "run" },
  calf: { label: "Mollet", unit: "cm", icon: "run" },
  hips: { label: "Hanches", unit: "cm", icon: "armsOpen" },
  neck: { label: "Cou", unit: "cm", icon: "person" },
};
export const MEASUREMENT_IDS = Object.keys(MEASUREMENTS);
export const lowerIsBetter = (k) => ["bodyFat", "waist", "hips"].includes(k);
export const measurementText = (k, v) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} ${MEASUREMENTS[k].unit}`;
export const POSES = [["front", "Face"], ["side", "Profil"], ["back", "Dos"]];

export function checkInFor(day, create = false) {
  let c = S.checkIns.find((x) => x.day === day);
  if (!c && create) {
    c = { day, sleepHours: null, sleepQuality: null, energy: null, soreness: null, stress: null, water: 0, alcohol: 0, caffeine: 0, note: "" };
    S.checkIns.push(c);
  }
  return c || null;
}
export const hasFeelings = (c) => c && (c.sleepHours != null || c.sleepQuality != null || c.energy != null || c.soreness != null || c.stress != null);

export { commit };
