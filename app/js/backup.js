// Backup file, in the same format as the iPhone app (Réglages > Sauvegarde),
// so a file made on one can be restored on the other.
import { getState, replaceState, update } from "./store.js";

const WEEK = 7 * 86_400_000;

/** ISO 8601 without milliseconds, as the iPhone app reads it. */
export function iso(date = new Date()) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, "Z");
}

const fixDate = (d) => (d ? iso(d) : d);

export function makeBackup() {
  const s = getState();
  const backup = {
    version: 1,
    exportedAt: iso(),
    exercises: s.exercises,
    workouts: s.workouts
      .filter((w) => w.endedAt)
      .map((w) => ({ ...w, startedAt: fixDate(w.startedAt), endedAt: fixDate(w.endedAt) })),
    templates: s.templates,
    bodyWeights: s.bodyWeights.map((b) => ({ ...b, date: fixDate(b.date) })),
    measurements: s.measurements.map((m) => ({ ...m, date: fixDate(m.date) })),
    checkIns: s.checkIns,
  };
  if (s.nutrition) backup.nutrition = s.nutrition;
  // Portion's own data on this site, kept with the rest (ignored by the iPhone app)
  const portion = portionLocalStorage();
  if (Object.keys(portion).length) backup.portionLocalStorage = portion;
  return backup;
}

function portionLocalStorage() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k !== "_alive") out[k] = localStorage.getItem(k);
    }
  } catch {}
  return out;
}

export function backupFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `Musculation-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** Opens the share sheet (Enregistrer dans Fichiers, iCloud Drive…) or downloads the file. */
export async function exportBackup() {
  const json = JSON.stringify(makeBackup(), null, 2);
  const name = backupFileName();
  const file = new File([json], name, { type: "application/json" });
  let done = false;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      done = true;
    } catch (e) {
      if (e?.name === "AbortError") return false;
    }
  }
  if (!done) {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  update((s) => (s.meta.lastExportAt = iso()));
  return true;
}

/** Reads a backup file and returns what it holds, without applying it. */
export async function readBackup(file) {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data.exercises) || !Array.isArray(data.workouts)) {
    throw new Error("Ce fichier n'est pas une sauvegarde Musculation.");
  }
  return data;
}

/** Replaces the data with the backup, keeping the settings of this device. */
export function applyBackup(data) {
  const s = getState();
  if (data.portionLocalStorage) {
    try {
      for (const [k, v] of Object.entries(data.portionLocalStorage)) localStorage.setItem(k, v);
    } catch {}
  }
  return replaceState({
    ...s,
    exercises: data.exercises,
    workouts: data.workouts,
    templates: data.templates || [],
    bodyWeights: data.bodyWeights || [],
    measurements: data.measurements || [],
    checkIns: data.checkIns || [],
    nutrition: data.nutrition ?? s.nutrition,
    active: null,
  });
}

/** True when the weekly backup reminder should show. */
export function backupIsDue() {
  const s = getState();
  if (!s.settings.weeklyReminder) return false;
  const hasData = s.workouts.length || s.bodyWeights.length || s.templates.length;
  if (!hasData) return false;
  const since = s.meta.lastExportAt || s.meta.createdAt;
  return Date.now() - new Date(since).getTime() > WEEK;
}
