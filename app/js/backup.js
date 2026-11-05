// Backup file, in the same format as the iPhone app (Réglages > Sauvegarde),
// so a file made on one can be restored on the other.
import { S, commit, replaceState, setMigrator, newId, emptyState, dayKey } from "./store.js";
import { listSnapshotDays, loadSnapshot } from "./db.js";
import { finishedWorkouts, MUSCLES } from "./model.js";
import { normalizeNutrition, readPortion, keyDate } from "./nutrition.js";

const WEEK = 7 * 86_400_000;

/** ISO 8601 without milliseconds, as the iPhone app reads it. */
export function iso(date = Date.now()) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, "Z");
}
const time = (d) => (typeof d === "number" ? d : new Date(d).getTime());
const opt = (v) => (v === undefined ? null : v);
const intOf = (v) => Math.round(Number(v) || 0);

export function makeBackup() {
  const exName = new Map(S.exercises.map((e) => [e.id, e.name]));
  const backup = {
    version: 1,
    exportedAt: iso(),
    exercises: [...S.exercises].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).map((e) => ({ name: e.name, muscleGroup: e.muscleGroup, notes: e.notes || "", weightStep: opt(e.weightStep), libraryId: opt(e.libraryId) })),
    workouts: [...finishedWorkouts()].reverse().map((w) => ({
      title: w.title,
      startedAt: iso(w.startedAt),
      endedAt: w.endedAt ? iso(w.endedAt) : null,
      notes: w.notes || "",
      exercises: w.exercises.map((e) => ({
        exercise: e.exerciseId ? exName.get(e.exerciseId) ?? null : null,
        targetReps: opt(e.targetReps), minReps: opt(e.minReps), restSeconds: opt(e.restSeconds), note: opt(e.note), supersetGroup: opt(e.supersetGroup),
        sets: e.sets.map((s) => ({ rpe: opt(s.rpe), reps: intOf(s.reps), weight: Number(s.weight) || 0, isCompleted: !!s.isCompleted, kind: s.kind || null })),
      })),
    })),
    templates: [...S.templates].sort((a, b) => a.createdAt - b.createdAt).map((t) => ({
      name: t.name, programName: opt(t.programName), programOrder: opt(t.programOrder),
      items: t.items.map((i) => ({ exercise: i.exerciseId ? exName.get(i.exerciseId) ?? null : null, targetSets: intOf(i.targetSets), targetReps: intOf(i.targetReps), minReps: opt(i.minReps), restSeconds: opt(i.restSeconds), notes: opt(i.notes) })),
    })),
    bodyWeights: [...S.bodyWeights].sort((a, b) => a.date - b.date).map((b) => ({ date: iso(b.date), weight: b.weight })),
    measurements: [...S.measurements].sort((a, b) => a.date - b.date).map((m) => ({ date: iso(m.date), kind: m.kind, value: m.value })),
    checkIns: [...S.checkIns].sort((a, b) => (a.day < b.day ? -1 : 1)).map((c) => ({
      day: c.day, sleepHours: opt(c.sleepHours), sleepQuality: opt(c.sleepQuality), energy: opt(c.energy), soreness: opt(c.soreness), stress: opt(c.stress),
      water: intOf(c.water), alcohol: intOf(c.alcohol), caffeine: intOf(c.caffeine), note: c.note || "",
    })),
  };
  if (S.nutrition) backup.nutrition = exportNutrition(S.nutrition);
  return backup;
}

function exportNutrition(n) {
  const x = JSON.parse(JSON.stringify(normalizeNutrition(n)));
  delete x.settings.training;
  return x;
}

