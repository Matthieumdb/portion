// Coach, recovery and weekly recap: rule-based analysis run on the device
// (Coach.swift, Recovery.swift, WeeklyRecap.swift).
import { S, dayKey } from "./store.js";
import {
  DAY, startOfDay, startOfWeek, addWeeks, addDays, dateFromKey, exById, muscle, MUSCLE_IDS, entryBest1RM, entryMaxWeight,
  workoutSetCount, workoutVolume, workoutDuration, repRange, progressionIncrement, estimateRPE, hasFeelings,
} from "./model.js";
import { num, rnd } from "./ui.js";

const kgT = (v) => `${num(v, 1)} kg`;
const kgP = (v) => `${num(v, 2)} kg`;
const elapsedDays = (from, to) => Math.floor((to - from) / DAY);

// MARK: Coach

export const KIND_COLORS = { action: "var(--orange)", warning: "var(--red)", win: "var(--green)", info: "var(--blue)" };
const KIND_ORDER = { action: 0, warning: 1, win: 2, info: 3 };

export function analyze(workouts = S.workouts, now = Date.now()) {
  const finished = workouts.filter((w) => w.endedAt != null && workoutSetCount(w) > 0).sort((a, b) => b.startedAt - a.startedAt);
  const last = finished[0];
  if (!last) return { headline: "Fais ta première séance : je l'analyserai pour te conseiller la suivante.", insights: [] };
  let insights = [
    ...frequency(finished, last, now),
    ...exerciseTrends(finished, now),
    ...weeklyVolume(finished, now),
    ...balance(finished, now),
    ...fatigue(finished, now),
  ];
  insights = insights.map((x, i) => ({ ...x, i })).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.i - b.i);
  return { headline: headline(insights, last, now), insights };
}

function headline(insights, last, now) {
  const wins = insights.filter((i) => i.kind === "win").length;
  const todo = insights.filter((i) => i.kind === "action" || i.kind === "warning").length;
  const days = elapsedDays(last.startedAt, now);
  const when = days === 0 ? "aujourd'hui" : days === 1 ? "hier" : `il y a ${days} jours`;
  const parts = [`Dernière séance ${when}.`];
  if (wins > 0) parts.push(`${wins} point${wins > 1 ? "s" : ""} fort${wins > 1 ? "s" : ""}.`);
  if (todo > 0) parts.push(`${todo} conseil${todo > 1 ? "s" : ""} pour la suite.`);
  return parts.join(" ");
}

function frequency(workouts, last, now) {
  const days = elapsedDays(last.startedAt, now);
  const lastFour = workouts.filter((w) => now - w.startedAt < 28 * DAY).length;
  const perWeek = lastFour / 4;
  const out = [];
  if (days >= 5) out.push({ kind: "warning", icon: "calendar", title: `${days} jours sans séance`, message: "Reprends avec une séance un peu plus légère (une série de moins par exercice), puis retrouve ton rythme." });
  if (lastFour >= 4)
    out.push({
      kind: perWeek >= 3 ? "win" : "info", icon: "flame", title: `${num(perWeek, 1)} séances par semaine`,
      message: perWeek >= 3 ? "Belle régularité sur les 4 dernières semaines. C'est le premier moteur de progrès." : "Sur les 4 dernières semaines. Viser 3 séances ou plus par semaine permet de travailler chaque muscle deux fois.",
    });
  return out;
}

function nextIncrement(entry, ex) {
  const range = repRange(entry.minReps, entry.targetReps, entry.sets);
  const top = entry.sets.reduce((a, s) => (!a || s.weight > a.weight ? s : a), null);
  if (!top || !(top.weight > 0) || top.reps < range[1]) return null;
  const inc = progressionIncrement(ex, top.weight);
  return inc > 0 ? inc : null;
}

