// Reads the workouts CSV exported by Hevy (HevyImport.swift).
import { S, newId } from "./store.js";
import { LIB, libEntryForName, libMuscleGroup, exById, fold, invalidateHistory } from "./model.js";
import { rnd } from "./ui.js";

export class HevyError extends Error {}

export function csvRows(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQ = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
    } else if (ch !== "﻿") field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const number = (t) => {
  const s = t.replace(",", ".").trim();
  if (s === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};

const MONTHS = {
  janv: 1, janvier: 1, jan: 1, january: 1, févr: 2, fevr: 2, février: 2, fev: 2, feb: 2, february: 2, mars: 3, mar: 3, march: 3,
  avr: 4, avril: 4, apr: 4, april: 4, mai: 5, may: 5, juin: 6, jun: 6, june: 6, juil: 7, juillet: 7, jul: 7, july: 7,
  août: 8, aout: 8, aug: 8, august: 8, sept: 9, septembre: 9, sep: 9, september: 9, oct: 10, octobre: 10, october: 10,
  nov: 11, novembre: 11, november: 11, déc: 12, dec: 12, décembre: 12, december: 12,
};

export function hevyDate(text) {
  if (!text) return null;
  const parts = text.replace(/,/g, " ").replace(/\./g, " ").split(" ").filter(Boolean).map((x) => x.toLowerCase());
  if (parts.length >= 3 && /^\d+$/.test(parts[0]) && MONTHS[parts[1]] && /^\d+$/.test(parts[2])) {
    let hh = 0, mm = 0;
    if (parts.length >= 4) {
      const t = parts[3].split(":").map(Number);
      hh = t[0] || 0;
      mm = t[1] || 0;
    }
    return new Date(+parts[2], MONTHS[parts[1]] - 1, +parts[0], hh, mm).getTime();
  }
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (m) {
    if (m[7]) return new Date(text.replace(" ", "T")).getTime();
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).getTime();
  }
  m = text.match(/^([A-Za-z]{3,9}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2})(?: ?([AaPp][Mm]))?$/);
  if (m && MONTHS[m[1].toLowerCase()]) {
    let hh = +m[4];
    if (m[6]) hh = (hh % 12) + (/p/i.test(m[6]) ? 12 : 0);
    return new Date(+m[3], MONTHS[m[1].toLowerCase()] - 1, +m[2], hh, +m[5]).getTime();
  }
  m = text.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
  return null;
}

export function parseHevy(text) {
  const rows = csvRows(text);
  const header = rows[0]?.map((x) => x.trim().toLowerCase());
  if (!header) throw new HevyError("Aucune série de musculation trouvée dans ce fichier.");
  const col = (...names) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? null;
  const titleC = col("title"), startC = col("start_time"), exC = col("exercise_title"), repsC = col("reps");
  if (titleC == null || startC == null || exC == null || repsC == null) throw new HevyError("Ce fichier ne ressemble pas à un export de séances Hevy (colonnes title, start_time, exercise_title… introuvables).");
  const endC = col("end_time"), notesC = col("description"), typeC = col("set_type"), kgC = col("weight_kg"), lbsC = col("weight_lbs"), rpeC = col("rpe");
  const workouts = [];
  const index = new Map();
  for (const row of rows.slice(1)) {
    const v = (i) => (i == null || i >= row.length ? "" : row[i].trim());
    if (v(typeC).toLowerCase() === "warmup") continue;
    const reps = number(v(repsC));
    const start = hevyDate(v(startC));
    if (reps == null || reps < 1 || start == null) continue;
    let weight = 0;
    const kg = number(v(kgC)), lbs = number(v(lbsC));
    if (kg != null) weight = kg;
    else if (lbs != null) weight = rnd(lbs * 0.45359237 * 4) / 4;
    const r = number(v(rpeC));
    const rpe = r != null && r >= 6 && r <= 10 ? r : null;
    const title = v(titleC);
    const key = `${title}|${v(startC)}`;
    let wi = index.get(key);
    if (wi == null) {
      workouts.push({ title: title || "Séance Hevy", start, end: hevyDate(v(endC)), notes: v(notesC), exercises: [] });
      wi = workouts.length - 1;
      index.set(key, wi);
    }
    const exTitle = v(exC);
    if (!exTitle) continue;
    const list = workouts[wi].exercises;
    if (list.length && list[list.length - 1].title === exTitle) list[list.length - 1].sets.push({ weight, reps: Math.trunc(reps), rpe });
    else list.push({ title: exTitle, sets: [{ weight, reps: Math.trunc(reps), rpe }] });
  }
  const out = workouts.filter((w) => w.exercises.length);
  if (!out.length) throw new HevyError("Aucune série de musculation trouvée dans ce fichier.");
  return out.sort((a, b) => a.start - b.start);
}

