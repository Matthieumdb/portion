// App state, saved automatically after every change, with one restore point per day.
// Version 2 mirrors the iPhone app's SwiftData models (with ids instead of relationships).
import { loadState, saveState, saveSnapshot } from "./db.js";

const listeners = new Set();
export let S;
let saveTimer;
let lastSavedAt = null;
let saveError = null;

export const dayKey = (date = new Date()) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

export const DEFAULT_SETTINGS = {
  restDuration: 90,
  progressionPercent: 2.5,
  barWeight: 20,
  appearance: "light",
  weeklyRecap: true,
  weeklyReminder: true,
  programStartDate: null,
  lightDay: null,
  deloadUntil: null,
  recapSeen: null,
};

export function emptyState() {
  return {
    version: 2,
    exercises: [],
    workouts: [],
    templates: [],
    bodyWeights: [],
    measurements: [],
    checkIns: [],
    nutrition: null,
    settings: { ...DEFAULT_SETTINGS },
    rest: null,
    meta: { lastExportAt: null, createdAt: new Date().toISOString(), seeded: false },
  };
}

function normalize(s) {
  const base = emptyState();
  const out = { ...base, ...s };
  out.settings = { ...base.settings, ...(s.settings || {}) };
  out.meta = { ...base.meta, ...(s.meta || {}) };
  for (const key of ["exercises", "workouts", "templates", "bodyWeights", "measurements", "checkIns"]) {
    if (!Array.isArray(out[key])) out[key] = [];
  }
  return out;
}

let migrateV1 = null;
/** Set by backup.js: converts a v1 (backup-shaped) state. */
export function setMigrator(fn) {
  migrateV1 = fn;
}

export async function initStore() {
  try {
    const saved = await loadState();
    if (saved && (saved.version ?? 1) < 2 && migrateV1) S = normalize(migrateV1(saved));
    else S = normalize(saved || emptyState());
  } catch (e) {
    console.error(e);
    saveError = e;
    S = emptyState();
  }
  return S;
}

export const saveStatus = () => ({ lastSavedAt, saveError });

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((l) => l(S));
}

/** Changes the state, refreshes the screen and saves a moment later. */
export function commit(fn) {
  fn?.(S);
  notify();
  schedule();
}

/** Changes the state without redrawing, for typing in a field that must keep its focus. */
export function silent(fn) {
  fn?.(S);
  schedule();
}

function schedule() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
}

/** Replaces everything, for an import or a restore. The data being replaced is kept
 *  first as its own restore point ("2026-11-05 14:03"), so the change can be undone. */
export async function replaceState(next) {
  const now = new Date();
  try {
    await saveSnapshot(JSON.parse(JSON.stringify(S)), `${dayKey(now)} ${now.toTimeString().slice(0, 5)}`);
  } catch {}
  S = normalize(next);
  notify();
  return flush();
}

export async function flush() {
  clearTimeout(saveTimer);
  try {
    const copy = JSON.parse(JSON.stringify(S));
    await saveState(copy);
    await saveSnapshot(copy, dayKey());
    lastSavedAt = new Date();
    saveError = null;
  } catch (e) {
    saveError = e;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flush();
});
window.addEventListener("pagehide", () => flush());