function exerciseTrends(workouts, now) {
  const recent = workouts.filter((w) => now - w.startedAt < 70 * DAY);
  const byEx = new Map();
  for (const w of recent)
    for (const e of w.exercises) {
      const ex = exById(e.exerciseId);
      if (!ex || !e.sets.length) continue;
      if (!byEx.has(ex.id)) byEx.set(ex.id, { ex, sessions: [] });
      byEx.get(ex.id).sessions.push({ date: w.startedAt, best: entryBest1RM(e), top: entryMaxWeight(e), entry: e });
    }
  const lastDate = workouts[0]?.startedAt;
  if (lastDate == null) return [];
  const records = [], progress = [], stalls = [], drops = [];
  for (const { ex, sessions } of byEx.values()) {
    const ordered = [...sessions].sort((a, b) => b.date - a.date);
    const latest = ordered[0];
    if (!latest || !(latest.best > 0)) continue;
    const prev = ordered.slice(1);
    const prevBest = prev.length ? Math.max(...prev.map((p) => p.best)) : 0;
    const isLast = startOfDay(latest.date) === startOfDay(lastDate);
    if (isLast && prevBest > 0 && latest.best > prevBest * 1.005) {
      records.push({ kind: "win", icon: "trophy", title: `Record sur ${ex.name}`, message: `1RM estimé ${kgT(latest.best)} contre ${kgT(prevBest)} avant. Continue sur cette lancée.`, exercise: ex });
      continue;
    }
    const inc = isLast ? nextIncrement(latest.entry, ex) : null;
    if (isLast && inc != null) {
      progress.push({ kind: "action", icon: "arrowUpCircle", title: `Monte la charge sur ${ex.name}`, message: `Tu as atteint le haut de ta fourchette de reps. Ton objectif de la prochaine fois : ${kgT(latest.top + inc)} (+${kgP(inc)}), déjà prérempli dans la séance.`, exercise: ex });
      continue;
    }
    if (isLast) {
      const rpes = latest.entry.sets.map((s) => s.rpe ?? estimateRPE(s.weight, s.reps, prevBest > 0 ? prevBest : null)).filter((x) => x != null);
      const logged = latest.entry.sets.some((s) => s.rpe != null);
      if (rpes.length >= 2) {
        const avg = rpes.reduce((a, b) => a + b, 0) / rpes.length;
        const source = logged ? "noté" : "calculé";
        if (avg <= 7 && latest.top > 0) {
          const i2 = progressionIncrement(ex, latest.top);
          progress.push({ kind: "action", icon: "gauge", title: `${ex.name} était facile`, message: `RPE moyen ${source} ${num(avg, 1)} : il te restait 3 reps ou plus en réserve. Passe à ${kgT(latest.top + i2)} la prochaine fois.`, exercise: ex });
          continue;
        }
        if (avg >= 9.5) {
          drops.push({ kind: "warning", icon: "gauge", title: `${ex.name} à la limite`, message: `RPE moyen ${source} ${num(avg, 1)} : presque toutes tes séries étaient à l'échec. Garde la même charge et vise 1 à 2 reps en réserve pour mieux récupérer.`, exercise: ex });
          continue;
        }
      }
    }
    if (ordered.length >= 4) {
      const lastThree = ordered.slice(0, 3).map((x) => x.best);
      const before = Math.max(0, ...ordered.slice(3).map((x) => x.best));
      if (before > 0 && Math.max(...lastThree) <= before * 1.005) {
        stalls.push({ kind: "action", icon: "pause", title: `${ex.name} stagne`, message: "Pas de progrès sur tes 3 dernières séances. Essaie d'ajouter une répétition par série avant de monter la charge, change de fourchette (par exemple 6–8 au lieu de 10–12) ou remplace-le par une variante.", exercise: ex });
        continue;
      }
    }
    if (isLast && prevBest > 0 && latest.best < prevBest * 0.92)
      drops.push({ kind: "warning", icon: "arrowDownCircle", title: `Baisse sur ${ex.name}`, message: `1RM estimé ${kgT(latest.best)}, 8 % sous ton meilleur récent (${kgT(prevBest)}). Sommeil, alimentation ou fatigue : garde la même charge la prochaine fois.`, exercise: ex });
  }
  return [...records.slice(0, 3), ...progress.slice(0, 4), ...stalls.slice(0, 3), ...drops.slice(0, 3)];
}