export function parseHevyWeights(text) {
  const rows = csvRows(text);
  const header = rows[0]?.map((x) => x.trim().toLowerCase());
  if (!header || header.includes("exercise_title")) return null;
  const dateC = header.indexOf("date");
  if (dateC < 0) return null;
  const kgC = header.indexOf("weight_kg"), lbsC = header.indexOf("weight_lbs");
  if (kgC < 0 && lbsC < 0) return null;
  return rows.slice(1).map((row) => {
    const v = (i) => (i < 0 || i >= row.length ? "" : row[i].trim());
    const date = hevyDate(v(dateC));
    if (date == null) return null;
    const kg = number(v(kgC));
    if (kg != null && kg > 0) return { date, weight: kg };
    const lbs = number(v(lbsC));
    if (lbs != null && lbs > 0) return { date, weight: rnd(lbs * 0.45359237 * 10) / 10 };
    return null;
  }).filter(Boolean);
}

export function importHevyWeights(entries) {
  const days = new Set(S.bodyWeights.map((b) => new Date(b.date).toDateString()));
  let added = 0;
  for (const e of entries) {
    const k = new Date(e.date).toDateString();
    if (days.has(k)) continue;
    days.add(k);
    S.bodyWeights.push({ id: newId(), date: e.date, weight: e.weight });
    added++;
  }
  return added;
}

