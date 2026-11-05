// App state, saved automatically after every change, with one restore point per day.
import { loadState, saveState, saveSnapshot } from "./db.js";
import { DEFAULT_EXERCISES } from "./data.js";

const listeners = new Set();
let state;
let saveTimer;
let lastSavedAt = null;
let saveError = null;

export const dayKey = (date = new Date()) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function emptyState() {
  return {
    version: 1,
    exercises: DEFAULT_EXERCISES.map(([name, muscleGroup]) => ({ name, muscleGroup, notes: "" })),
    workouts: [],
    templates: [],
    bodyWeights: [],
    measurements: [],
    checkIns: [],
    nutrition: null,
    // Web app only, not in the backup file
    active: null,
    settings: { restSeconds: 90, barWeight: 20, weeklyReminder: true },
    meta: { lastExportAt: null, createdAt: new Date().toISOString() },
  };
}

/** Fills fields missing in older saves or imported files. */
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

export async function initStore() {
  try {
    const saved = await loadState();
    state = normalize(saved || emptyState());
  } catch (e) {
    saveError = e;
    state = emptyState();
  }
  return state;
}

export const getState = () => state;
export const saveStatus = () => ({ lastSavedAt, saveError });

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Changes the state, refreshes the screen and saves a moment later.
 *  `silent` skips the refresh, for typing in a field that must keep its focus. */
export function update(fn, { silent = false } = {}) {
  fn(state);
  if (!silent) listeners.forEach((l) => l(state));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 300);
}

/** Replaces everything, for an import or a restore. The data being replaced is kept
 *  first as its own restore point ("2026-11-05 14:03"), so the change can be undone. */
export async function replaceState(next) {
  const now = new Date();
  const time = now.toTimeString().slice(0, 5);
  try {
    await saveSnapshot(JSON.parse(JSON.stringify(state)), `${dayKey(now)} ${time}`);
  } catch {}
  state = normalize(next);
  listeners.forEach((l) => l(state));
  return flush();
}

export async function flush() {
  clearTimeout(saveTimer);
  try {
    const copy = JSON.parse(JSON.stringify(state));
    await saveState(copy);
    await saveSnapshot(copy, dayKey());
    lastSavedAt = new Date();
    saveError = null;
  } catch (e) {
    saveError = e;
  }
  listeners.forEach((l) => l(state));
}

// Save right away when the app goes to the background or closes
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flush();
});
window.addEventListener("pagehide", () => flush());