export function setsPerGroup(workouts, days, now = Date.now()) {
  const counts = {};
  for (const w of workouts) {
    if (!(now - w.startedAt < days * DAY)) continue;
    for (const e of w.exercises) {
      const g = exById(e.exerciseId)?.muscleGroup;
      if (!g) continue;
      counts[g] = (counts[g] || 0) + e.sets.length;
    }
  }
  return counts;
}

function weeklyVolume(workouts, now) {
  const two = setsPerGroup(workouts, 14, now);
  const trained = new Set(Object.keys(setsPerGroup(workouts, 42, now)));
  const main = ["chest", "back", "shoulders", "biceps", "triceps", "legs"];
  const low = [], high = [];
  for (const g of main) {
    if (!trained.has(g)) continue;
    const weekly = Math.trunc((two[g] || 0) / 2);
    if (weekly < 10) low.push(`${muscle(g).label} ${weekly}`);
    else if (weekly > 24) high.push(`${muscle(g).label} ${weekly}`);
  }
  const out = [];
  if (low.length) out.push({ kind: "action", icon: "chartBar", title: "Volume un peu juste", message: `Séries par semaine : ${low.join(", ")}. Pour la prise de muscle, vise 10 à 20 séries par muscle et par semaine : ajoute une série ou un exercice pour ces muscles.` });
  if (high.length) out.push({ kind: "warning", icon: "chartBar", title: "Beaucoup de volume", message: `Séries par semaine : ${high.join(", ")}. Au-delà de 20 à 25, la récupération devient difficile : privilégie la qualité des séries.` });
  if (!low.length && !high.length && main.some((g) => trained.has(g))) out.push({ kind: "win", icon: "seal", title: "Volume bien dosé", message: "Chaque muscle principal reçoit entre 10 et 24 séries par semaine." });
  return out;
}

function balance(workouts, now) {
  const c = setsPerGroup(workouts, 14, now);
  const push = (c.chest || 0) + (c.shoulders || 0);
  const pull = c.back || 0;
  if (push + pull < 12) return [];
  if (push > pull * 1.5) return [{ kind: "action", icon: "balance", title: "Plus de poussée que de tirage", message: `${push} séries pecs et épaules contre ${pull} pour le dos sur 2 semaines. Ajoute du rowing ou du tirage pour protéger tes épaules et ta posture.` }];
  if (pull > push * 1.8) return [{ kind: "info", icon: "balance", title: "Beaucoup de tirage", message: `${pull} séries de dos contre ${push} pour pecs et épaules sur 2 semaines.` }];
  return [];
}

/** Consecutive weeks with at least 3 workouts, before the current week. */
export function weekStreak3(workouts, now = Date.now()) {
  let streak = 0;
  let week = startOfWeek(now);
  for (;;) {
    const prev = addWeeks(week, -1);
    const count = workouts.filter((w) => w.startedAt >= prev && w.startedAt < week).length;
    if (count < 3) break;
    streak++;
    week = prev;
  }
  return streak;
}

function fatigue(workouts, now) {
  const streak = weekStreak3(workouts, now);
  if (streak < 7) return [];
  return [{ kind: "warning", icon: "batteryLow", title: `${streak} semaines intenses d'affilée`, message: "Prévois une semaine de décharge : mêmes exercices, moitié moins de séries, sans aller à l'échec. Tu reviendras plus fort." }];
}

// MARK: Recovery

export const TRACKED = MUSCLE_IDS.filter((g) => g !== "cardio" && g !== "fullBody");

export function freshness(workouts = S.workouts, now = Date.now()) {
  const fatigue = {};
  for (const w of workouts) {
    if (w.endedAt == null || w.startedAt > now) continue;
    const hours = (now - w.startedAt) / 3_600_000;
    if (hours >= 72) continue;
    const weight = 1 - hours / 72;
    for (const e of w.exercises) {
      const g = exById(e.exerciseId)?.muscleGroup;
      if (!g) continue;
      const sets = e.sets.filter((s) => s.isCompleted && s.kind !== "warmup").length;
      if (g === "fullBody") for (const t of TRACKED) fatigue[t] = (fatigue[t] || 0) + sets * weight * 0.3;
      else if (g !== "cardio") fatigue[g] = (fatigue[g] || 0) + sets * weight;
    }
  }
  return TRACKED.map((g) => ({ group: g, freshness: Math.max(0, 1 - (fatigue[g] || 0) / 12) }));
}