const KNOWN = {
  "bench press (barbell)": "Développé couché", "incline bench press (dumbbell)": "Développé incliné haltères", "chest dip": "Dips", "pull up": "Tractions",
  "bent over row (barbell)": "Rowing barre", "lat pulldown (cable)": "Tirage vertical", "dumbbell row": "Rowing haltère", "deadlift (barbell)": "Soulevé de terre",
  "overhead press (barbell)": "Développé militaire", "lateral raise (dumbbell)": "Élévations latérales", "face pull": "Face pull", "bicep curl (barbell)": "Curl barre",
  "hammer curl (dumbbell)": "Curl marteau", "triceps pushdown": "Extension triceps poulie", "skullcrusher (barbell)": "Barre au front", "squat (barbell)": "Squat",
  "leg press (machine)": "Presse à cuisses", "lunge (dumbbell)": "Fentes", "lying leg curl (machine)": "Leg curl allongé", "leg extension (machine)": "Leg extension",
  "standing calf raise (machine)": "Mollets debout", "romanian deadlift (barbell)": "Soulevé de terre roumain", "hip thrust (barbell)": "Hip thrust", plank: "Gainage", crunch: "Crunch",
  "chest supported incline row (dumbbell)": "Rowing poitrine appuyée", "lat pulldown - close grip (cable)": "Tirage vertical prise neutre", "ez bar biceps curl": "Curl barre EZ",
  "overhead triceps extension (cable)": "Extension triceps au-dessus de la tête", "seated leg curl (machine)": "Leg curl assis", "cable crunch": "Crunch poulie",
  "incline bench press (smith machine)": "Développé incliné machine", "shoulder press (dumbbell)": "Développé épaules", "seated overhead press (dumbbell)": "Développé épaules",
  "chest fly (machine)": "Pec deck", "butterfly (pec deck)": "Pec deck", "triceps rope pushdown": "Pushdown triceps", "seated cable row - v grip (cable)": "Rowing assis poulie",
  "straight arm lat pulldown (cable)": "Pull-over poulie", "rear delt reverse fly (machine)": "Oiseau (reverse pec deck)", "seated incline curl (dumbbell)": "Curl incliné haltères",
  "bulgarian split squat": "Fentes bulgares", "seated calf raise": "Mollets assis", "hip adduction (machine)": "Adducteurs machine",
  "curl incliné assis (haltère)": "Curl incliné haltères", "extension triceps poulie haute": "Extension triceps poulie", "extension triceps (poulie)": "Extension triceps poulie",
  "élévation latérale (haltère)": "Élévations latérales", "chest press (machine)": "Développé pectoraux machine", "développé couché incliné (machine smith)": "Développé incliné machine",
  "tirage vers visage": "Face pull", "extension des triceps au-dessus de la tête (câble)": "Extension triceps au-dessus de la tête", "curl biceps (poulie)": "Curl biceps poulie debout",
  "curl biceps (haltère)": "Curl haltères", "curl marteau (haltère)": "Curl marteau", "rowing assis (machine)": "Rowing iso machine", "tirage poitrine (machine)": "Tirage vertical",
  "tirage poitrine (poulie)": "Tirage vertical", "vertical traction (machine)": "Tirage vertical", "tirage poitrine - prise serrée (poulie)": "Tirage vertical prise serrée",
  "tirage poitrine bras tendus (poulie)": "Pull-over poulie", "curl derrière le dos (poulie)": "Curl derrière le dos (poulie)", "curl derrière le dos (câble)": "Curl derrière le dos (poulie)",
  "élévation frontale (haltère)": "Élévation frontale haltères", "développé couché décliné (machine)": "Développé décliné machine", "élévation latérale un bras (poulie)": "Élévation deltoïde poulie basse",
  "élévation latérale à un bras (câble)": "Élévation deltoïde poulie basse", "extension jambes": "Leg extension", "leg curl assis": "Leg curl assis", "leg curl assis (machine)": "Leg curl assis",
  "curl pupitre (machine)": "Curl pupitre machine", "curl pupitre (haltère)": "Curl pupitre haltères", "presse à cuisses": "Presse à cuisses", "presse à cuisses horizontal": "Presse à cuisses",
  "rowing barre t": "Rowing T-bar", "oiseau (machine)": "Oiseau (reverse pec deck)", "oiseau penché (haltère)": "Oiseau", "rowing poulie assis - prise en v": "Rowing assis poulie",
  "tirage assis à la poulie - prise en v (poulie)": "Rowing assis poulie", "développé couché incliné (haltère)": "Développé incliné haltères", "développé couché (haltère)": "Développé couché haltères",
  "développé couché (barre)": "Développé couché", "écartés poulie": "Écarté à la poulie", "écarté (machine)": "Pec deck", "split squat bulgare (haltère)": "Fentes bulgares",
  "squat (barre)": "Squat", "soulevé de terre (barre)": "Soulevé de terre", traction: "Tractions",
};