/** Converts a backup (the iPhone app's format, or a v1 web state) into this app's state. */
export function fromBackup(data, base = emptyState()) {
  const out = { ...base, exercises: [], workouts: [], templates: [], bodyWeights: [], measurements: [], checkIns: [] };
  const byName = new Map();
  const exFor = (name) => {
    if (name == null) return null;
    if (!byName.has(name)) {
      // A workout naming an exercise missing from the list: keep it, as the iPhone would lose it
      const e = { id: newId(), name, muscleGroup: "fullBody", notes: "", createdAt: Date.now(), weightStep: null, libraryId: null };
      byName.set(name, e);
      out.exercises.push(e);
    }
    return byName.get(name).id;
  };
  for (const r of data.exercises || []) {
    if (byName.has(r.name)) continue;
    const e = { id: newId(), name: r.name, muscleGroup: MUSCLES[r.muscleGroup] ? r.muscleGroup : "fullBody", notes: r.notes || "", createdAt: Date.now(), weightStep: r.weightStep ?? null, libraryId: r.libraryId ?? null };
    byName.set(r.name, e);
    out.exercises.push(e);
  }
  const convWorkout = (r, ended = true) => ({
    id: newId(),
    title: r.title || "Séance",
    startedAt: time(r.startedAt),
    endedAt: ended ? time(r.endedAt ?? r.startedAt) : null,
    notes: r.notes || "",
    exercises: (r.exercises || []).map((e) => ({
      id: newId(), exerciseId: exFor(e.exercise), targetReps: e.targetReps ?? null, minReps: e.minReps ?? null, restSeconds: e.restSeconds ?? null, note: e.note ?? null,
      progressionIncrement: null, supersetGroup: e.supersetGroup ?? null,
      sets: (e.sets || []).map((s) => ({ id: newId(), reps: intOf(s.reps), weight: Number(s.weight) || 0, isCompleted: !!s.isCompleted, rpe: s.rpe ?? null, targetWeight: null, targetReps: null, kind: s.kind || null })),
    })),
  });
  out.workouts = (data.workouts || []).map((r) => convWorkout(r));
  if (data.active) out.workouts.push(convWorkout(data.active, false));
  out.templates = (data.templates || []).map((t, i) => ({
    id: newId(), name: t.name, createdAt: Date.now() - 1000 * ((data.templates || []).length - i), programName: t.programName ?? null, programOrder: t.programOrder ?? null,
    items: (t.items || []).filter((it) => it.exercise != null && byName.has(it.exercise)).map((it) => ({ id: newId(), exerciseId: byName.get(it.exercise).id, targetSets: intOf(it.targetSets) || 3, targetReps: intOf(it.targetReps) || 10, minReps: it.minReps ?? null, restSeconds: it.restSeconds ?? null, notes: it.notes ?? null })),
  }));
  out.bodyWeights = (data.bodyWeights || []).map((b) => ({ id: newId(), date: time(b.date), weight: Number(b.weight) }));
  out.measurements = (data.measurements || []).map((m) => ({ id: newId(), date: time(m.date), kind: m.kind, value: Number(m.value) }));
  out.checkIns = (data.checkIns || []).map((c) => ({ day: c.day, sleepHours: c.sleepHours ?? null, sleepQuality: c.sleepQuality ?? null, energy: c.energy ?? null, soreness: c.soreness ?? null, stress: c.stress ?? null, water: intOf(c.water), alcohol: intOf(c.alcohol), caffeine: intOf(c.caffeine), note: c.note || "" }));
  out.nutrition = data.nutrition ? normalizeNutrition(data.nutrition) : base.nutrition ?? null;
  // A v1 web backup carried Portion's localStorage: bring it in as native nutrition
  if (!data.nutrition && data.portionLocalStorage) {
    const r = readPortion(data.portionLocalStorage);
    out.nutrition = r.state;
    const existing = new Set(out.bodyWeights.map((b) => dayKey(b.date)));
    for (const [day, kg] of Object.entries(r.weights)) {
      if (existing.has(day) || !(kg > 0)) continue;
      out.bodyWeights.push({ id: newId(), date: keyDate(day) + 8 * 3_600_000, weight: kg });
    }
  }
  out.meta = { ...(base.meta || {}), seeded: true };
  return out;
}

// v1 web state (backup-shaped, with `active` and `settings.restSeconds`)
setMigrator((v1) => {
  const base = emptyState();
  const out = fromBackup(v1, base);
  out.settings = { ...base.settings, restDuration: v1.settings?.restSeconds ?? 90, barWeight: v1.settings?.barWeight ?? 20, weeklyReminder: v1.settings?.weeklyReminder ?? true };
  out.meta = { ...base.meta, ...(v1.meta || {}), seeded: true };
  out.version = 2;
  return out;
});

export function backupFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `Musculation-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** Opens the share sheet (Enregistrer dans Fichiers, iCloud Drive…) or downloads the file. */
export async function exportBackup() {
  const json = JSON.stringify(makeBackup(), null, 2);
  const name = backupFileName();
  const ok = await shareFile(new File([json], name, { type: "application/json" }));
  if (ok) commit((s) => (s.meta.lastExportAt = iso()));
  return ok;
}

export async function shareFile(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return true;
    } catch (e) {
      if (e?.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Reads a backup file and returns what it holds, without applying it. */
export async function readBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde Musculation.");
  }
  if (!Array.isArray(data.exercises) || !Array.isArray(data.workouts)) throw new Error("Ce fichier n'est pas une sauvegarde Musculation.");
  return data;
}

/** Replaces the data with the backup, keeping the settings of this device. */
export function applyBackup(data) {
  const next = fromBackup(data, S);
  next.settings = S.settings;
  next.rest = null;
  return replaceState(next);
}

/** True when the weekly backup reminder should show. */
export function backupIsDue() {
  if (!S.settings.weeklyReminder) return false;
  const hasData = S.workouts.length || S.bodyWeights.length || S.templates.length || (S.nutrition && Object.keys(S.nutrition.logs).length);
  if (!hasData) return false;
  const since = S.meta.lastExportAt || S.meta.createdAt;
  return Date.now() - new Date(since).getTime() > WEEK;
}

// MARK: Restore points

export const restorePoints = () => listSnapshotDays();

export async function restorePoint(day) {
  const snap = await loadSnapshot(day);
  if (!snap) throw new Error("Point de restauration introuvable.");
  let st = snap.state;
  if ((st.version ?? 1) < 2) {
    const base = emptyState();
    const conv = fromBackup(st, base);
    conv.settings = S.settings;
    st = conv;
  }
  return replaceState({ ...st, settings: S.settings, version: 2 });
}

/** Counts in a snapshot, for the list of restore points. */
export function snapshotSummary(st) {
  const done = (st.workouts || []).filter((w) => w.endedAt).length;
  const weights = (st.bodyWeights || []).length;
  const days = st.nutrition ? Object.keys(st.nutrition.logs || {}).length : 0;
  return { workouts: done, weights, days };
}