export function recoveryScore(c, muscles) {
  let value = 75;
  const factors = [];
  const tired = muscles.filter((m) => m.freshness < 0.6);
  const avg = muscles.length ? muscles.reduce((a, m) => a + m.freshness, 0) / muscles.length : 1;
  value += (avg - 0.85) * 40;
  if (tired.length) factors.push(`${tired.length} muscle${tired.length > 1 ? "s" : ""} encore fatigué${tired.length > 1 ? "s" : ""}`);
  const done = (complete) => ({ value: rnd(Math.min(100, Math.max(1, value))), isComplete: complete, factors });
  if (!c || !hasFeelings(c)) return done(false);
  if (c.sleepHours != null) {
    value += Math.min(8, Math.max(-20, (c.sleepHours - 7.5) * 6));
    if (c.sleepHours < 6.5) factors.push("nuit courte");
    else if (c.sleepHours >= 7.5) factors.push("bonne nuit");
  }
  if (c.sleepQuality != null) value += (c.sleepQuality - 3) * 5;
  if (c.energy != null) {
    value += (c.energy - 3) * 5;
    if (c.energy <= 2) factors.push("peu d'énergie");
  }
  if (c.soreness != null) {
    value -= (c.soreness - 1) * 5;
    if (c.soreness >= 4) factors.push("courbatures");
  }
  if (c.stress != null) {
    value -= (c.stress - 1) * 4;
    if (c.stress >= 4) factors.push("stress élevé");
  }
  if (c.alcohol > 0) {
    value -= Math.min(15, c.alcohol * 5);
    factors.push("alcool");
  }
  return done(true);
}
export const verdict = (v) => (v >= 75 ? "Prêt pour une grosse séance" : v >= 50 ? "Séance modérée conseillée" : "Plutôt repos ou mobilité");
export const scoreTint = (v) => (v >= 75 ? "var(--green)" : v >= 50 ? "var(--orange)" : "var(--red)");

export function daysBetweenKeys(a, b) {
  return Math.round((dateFromKey(b) - dateFromKey(a)) / DAY);
}