const IGNORED = new Set(["with", "the", "a", "on", "to", "of", "medium", "grip", "version", "attachment"]);
function tokens(text) {
  const cleaned = text.toLowerCase().replace(/e-z/g, "ez").replace(/pull-up|pull up/g, "pullup").replace(/chin-up|chin up/g, "chinup").replace(/push-up|push up/g, "pushup").split(/[^\p{L}\p{N}]+/u);
  return new Set(cleaned.filter((w) => w && !IGNORED.has(w)).map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)));
}
let libTokens = null;
function libraryTokens() {
  if (libTokens) return libTokens;
  const extra = { barbell: ["barbell"], dumbbell: ["dumbbell"], cable: ["cable"], machine: ["machine"], "e-z curl bar": ["ez", "bar"], kettlebells: ["kettlebell"], bands: ["band"] };
  libTokens = LIB.all.map((e) => {
    const w = tokens(e.name);
    for (const x of extra[e.equipment] || []) w.add(x);
    return [e, w];
  });
  return libTokens;
}
function bestLibraryMatch(title) {
  const words = tokens(title);
  if (!words.size) return null;
  let best = null, bestScore = 0;
  for (const [e, ew] of libraryTokens()) {
    let shared = 0;
    for (const w of words) if (ew.has(w)) shared++;
    const union = new Set([...words, ...ew]).size;
    const score = shared / union;
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

export function guessMuscleGroup(title) {
  const n = title.toLowerCase();
  const has = (...w) => w.some((x) => n.includes(x));
  if (has("développé", "écarté", "pompe")) return "chest";
  if (has("rowing", "tirage", "traction")) return "back";
  if (has("élévation", "épaule", "oiseau")) return "shoulders";
  if (has("jambe", "fente", "presse", "mollet")) return "legs";
  if (has("leg curl", "leg extension", "squat", "lunge", "leg press", "calf", "step up")) return "legs";
  if (has("hip thrust", "glute", "kickback", "abduct")) return "glutes";
  if (has("tricep", "skull", "pushdown", "dip")) return "triceps";
  if (has("curl")) return "biceps";
  if (has("bench", "chest", "fly", "push up", "pec")) return "chest";
  if (has("shoulder", "lateral", "overhead press", "military", "face pull", "rear delt", "shrug")) return "shoulders";
  if (has("row", "pull", "lat ", "deadlift", "chin")) return "back";
  if (has("crunch", "plank", "ab ", "sit up", "leg raise")) return "abs";
  return "fullBody";
}

/** Target: { kind: "existing", id, name } | { kind: "library", id } | { kind: "new", name } */
export function suggestedTarget(title) {
  const find = (name) => S.exercises.find((e) => fold(e.name) === fold(name));
  let ex = find(title);
  if (ex) return { kind: "existing", id: ex.id, name: ex.name };
  const known = KNOWN[title.toLowerCase()];
  if (known) {
    ex = find(known);
    if (ex) return { kind: "existing", id: ex.id, name: ex.name };
    const entry = libEntryForName(known);
    if (entry) return { kind: "library", id: entry.id };
    return { kind: "new", name: known };
  }
  const entry = bestLibraryMatch(title);
  if (entry) {
    const mine = S.exercises.find((e) => e.libraryId === entry.id || libEntryForName(e.name)?.id === entry.id);
    if (mine) return { kind: "existing", id: mine.id, name: mine.name };
    return { kind: "library", id: entry.id };
  }
  return { kind: "new", name: title };
}
export function targetLabel(t) {
  if (t.kind === "existing") return t.name;
  if (t.kind === "library") return LIB.byId.get(t.id)?.nameFR ?? t.id;
  return t.name;
}
const targetKey = (t) => `${t.kind}:${t.id ?? t.name}`;

export function importHevyWorkouts(workouts, targets) {
  const starts = S.workouts.map((w) => w.startedAt);
  const resolved = new Map();
  const exerciseFor = (t, title) => {
    const k = targetKey(t);
    if (resolved.has(k)) return resolved.get(k);
    let ex = null;
    if (t.kind === "existing") ex = exById(t.id);
    else if (t.kind === "library") {
      const e = LIB.byId.get(t.id);
      if (e) {
        ex = { id: newId(), name: e.nameFR, muscleGroup: libMuscleGroup(e), notes: "", createdAt: Date.now(), weightStep: null, libraryId: e.id };
        S.exercises.push(ex);
      }
    } else {
      ex = { id: newId(), name: t.name, muscleGroup: guessMuscleGroup(title), notes: "", createdAt: Date.now(), weightStep: null, libraryId: null };
      S.exercises.push(ex);
    }
    resolved.set(k, ex);
    return ex;
  };
  let added = 0;
  for (const p of workouts) {
    if (starts.some((s) => Math.abs(s - p.start) < 60_000)) continue;
    const w = { id: newId(), title: p.title, startedAt: p.start, endedAt: p.end ?? p.start + 3_600_000, notes: p.notes, exercises: [] };
    for (const pe of p.exercises) {
      const ex = exerciseFor(targets[pe.title] ?? { kind: "new", name: pe.title }, pe.title);
      if (!ex) continue;
      w.exercises.push({
        id: newId(), exerciseId: ex.id, targetReps: null, minReps: null, restSeconds: null, note: null, progressionIncrement: null, supersetGroup: null,
        sets: pe.sets.map((s) => ({ id: newId(), reps: s.reps, weight: s.weight, isCompleted: true, rpe: s.rpe, targetWeight: null, targetReps: null, kind: null })),
      });
    }
    S.workouts.push(w);
    added++;
  }
  invalidateHistory();
  return added;
}