export function deloadReason(workouts = S.workouts, checkIns = S.checkIns, now = Date.now()) {
  const finished = workouts.filter((w) => w.endedAt != null);
  const streak = weekStreak3(finished, now);
  const today = dayKey(now);
  const recent = checkIns.filter((c) => hasFeelings(c) && daysBetweenKeys(c.day, today) < 7);
  const scores = recent.map((c) => recoveryScore(c, freshness(finished, dateFromKey(c.day) + 9 * 3_600_000)).value);
  const average = scores.length ? Math.trunc(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  if (average != null && scores.length >= 3 && average < 55 && streak >= 3) return `Récupération moyenne de ${average} sur 7 jours après ${streak} semaines chargées.`;
  if (streak >= 6) return `${streak} semaines d'affilée à 3 séances ou plus.`;
  return null;
}

// MARK: Weekly recap

export function recapWeek(date) {
  const start = startOfWeek(date);
  return { start, end: addWeeks(start, 1) };
}

/** logs: { day: [LogEntry] }, targets: { kcal, p }, weights: [{date, weight}] */
export function makeRecap(week, { workouts = S.workouts, logs = {}, targets = { kcal: 0, p: 0 }, weights = S.bodyWeights, checkIns = S.checkIns } = {}) {
  const inW = (t) => t >= week.start && t < week.end;
  const finished = workouts.filter((w) => w.endedAt != null);
  const inWeek = finished.filter((w) => inW(w.startedAt));
  const prevStart = week.start - (week.end - week.start);
  const inPrev = finished.filter((w) => w.startedAt >= prevStart && w.startedAt < week.start);
  const perGroup = {};
  let sets = 0;
  for (const w of inWeek)
    for (const e of w.exercises) {
      const done = e.sets.filter((s) => s.isCompleted && s.kind !== "warmup").length;
      sets += done;
      const g = exById(e.exerciseId)?.muscleGroup;
      if (g && g !== "cardio") perGroup[g] = (perGroup[g] || 0) + done;
    }
  const best = {}, before = {};
  for (const w of finished) {
    if (!(w.startedAt < week.end)) continue;
    for (const e of w.exercises) {
      const name = exById(e.exerciseId)?.name;
      if (!name) continue;
      const v = entryBest1RM(e);
      if (inW(w.startedAt)) best[name] = Math.max(best[name] || 0, v);
      else if (w.startedAt < week.start) before[name] = Math.max(before[name] || 0, v);
    }
  }
  const records = Object.entries(best)
    .filter(([n, v]) => before[n] > 0 && v > before[n])
    .map(([exercise, oneRepMax]) => ({ exercise, oneRepMax, previous: before[exercise] }))
    .sort((a, b) => b.oneRepMax / b.previous - a.oneRepMax / a.previous);
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(week.start, i)).filter((t) => t <= Date.now()).map((t) => dayKey(t));
  const eaten = days.map((d) => logs[d]).filter((l) => l && l.length).map((l) => l.reduce((a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + x.p }), { kcal: 0, p: 0 }));
  const toT = (d) => (typeof d === "number" ? d : new Date(d).getTime());
  const weekWeights = weights.filter((b) => inW(toT(b.date))).sort((a, b) => toT(a.date) - toT(b.date));
  const lastBefore = weights.filter((b) => toT(b.date) < week.start).sort((a, b) => toT(b.date) - toT(a.date))[0];
  const weekCI = checkIns.filter((c) => days.includes(c.day));
  const sleeps = weekCI.map((c) => c.sleepHours).filter((x) => x != null);
  const water = weekCI.map((c) => c.water).filter((x) => x > 0);
  const r = {
    week, workouts: inWeek.length, previousWorkouts: inPrev.length,
    duration: inWeek.reduce((a, w) => a + workoutDuration(w), 0),
    volume: inWeek.reduce((a, w) => a + workoutVolume(w), 0),
    previousVolume: inPrev.reduce((a, w) => a + workoutVolume(w), 0),
    sets, records,
    muscles: Object.entries(perGroup).map(([group, sets]) => ({ group, sets })).sort((a, b) => b.sets - a.sets),
    loggedDays: eaten.length,
    averageKcal: eaten.length ? eaten.reduce((a, x) => a + x.kcal, 0) / eaten.length : null,
    averageProtein: eaten.length ? eaten.reduce((a, x) => a + x.p, 0) / eaten.length : null,
    targetKcal: targets.kcal, targetProtein: targets.p,
    weightStart: lastBefore?.weight ?? weekWeights[0]?.weight ?? null,
    weightEnd: weekWeights.length ? weekWeights[weekWeights.length - 1].weight : null,
    averageSleep: sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null,
    averageWater: water.length ? water.reduce((a, b) => a + b, 0) / water.length : null,
  };
  r.isEmpty = r.workouts === 0 && r.loggedDays === 0 && r.weightEnd == null && r.averageSleep == null;
  r.headline = recapHeadline(r);
  return r;
}

function recapHeadline(r) {
  if (r.workouts === 0) return r.loggedDays > 0 ? "Pas de séance cette semaine, mais tu as suivi ton alimentation." : "Une semaine calme.";
  if (r.records.length) return `${r.records.length} record${r.records.length > 1 ? "s" : ""} battu${r.records.length > 1 ? "s" : ""} en ${r.workouts} séance${r.workouts > 1 ? "s" : ""}.`;
  if (r.previousVolume > 0 && r.volume > r.previousVolume * 1.05) return "Plus de volume que la semaine d'avant.";
  return `${r.workouts} séance${r.workouts > 1 ? "s" : ""} au compteur.`;
}
