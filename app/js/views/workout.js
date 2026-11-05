// Séance tab: start screen (recovery, recap, activity, coach, program, templates) and the active workout
// (WorkoutTabView.swift, ActiveWorkoutView.swift, TemplateEditView, ProgramDetailView, RecoveryViews, CoachView).
import {
  h, icon, card, cardTitle, section, cell, ring, menu, confirm, choose, toast, haptic, input, parseNumber, num, durationText, relative, capitalized, capFirst,
  weekdayDayMonth, dayMonth, stepper, segmented, textCell, swipe, longPress, emptyState, picker, s as svg,
} from "../ui.js";
import { S, commit, silent, dayKey } from "../store.js";
import {
  activeWorkout, finishedWorkouts, startFromTemplate, newWorkout, addExercise, exById, libEntry, mainMuscleGroup, workoutDuration, workoutVolume,
  templateMuscleGroups, templateSummary, programPhase, CYCLE_WEEKS, PROGRAMS, installProgram, uninstallProgram, isReduced, isLightToday, deloadEnd,
  startOfWeek, addWeeks, epley, set1RM, setVolume, previousBest1RM, historyOf, reachedTarget, estimateRPE, RPE_VALUES, rpeMeaning, SET_KINDS, kindOf, newSet,
  moveEntry, toggleSuperset, supersetLetter, restsAfter, addWarmUp, targetDescription, restText, replaceExercise as replaceEntryExercise, templatesUsing,
  replaceInTemplate, finishWorkout, discardWorkout, REST_OPTIONS, newTemplate, newTemplateItem, checkInFor, hasFeelings, muscle, invalidateHistory, entryBest1RM,
} from "../model.js";
import { analyze, KIND_COLORS, freshness, recoveryScore, verdict, scoreTint, deloadReason } from "../insights.js";
import { tick, present, refresh } from "../nav.js";
import { barBtn, okBtn, cancelBtn, muscleIcon, exerciseIcon, thumb, statItem, primaryButton, advice, kgText } from "./common.js";
import { exercisePicker, replaceExercise, plateCalculator, demoSheet } from "./exercises.js";

let lazy = {};
const later = (name) => (ctx) => lazy[name](ctx);
export function provide(screens) {
  Object.assign(lazy, screens);
}
const workoutDetail = later("workoutDetail");
const recapView = later("recapView");

export function workoutRoot(ctx) {
  const w = activeWorkout();
  return w ? activeScreen(ctx, w) : startScreen(ctx);
}

// MARK: Start screen

function greeting() {
  const hr = new Date().getHours();
  return hr >= 5 && hr < 12 ? "Bonjour" : hr >= 12 && hr < 18 ? "Bon après-midi" : "Bonsoir";
}

export const isRecapTime = () => {
  const d = new Date();
  return (d.getDay() === 0 && d.getHours() >= 14) || d.getDay() === 1;
};

function startScreen(ctx) {
  const finished = finishedWorkouts();
  const templates = [...S.templates].sort((a, b) => a.createdAt - b.createdAt);
  const programTemplates = templates.filter((t) => t.programName != null).sort((a, b) => (a.programOrder ?? 0) - (b.programOrder ?? 0));
  const custom = templates.filter((t) => t.programName == null);
  return {
    title: greeting(),
    large: true,
    subtitle: capitalized(weekdayDayMonth(Date.now())),
    body: [
      recoveryCard(ctx),
      isRecapTime() && finished.length ? recapCard(ctx) : null,
      activityCard(finished),
      finished.length ? coachCard(ctx, analyze(finished.slice(0, 120))) : null,
      programSection(ctx, programTemplates, finished),
      templatesSection(ctx, custom),
      finished[0] ? lastWorkoutCard(ctx, finished[0]) : null,
    ],
  };
}

function activityCard(finished) {
  const week = startOfWeek();
  const thisWeek = finished.filter((w) => w.startedAt >= week && w.startedAt < addWeeks(week, 1)).length;
  const trained = new Set(finished.map((w) => startOfWeek(w.startedAt)));
  let wk = week;
  if (!trained.has(wk)) wk = addWeeks(wk, -1);
  let streak = 0;
  while (trained.has(wk)) {
    streak++;
    wk = addWeeks(wk, -1);
  }
  return card(
    cardTitle("Activité", "flame", "var(--orange)"),
    h("div.stat-row", statItem(String(thisWeek), "cette semaine", "var(--orange)"), h("div.vdivider", { style: { height: "36px" } }), statItem(String(streak), streak > 1 ? "semaines d'affilée" : "semaine d'affilée", "var(--red)"), h("div.vdivider", { style: { height: "36px" } }), statItem(String(finished.length), "séances au total", "var(--yellow)"))
  );
}

function recapCard(ctx) {
  return h(
    "button.card.press",
    { type: "button", onclick: () => ctx.push(recapView, { weeksBack: new Date().getDay() === 1 ? 1 : 0 }) },
    h("div.hstack.gap12", h("span", { style: { color: "var(--indigo)" } }, icon("calendarCheck", 26)), h("div.grow.vstack.gap2", h("span.headline", "Ton bilan de la semaine est prêt"), h("span.footnote.secondary", "Séances, records, alimentation et poids")), h("span.chev", icon("chevron")))
  );
}

function programSection(ctx, sessions, finished) {
  let next = null;
  if (sessions.length) {
    for (const w of finished) {
      const i = sessions.findIndex((t) => t.name === w.title);
      if (i >= 0) {
        next = sessions[(i + 1) % sessions.length];
        break;
      }
    }
    next ??= sessions[0];
  }
  if (next) {
    const phase = programPhase(S.settings.programStartDate || 0);
    const deload = phase.isDeload || isReduced();
    const start = (t) => commit(() => startFromTemplate(t, deload));
    return h(
      "div.program-card",
      h("div.hstack.caption.bold", h("span.pill", `Semaine ${phase.week}/${CYCLE_WEEKS}`), h("span", phase.title), h("span.spacer"), h("button", { type: "button", style: { color: "#fff", fontWeight: 700 }, onclick: () => ctx.present(programDetail, { programName: sessions[0].programName }) }, "Détails")),
      h("p.subheadline.clamp2", { style: { opacity: 0.9 } }, phase.detail),
      h(
        "div.hstack",
        h("div.grow.vstack.gap2", h("span.caption", { style: { opacity: 0.85 } }, "Prochaine séance"), h("span.large-title", next.name), h("span.caption", { style: { opacity: 0.85 } }, `${next.items.length} exercices${phase.isDeload ? " · séries réduites" : ""}`)),
        h("button.play-big", { type: "button", "aria-label": `Démarrer ${next.name}`, onclick: () => start(next) }, icon("play"))
      ),
      h(
        "div.scroll-x",
        { style: { margin: "0 -18px", padding: "2px 18px" } },
        sessions.map((t) => longPress(h("button.session-chip.press" + (t === next ? ".next" : ""), { type: "button", onclick: () => start(t) }, t.name), () => menu([{ label: "Modifier les exercices", icon: "edit", onClick: () => ctx.present(templateEdit, { template: t, isNew: false }, { dismissable: true }) }], { title: t.name })))
      )
    );
  }
  return card(
    cardTitle("Programmes", "sparkles"),
    PROGRAMS.map((p) => [
      h("div.divider"),
      h(
        "div.vstack.gap10",
        h("div.hstack", h("span.accent", icon("sparkles", 18)), h("span.headline", p.name)),
        h("p.subheadline.secondary", p.summary),
        h("div.hstack.wrap.gap6", p.sessions.map((s) => h("span.tag", { style: { background: "var(--field)" } }, s.name))),
        h("button.btn.primary.medium", { type: "button", onclick: () => commit(() => installProgram(p)) }, icon("plus"), "Suivre ce programme")
      ),
    ])
  );
}

function templatesSection(ctx, custom) {
  return card(
    h(
      "div.hstack",
      cardTitle("Mes modèles", "stack"),
      h("span.spacer"),
      h("button.icon-btn", { type: "button", "aria-label": "Nouveau modèle", onclick: () => { const t = newTemplate(""); commit(() => S.templates.push(t)); ctx.present(templateEdit, { template: t, isNew: true }, { dismissable: false }); } }, icon("plus", 26))
    ),
    custom.length ? null : h("p.caption.secondary", "Push, Pull, Legs… Crée un modèle et démarre ensuite en un geste, avec les charges de la dernière fois."),
    h(
      "div.vstack",
      { style: { gap: 0 } },
      custom.map((t) => {
        const count = t.items.length;
        const summary = templateSummary(t);
        const row = h(
          "div.hstack.gap12.tap",
          { style: { padding: "10px 0", borderTop: "0.5px solid var(--separator)", cursor: "pointer" }, onclick: (e) => !e.target.closest("button") && ctx.present(templateEdit, { template: t, isNew: false }) },
          muscleIcon(templateMuscleGroups(t)[0] || "fullBody", 36),
          h("div.grow.vstack.gap2", h("span.headline", t.name), h("span.caption.secondary.ellipsis", [`${count} exercice${count > 1 ? "s" : ""}`, summary].filter(Boolean).join(" · "))),
          h("button.circle-btn", { type: "button", "aria-label": `Démarrer ${t.name}`, onclick: () => commit(() => startFromTemplate(t)) }, icon("play"))
        );
        return longPress(row, () =>
          menu([
            { label: "Modifier", icon: "edit", onClick: () => ctx.present(templateEdit, { template: t, isNew: false }) },
            { label: "Supprimer", icon: "trash", destructive: true, onClick: () => commit(() => (S.templates = S.templates.filter((x) => x !== t))) },
          ], { title: t.name })
        );
      }),
      h(
        "button.hstack.gap12",
        { type: "button", style: { padding: "10px 0", borderTop: "0.5px solid var(--separator)", width: "100%", textAlign: "left" }, onclick: () => commit(() => S.workouts.push(newWorkout(`Séance du ${dayMonth(Date.now())}`))) },
        h("span.circle-btn", icon("bolt")),
        h("span.headline.grow", "Séance libre"),
        h("span.accent", icon("play", 18))
      )
    )
  );
}

function lastWorkoutCard(ctx, w) {
  return h(
    "button.card.press",
    { type: "button", onclick: () => ctx.push(workoutDetail, { id: w.id }) },
    h("div.hstack.gap14", muscleIcon(mainMuscleGroup(w) || "fullBody", 36), h("div.grow.vstack.gap2", h("span.caption.secondary", `Dernière séance · ${relative(w.startedAt)}`), h("span.headline.ellipsis", w.title), h("span.caption.secondary", `${durationText(workoutDuration(w))} · ${kgText(workoutVolume(w))}`)), h("span.chev", icon("chevron")))
  );
}

// MARK: Recovery card and check-in

function recoveryCard(ctx) {
  const today = checkInFor(dayKey());
  const finished = finishedWorkouts();
  const muscles = freshness(finished.slice(0, 20));
  const score = recoveryScore(today, muscles);
  const tired = muscles.filter((m) => m.freshness < 0.95).sort((a, b) => a.freshness - b.freshness);
  const tint = scoreTint(score.value);
  const de = deloadEnd();
  let coach = null;
  if (de) coach = advice({ iconName: "battery", tint: "var(--blue)", title: "Semaine de décharge", message: `Jusqu'au ${weekdayDayMonth(de)} : moitié des séries, charges stables.`, action: "Arrêter", onAction: () => commit((s) => (s.settings.deloadUntil = null)) });
  else if (isLightToday()) coach = advice({ iconName: "leaf", tint: "var(--green)", title: "Séance allégée aujourd'hui", message: "Tes modèles démarrent avec moitié moins de séries, sans hausse de charge.", action: "Annuler", onAction: () => commit((s) => (s.settings.lightDay = null)) });
  else {
    const reason = deloadReason(finished.slice(0, 80), S.checkIns);
    if (reason) coach = advice({ iconName: "batteryLow", tint: "var(--orange)", title: "Une semaine de décharge t'aiderait", message: reason + " Une semaine plus légère et tu reviendras plus fort.", action: "Commencer", onAction: () => commit((s) => (s.settings.deloadUntil = Date.now() + 7 * 86_400_000)) });
    else if (score.value < 50) coach = advice({ iconName: "leaf", tint: "var(--orange)", title: "Allège ta séance du jour", message: "Ta récupération est basse : moitié moins de séries et pas de hausse de charge aujourd'hui.", action: "Alléger", onAction: () => commit((s) => (s.settings.lightDay = dayKey())) });
  }
  return card(
    h("div.hstack", cardTitle("Récupération", "heart", "var(--green)"), h("span.spacer"), h("button.text-btn", { type: "button", onclick: () => ctx.present(checkInSheet, {}) }, hasFeelings(today) ? "Modifier" : "Faire le point")),
    h(
      "div.hstack.gap16",
      ring(score.value / 100, tint, { size: 70, width: 9, center: h("span.display", { style: { fontSize: "24px" } }, score.value) }),
      h("div.vstack.gap4.grow", h("span.headline", verdict(score.value)), h("span.footnote.secondary", score.isComplete ? (score.factors.length ? capFirst(score.factors.join(" · ")) : "Rien à signaler aujourd'hui.") : "Selon tes dernières séances. Fais le point sur ta nuit pour un score complet."))
    ),
    coach,
    tired.length
      ? [
          h("div.scroll-x", tired.map((m) => h("span.hstack.gap6", { style: { background: "var(--field)", borderRadius: "999px", padding: "4px 10px 4px 4px", flex: "none" } }, muscleIcon(m.group, 22), h("span.footnote", muscle(m.group).label), h("span.footnote.semibold.mono", { style: { color: m.freshness < 0.5 ? "var(--red)" : "var(--orange)" } }, `${Math.round(m.freshness * 100)} %`)))),
          h("p.caption2.secondary", "Fraîcheur musculaire : chaque série fatigue son muscle pendant environ 3 jours."),
        ]
      : h("div.hstack.footnote", { style: { color: "var(--green-ink)", gap: "6px" } }, icon("checkCircle", 16), "Tous tes muscles sont reposés")
  );
}

const RATINGS = ["Très mauvaise", "Mauvaise", "Correcte", "Bonne", "Excellente"];
const LEVELS = ["Aucun", "Léger", "Moyen", "Fort", "Très fort"];

export function checkInSheet(ctx) {
  const day = dayKey();
  const e = checkInFor(day) || { day, sleepHours: null, sleepQuality: null, energy: null, soreness: null, stress: null, water: 0, alcohol: 0, caffeine: 0, note: "" };
  const set = (k, v) => commit(() => Object.assign(checkInFor(day, true), { [k]: v }));
  const rating = (title, key) =>
    h("div.cell", { style: { flexDirection: "column", alignItems: "stretch", gap: "8px" } }, h("div.hstack", h("span.grow", title), h("span.secondary", e[key] != null ? RATINGS[e[key] - 1] : "Non noté")), segmented([1, 2, 3, 4, 5].map((n) => [n, String(n)]), e[key], (v) => set(key, v), { label: title }));
  const level = (title, key) => h("label.cell", h("span.grow", title), picker([["", "Non noté"], ...LEVELS.map((l, i) => [String(i + 1), l])], e[key] == null ? "" : String(e[key]), (v) => set(key, v === "" ? null : Number(v))));
  const stepRow = (label, key, max) => h("div.cell", h("span.grow", label), stepper(e[key], (v) => set(key, v), { min: 0, max, label }));
  const sleep = e.sleepHours ?? 7.5;
  return {
    title: "Faire le point",
    right: okBtn(ctx, "OK", () => {
      commit(() => {
        const c = checkInFor(day, true);
        if (c.sleepHours == null) c.sleepHours = 7.5;
      });
      ctx.close();
    }),
    body: [
      section({ header: "Sommeil" }, h("div.cell", h("span.grow", "Durée"), h("span.secondary.mono", `${num(sleep, 1)} h`), stepper(sleep, (v) => set("sleepHours", v), { min: 2, max: 12, step: 0.5, label: "Durée" })), rating("Qualité", "sleepQuality")),
      section({ header: "Ce matin" }, rating("Énergie", "energy"), level("Courbatures", "soreness"), level("Stress", "stress")),
      section(
        { header: "Habitudes", footer: "Le journal montre ensuite ce qui aide ou freine ta récupération (Progrès > Journal)." },
        stepRow(`Eau : ${e.water} verre${e.water > 1 ? "s" : ""}`, "water", 20),
        stepRow(`Cafés : ${e.caffeine}`, "caffeine", 10),
        stepRow(`Alcool hier soir : ${e.alcohol} verre${e.alcohol > 1 ? "s" : ""}`, "alcohol", 15)
      ),
      section({ header: "Note" }, textCell(e.note, "Douleur, maladie, voyage…", (v) => set("note", v), { multiline: true, attrs: { oninput: (ev) => silent(() => (checkInFor(day, true).note = ev.target.value)) } })),
    ],
  };
}

// MARK: Coach

function insightRow(i, compact) {
  return h("div.hstack.top.gap12", h("span", { style: { color: KIND_COLORS[i.kind], width: "24px", display: "inline-flex", justifyContent: "center" } }, icon(i.icon, 18)), h("div.grow.vstack.gap2", h("span.subheadline.semibold", i.title), h((compact ? "span.caption.clamp2" : "span.callout") + ".secondary", i.message)));
}

function coachCard(ctx, report) {
  return h(
    "button.card.press",
    { type: "button", onclick: () => ctx.present(coachView, {}) },
    h("div.hstack.gap10", h("span.circle-btn", { style: { width: "34px", height: "34px" } }, icon("sparkles")), h("div.grow.vstack.gap2", h("span.headline", "Ton coach"), h("span.caption.secondary", report.headline)), h("span.chev", icon("chevron"))),
    report.insights.slice(0, 2).map((i) => insightRow(i, true))
  );
}

export function coachView(ctx) {
  const report = analyze(finishedWorkouts().slice(0, 120));
  const group = (title, list) =>
    list.length
      ? h(
          "div.vstack.gap10",
          h("h3.title3.bold", title),
          list.map((i) => {
            const entry = i.exercise && libEntry(i.exercise);
            return card(insightRow(i, false), entry && h("button.text-btn", { type: "button", onclick: () => ctx.present(demoSheet, { entry }, { detent: "large" }) }, icon("play"), "Voir l'exécution"));
          })
        )
      : null;
  const by = (k) => report.insights.filter((i) => i.kind === k);
  return {
    title: "Ton coach",
    right: okBtn(ctx),
    body: [
      h("p.subheadline.secondary", report.headline),
      group("À faire la prochaine fois", by("action")),
      group("Attention", by("warning")),
      group("Points forts", by("win")),
      group("Bon à savoir", by("info")),
      report.insights.length ? null : emptyState("sparkles", "Pas encore assez de données", "Après quelques séances, je repère tes progrès, ce qui stagne et l'équilibre de ton entraînement."),
      h("p.caption2.tertiary", "Analyse faite sur ton appareil à partir de tes 10 dernières semaines : progression du 1RM estimé, RPE (noté ou calculé), séries par muscle, équilibre poussée et tirage, régularité. Ce sont des repères généraux, pas un avis médical."),
    ],
  };
}

// MARK: Program detail

export function programDetail(ctx) {
  const name = ctx.props.programName;
  const program = PROGRAMS.find((p) => p.name === name);
  const phase = programPhase(S.settings.programStartDate || 0);
  return {
    title: name,
    right: okBtn(ctx),
    body: [
      section(
        { footer: "Semaines 1-2 : reprise. 3 à 6 : progression. 7 : surcharge. 8 : décharge, l'app réduit alors les séries de moitié." },
        h("div.cell", { style: { flexDirection: "column", alignItems: "stretch", gap: "10px", padding: "14px 16px" } },
          h("span.headline", `Semaine ${phase.week} sur ${CYCLE_WEEKS} · ${phase.title}`),
          h("span.subheadline.secondary", phase.detail),
          h("div.hstack", { style: { gap: "4px" } }, Array.from({ length: CYCLE_WEEKS }, (_, i) => h("span", { style: { flex: 1, height: "6px", borderRadius: "999px", background: i + 1 <= phase.week ? "linear-gradient(180deg, var(--accent-2), var(--accent))" : "var(--field)" } })))
        )
      ),
      program && section({ header: "Règles" }, ...program.rules.map((r) => h("div.cell.top", h("span.accent", icon("seal", 18)), h("span.subheadline", r)))),
      program &&
        program.sessions.map((s) =>
          section(
            { header: `${s.day} · ${s.name}` },
            ...s.exercises.map((e) => h("div.cell.top", muscleIcon(e.group, 30), h("div.vstack.gap2", h("span", e.name), h("span.caption.secondary", `${e.sets} × ${e.minReps}-${e.maxReps} reps · repos ${restText(e.rest)}`), e.note && h("span.caption.secondary.italic", e.note))))
          )
        ),
      section(
        { footer: "Les séances du programme sont des modèles : tu peux les modifier (appui long sur une séance) sans casser le suivi." },
        cell({ label: "Recommencer le cycle à la semaine 1", cls: "action", onClick: () => { commit((st) => (st.settings.programStartDate = Date.now())); toast("Cycle relancé à la semaine 1"); } }),
        cell({ label: "Arrêter le programme", destructive: true, onClick: () => confirm("Arrêter le programme ?", "Ses 5 modèles seront supprimés. Ton historique est conservé.", "Arrêter", () => { commit(() => uninstallProgram(name)); ctx.close(); }) })
      ),
    ],
  };
}

// MARK: Template editor

export function templateEdit(ctx) {
  const { template: t, isNew } = ctx.props;
  const ok = () => {
    commit(() => {
      if (!t.name.trim()) t.name = "Mon modèle";
    });
    ctx.close();
  };
  const cancel = () => {
    commit(() => (S.templates = S.templates.filter((x) => x !== t)));
    ctx.close();
  };
  const itemRow = (item) => {
    const ex = exById(item.exerciseId);
    const up = (fn) => commit(() => fn(item));
    const rows = [
      h("div.hstack", h("span.headline.grow", ex?.name ?? "Exercice supprimé"), ex && h("button.text-btn", { type: "button", onclick: () => ctx.present(replaceExercise, { current: ex, onPick: (n) => commit(() => (item.exerciseId = n.id)) }) }, icon("swap"), "Remplacer")),
      h("div.hstack", h("span.grow", `${item.targetSets} séries`), stepper(item.targetSets, (v) => up((i) => (i.targetSets = v)), { min: 1, max: 10 })),
    ];
    if (item.minReps != null) {
      rows.push(h("div.hstack", h("span.grow", `Reps min : ${item.minReps}`), stepper(item.minReps, (v) => up((i) => (i.minReps = Math.min(v, i.targetReps))), { min: 1, max: 50 })));
      rows.push(h("div.hstack", h("span.grow", `Reps max : ${item.targetReps}`), stepper(item.targetReps, (v) => up((i) => (i.targetReps = Math.max(v, i.minReps))), { min: 1, max: 50 })));
    } else rows.push(h("div.hstack", h("span.grow", `${item.targetReps} répétitions`), stepper(item.targetReps, (v) => up((i) => (i.targetReps = v)), { min: 1, max: 50 })));
    if (item.restSeconds != null) rows.push(h("div.hstack", h("span.grow", `Repos : ${restText(item.restSeconds)}`), stepper(item.restSeconds, (v) => up((i) => (i.restSeconds = v)), { min: 30, max: 300, step: 15 })));
    return swipe(h("div.cell", { style: { flexDirection: "column", alignItems: "stretch", gap: "8px", padding: "12px 16px" } }, rows), { onDelete: () => commit(() => (t.items = t.items.filter((x) => x !== item))) });
  };
  return {
    title: isNew ? "Nouveau modèle" : "Modifier le modèle",
    left: isNew ? cancelBtn(ctx, "Annuler", cancel) : null,
    right: okBtn(ctx, "OK", ok),
    body: [
      section({ header: "Nom" }, h("label.cell", input({ value: t.name, placeholder: "Ex. Push, Haut du corps…", attrs: { "data-fid": "tpl-name" }, onInput: (v) => silent(() => (t.name = v)) }))),
      section(
        { header: "Exercices" },
        ...t.items.map(itemRow),
        cell({ lead: h("span.accent", icon("plus", 20)), label: "Ajouter un exercice", cls: "action", onClick: () => ctx.present(exercisePicker, { onPick: (ex) => commit(() => t.items.push(newTemplateItem(ex.id))) }) })
      ),
    ],
  };
}

// MARK: Active workout

let banner = null;
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock && document.visibilityState === "visible") {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && activeWorkoutSafe()) keepAwake(true);
});
const activeWorkoutSafe = () => {
  try {
    return activeWorkout();
  } catch {
    return null;
  }
};

// Rest timer: sound and vibration when it ends (in place of the iPhone's notification)
let audio = null;
function prepareSound() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch {}
}
function beep() {
  haptic([200, 100, 200]);
  if (!audio) return;
  try {
    const t = audio.currentTime;
    [0, 0.28].forEach((d) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.4, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.22);
      o.connect(g).connect(audio.destination);
      o.start(t + d);
      o.stop(t + d + 0.25);
    });
  } catch {}
}
let rang = null;
function startRest(seconds) {
  prepareSound();
  const total = seconds ?? S.settings.restDuration;
  S.rest = { endDate: Date.now() + total * 1000, total };
  rang = null;
}

function restBar() {
  const r = S.rest;
  if (!r) return null;
  const time = h("span.rest-time");
  const label = h("span.caption.semibold", { style: { opacity: 0.85 } });
  const C = 2 * Math.PI * 19.5;
  const arc = svg("circle", { cx: 22, cy: 22, r: 19.5, fill: "none", stroke: "#fff", "stroke-width": 5, "stroke-linecap": "round", "stroke-dasharray": C });
  const ringEl = h("div.rest-ring", svg("svg", { viewBox: "0 0 44 44", width: 44, height: 44 }, svg("circle", { cx: 22, cy: 22, r: 19.5, fill: "none", stroke: "rgba(255,255,255,.3)", "stroke-width": 5 }), arc));
  const iconBox = h("span", { style: { position: "relative", display: "inline-flex" } });
  ringEl.append(iconBox);
  const dismiss = h("button.rest-pill.white", { type: "button", onclick: () => commit((s) => (s.rest = null)) });
  const update = () => {
    if (!S.rest) return;
    const left = Math.max(0, (S.rest.endDate - Date.now()) / 1000);
    const remaining = Math.ceil(left);
    const over = remaining === 0;
    time.textContent = `${Math.trunc(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
    label.textContent = over ? "C'est reparti !" : "Repos";
    arc.setAttribute("stroke-dashoffset", C * (1 - (S.rest.total > 0 ? left / S.rest.total : 0)));
    iconBox.replaceChildren(icon(over ? "bell" : "timer"));
    dismiss.textContent = over ? "OK" : "Passer";
    if (over && rang !== S.rest.endDate) {
      rang = S.rest.endDate;
      beep();
    }
  };
  update();
  tick(update);
  return h(
    "div.rest-bar",
    { role: "timer" },
    ringEl,
    h("div.vstack", { style: { gap: 0 } }, label, time),
    h("span.spacer"),
    h("button.rest-pill", { type: "button", onclick: () => commit((s) => { s.rest.total += 30; s.rest.endDate = Math.max(s.rest.endDate, Date.now()) + 30_000; rang = null; }) }, "+30 s"),
    dismiss
  );
}

function activeScreen(ctx, w) {
  keepAwake(true);
  const all = w.exercises.flatMap((e) => e.sets);
  const done = all.filter((s) => s.isCompleted);
  const duration = h("span.headline.mono");
  const upd = () => {
    const sec = Math.max(0, Math.trunc((Date.now() - w.startedAt) / 1000));
    duration.textContent = `${Math.trunc(sec / 3600)}:${String(Math.trunc(sec / 60) % 60).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  };
  upd();
  tick(upd);
  const metric = (value, label) => h("div.grow.vstack.gap2", value instanceof Node ? value : h("span.headline.mono", value), h("span.caption.secondary", label));
  const options = () =>
    menu([
      ...REST_OPTIONS.map((sec) => ({ label: `Repos : ${restText(sec)}`, checked: S.settings.restDuration === sec, onClick: () => commit((s) => (s.settings.restDuration = sec)) })),
      null,
      { label: "Calculateur de disques", icon: "plates", onClick: () => ctx.present(plateCalculator, { target: 60 }, { detent: "medium" }) },
      { label: "Abandonner la séance", icon: "trash", destructive: true, onClick: () => confirm("Abandonner la séance ?", "Toutes les données de cette séance seront supprimées.", "Abandonner", () => { keepAwake(false); commit((s) => { s.rest = null; discardWorkout(w); }); }) },
    ], { title: "Options de la séance" });
  const finish = () =>
    menu([{ label: "Terminer", onClick: () => {
      const summary = makeSummary(w);
      keepAwake(false);
      commit((s) => {
        s.rest = null;
        finishWorkout(w);
      });
      if (summary.setCount > 0) present(summarySheet, { summary }, { detent: "large" });
    } }], { title: "Terminer la séance ?", message: "Seules les séries cochées seront enregistrées." });

  return {
    title: "Séance en cours",
    left: barBtn("", options, { iconName: "ellipsis", aria: "Options de la séance" }),
    right: barBtn("Terminer", finish, { bold: true }),
    bottom: restBar(),
    overlay: banner && banner.until > Date.now() ? h("div.record-banner", icon("trophy"), h("div.vstack.gap2", h("span.subheadline.bold", "Nouveau record !"), h("span.caption.secondary", banner.text))) : null,
    body: [
      h(
        "div.workout-head",
        h("input.title-input", { value: w.title, placeholder: "Nom de la séance", "aria-label": "Nom de la séance", "data-fid": "w-title", oninput: (e) => silent(() => (w.title = e.target.value)), onchange: () => commit() }),
        h("div.hstack", { style: { gap: 0 } }, metric(duration, "Durée"), metric(`${done.length}/${all.length}`, "Séries"), metric(kgText(done.reduce((a, s) => a + setVolume(s), 0)), "Volume")),
        h("div.progress-line", h("i", { style: { width: (done.length / Math.max(all.length, 1)) * 100 + "%" } }))
      ),
      w.exercises.map((entry, i) => exerciseSection(ctx, w, entry, i)),
      h("button.btn.primary", { type: "button", onclick: () => ctx.present(exercisePicker, { onPick: (ex) => commit(() => addExercise(w, ex)) }) }, icon("plus"), w.exercises.length ? "Ajouter un exercice" : "Ajouter ton premier exercice"),
    ],
  };
}

function completed(w, entry, set) {
  if (restsAfter(w, entry)) startRest(entry.restSeconds);
  if (set.kind === "warmup" || !(set.weight > 0)) return;
  const previous = previousBest1RM(entry, w);
  if (previous == null) return;
  const others = Math.max(0, ...entry.sets.filter((s) => s.isCompleted && s !== set).map(set1RM));
  const est = set1RM(set);
  if (est <= Math.max(previous, others)) return;
  banner = { text: `${exById(entry.exerciseId)?.name ?? "Record"} · 1RM estimé ${kgText(est)}`, until: Date.now() + 3500 };
  haptic([30, 60, 30]);
  setTimeout(refresh, 3600);
}

const fmt2 = (v) => num(v, 2);
const pairText = (weight, reps) => (weight > 0 ? `${fmt2(weight)} × ${reps}` : `${reps} reps`);
const kindColor = { normal: "var(--secondary)", warmup: "var(--orange)", drop: "var(--purple)", failure: "var(--red)" };
const rpeColor = (r) => (r >= 9.5 ? "var(--red)" : r >= 8.5 ? "var(--orange)" : "var(--green-ink)");

function exerciseSection(ctx, w, entry, index) {
  const ex = exById(entry.exerciseId);
  const demo = ex && libEntry(ex);
  const previousBest = previousBest1RM(entry, w);
  const previousSets = ex ? historyOf(ex.id).filter((x) => x.workout.id !== w.id)[0]?.entry.sets ?? [] : [];
  const letter = entry.supersetGroup != null ? supersetLetter(w, entry.supersetGroup) : null;
  const isLast = index === w.exercises.length - 1;
  const canSuperset = entry.supersetGroup != null || !isLast;
  const showPlates = (weight) => ctx.present(plateCalculator, { target: weight }, { detent: "medium" });
  const swap = (next) => {
    const old = ex;
    commit(() => replaceEntryExercise(entry, next));
    const tpls = templatesUsing(w, old.id);
    if (tpls.length)
      setTimeout(() =>
        menu([
          { label: `Remplacer aussi dans « ${tpls[0].name} »`, onClick: () => commit(() => tpls.forEach((t) => replaceInTemplate(t, old.id, next))) },
          { label: "Cette séance seulement", onClick: () => {} },
        ], { title: "Garder ce changement pour la prochaine fois ?", message: `${next.name} remplacera ${old.name} dans le modèle.` }), 500);
  };
  const options = () =>
    menu([
      { label: "Ajouter l'échauffement", icon: "flame", disabled: !entry.sets.some((s) => s.kind !== "warmup" && s.weight > 0), onClick: () => commit(() => addWarmUp(entry, S.settings.barWeight)) },
      canSuperset && { label: entry.supersetGroup == null ? "Superset avec le suivant" : "Retirer du superset", icon: "link", onClick: () => commit(() => toggleSuperset(w, entry)) },
      demo && { label: "Voir l'exécution", icon: "strength", onClick: () => ctx.present(demoSheet, { entry: demo }) },
      ex && { label: "Remplacer l'exercice", icon: "swap", onClick: () => ctx.present(replaceExercise, { current: ex, onPick: swap }) },
      index > 0 && { label: "Monter", icon: "arrowUp", onClick: () => commit(() => moveEntry(w, entry, -1)) },
      !isLast && { label: "Descendre", icon: "arrowDown", onClick: () => commit(() => moveEntry(w, entry, 1)) },
      { label: "Calculer les disques", icon: "plates", onClick: () => showPlates(entry.sets[entry.sets.length - 1]?.weight ?? 0) },
      { label: "Retirer l'exercice", icon: "trash", destructive: true, onClick: () => commit(() => (w.exercises = w.exercises.filter((x) => x !== entry))) },
    ].filter(Boolean), { title: ex?.name });

  let working = 0;
  const rows = entry.sets.map((set, si) => {
    if (set.kind !== "warmup") working++;
    const row = setRow(ctx, w, entry, set, working, si < previousSets.length ? previousSets[si] : null, previousBest);
    return longPress(swipe(row, { onDelete: () => commit(() => (entry.sets = entry.sets.filter((x) => x !== set))) }), () => menu([{ label: "Calculer les disques", icon: "plates", onClick: () => showPlates(set.weight) }]));
  });

  const target = targetDescription(entry);
  const footer = [
    target && h("div.line", icon("target"), h("span", `Objectif : ${target}`)),
    entry.note && h("div.line", icon("bulb"), h("span", entry.note)),
    entry.progressionIncrement > 0 && h("div.line.green", icon("arrowUpCircle"), h("span", `Objectif en hausse : +${num(entry.progressionIncrement, 2)} kg par rapport à la dernière fois.`)),
    ex?.notes && h("div.line", icon("note"), h("span", ex.notes)),
  ].filter(Boolean);

  return h(
    "div.ex-section",
    h(
      "div.ex-header",
      ex ? (demo ? h("button.press", { type: "button", "aria-label": "Voir l'exécution", onclick: () => ctx.present(demoSheet, { entry: demo }) }, thumb(demo, 30)) : muscleIcon(ex.muscleGroup, 28)) : null,
      h("div.grow.vstack", { style: { gap: "1px" } }, letter && h("span.superset-label", icon("link"), `Superset ${letter}`), h("span.ex-name", ex?.name ?? "Exercice supprimé")),
      h("button.icon-btn", { type: "button", "aria-label": "Options de l'exercice", onclick: options }, icon("ellipsis", 26))
    ),
    h(
      "div.list-group",
      h("div.set-grid.set-head", h("span", "Série"), h("span", { style: { textAlign: "left" } }, "Objectif"), h("span", "kg"), h("span", "Reps"), h("span", "RPE"), icon("check")),
      rows,
      h("button.add-set", { type: "button", onclick: () => commit(() => { const last = entry.sets[entry.sets.length - 1]; entry.sets.push(newSet(last?.reps ?? 10, last?.weight ?? 0)); }) }, icon("plus"), "Ajouter une série")
    ),
    footer.length ? h("div.ex-footer", footer) : null
  );
}

function setRow(ctx, w, entry, set, number, previous, ref1RM) {
  const kind = kindOf(set);
  const isRecord = set.isCompleted && ref1RM != null && set1RM(set) > ref1RM;
  const badgeText = isRecord ? icon("trophy") : SET_KINDS[kind].letter ? h("span", { style: { color: set.isCompleted ? "#fff" : kindColor[kind] } }, SET_KINDS[kind].letter) : String(number);
  const kindSelect = h(
    "select",
    { "aria-label": `Série ${number}, ${SET_KINDS[kind].label}`, onchange: (e) => commit(() => (set.kind = e.target.value === "normal" ? null : e.target.value)) },
    Object.entries(SET_KINDS).map(([k, v]) => h("option", { value: k, selected: k === kind }, v.label))
  );
  const badge = h("span.set-badge" + (set.isCompleted ? ".done" : ""), badgeText, kindSelect);

  let targetNode;
  if (set.targetReps != null) {
    const hit = set.isCompleted && reachedTarget(set);
    targetNode = [h("span.t" + (hit ? ".hit" : ""), icon(hit ? "seal" : "target"), pairText(set.targetWeight ?? 0, set.targetReps)), previous && h("span.p", `avant ${pairText(previous.weight, previous.reps)}`)];
  } else targetNode = h("span.p", { style: { fontSize: "15px" } }, previous ? pairText(previous.weight, previous.reps) : "—");
  const targetBtn = h(
    "button.target-btn",
    {
      type: "button",
      disabled: !previous && set.targetReps == null,
      onclick: () =>
        commit(() => {
          if (set.targetReps != null) {
            set.weight = set.targetWeight ?? set.weight;
            set.reps = set.targetReps;
          } else if (previous) {
            set.weight = previous.weight;
            set.reps = previous.reps;
          }
        }),
    },
    targetNode
  );

  const weightIn = h("input.set-input", { type: "text", inputmode: "decimal", placeholder: "0", value: set.weight ? fmt2(set.weight).replace(/\s/g, "") : "", "aria-label": "Charge en kg", "data-fid": `w-${set.id}`, enterkeyhint: "next" });
  weightIn.addEventListener("input", () => silent(() => (set.weight = parseNumber(weightIn.value) ?? 0)));
  weightIn.addEventListener("change", () => commit());
  const repsIn = h("input.set-input", { type: "text", inputmode: "numeric", placeholder: "0", value: set.reps ? String(set.reps) : "", "aria-label": "Répétitions", "data-fid": `r-${set.id}`, enterkeyhint: "done" });
  repsIn.addEventListener("input", () => silent(() => (set.reps = Math.max(0, Math.round(parseNumber(repsIn.value) ?? 0)))));
  repsIn.addEventListener("change", () => commit());
  for (const el of [weightIn, repsIn]) {
    el.addEventListener("focus", () => setTimeout(() => el.select(), 0));
    el.addEventListener("keydown", (e) => e.key === "Enter" && el.blur());
  }

  const est = estimateRPE(set.weight, set.reps, ref1RM);
  const rpeLabel = set.rpe != null ? num(set.rpe, 1) : est != null ? "~" + num(est, 1) : "–";
  const rpeSelect = h(
    "select",
    { "aria-label": "RPE", onchange: (e) => commit(() => (set.rpe = e.target.value === "" ? null : Number(e.target.value))) },
    h("option", { value: "", selected: set.rpe == null }, est != null ? `Calculé : ~${num(est, 1)}` : "Non noté"),
    [...RPE_VALUES].reverse().map((v) => h("option", { value: String(v), selected: set.rpe === v }, `${num(v, 1)} · ${rpeMeaning(v)}`))
  );
  const rpe = h("span.rpe-btn", { style: set.rpe != null ? { color: rpeColor(set.rpe), fontWeight: 600 } : null }, rpeLabel, rpeSelect);

  const check = h(
    "button.check-btn" + (set.isCompleted ? ".on" : ""),
    {
      type: "button",
      "aria-label": set.isCompleted ? "Série validée" : "Valider la série",
      onclick: () => {
        haptic(8);
        const now = !set.isCompleted;
        commit(() => {
          set.isCompleted = now;
          if (now) completed(w, entry, set);
        });
      },
    },
    icon(set.isCompleted ? "checkCircle" : "circle")
  );
  return h("div.set-grid.set-row" + (set.isCompleted ? ".done" : ""), badge, targetBtn, weightIn, repsIn, rpe, check);
}

// MARK: Summary

function makeSummary(w) {
  const completedSets = w.exercises.flatMap((e) => e.sets.filter((s) => s.isCompleted));
  const records = w.exercises
    .map((e) => {
      const name = exById(e.exerciseId)?.name;
      const prev = previousBest1RM(e, w);
      const doneSets = e.sets.filter((s) => s.isCompleted);
      if (!name || prev == null || !doneSets.length) return null;
      const best = doneSets.reduce((a, s) => (set1RM(s) > set1RM(a) ? s : a));
      return set1RM(best) > prev ? `${name} : ${kgText(best.weight)} × ${best.reps}` : null;
    })
    .filter(Boolean);
  return {
    title: w.title,
    duration: Date.now() - w.startedAt,
    exerciseCount: w.exercises.filter((e) => e.sets.some((s) => s.isCompleted)).length,
    setCount: completedSets.length,
    volume: completedSets.reduce((a, s) => a + setVolume(s), 0),
    records,
  };
}

function summarySheet(ctx) {
  const s = ctx.props.summary;
  haptic([20, 40, 20]);
  return {
    title: "Séance terminée",
    right: barBtn("Fermer", () => ctx.close(), { bold: true }),
    body: [
      h(
        "div.vstack",
        { style: { alignItems: "center", gap: "10px", padding: "16px 0" } },
        h("span", { class: "summary-badge", style: { width: "96px", height: "96px", borderRadius: "50%", background: "linear-gradient(180deg, var(--accent-2), var(--accent))", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", animation: "pop .5s cubic-bezier(.34,1.56,.64,1)" } }, icon(s.records.length ? "trophy" : "seal", 44)),
        h("h2.title1", s.records.length ? "Nouveau record !" : "Bien joué !"),
        h("span.secondary", s.title)
      ),
      section({}, cell({ label: "Durée", value: durationText(s.duration) }), cell({ label: "Exercices", value: String(s.exerciseCount) }), cell({ label: "Séries", value: String(s.setCount) }), cell({ label: "Volume", value: kgText(s.volume) })),
      s.records.length ? section({ header: "Nouveaux records" }, ...s.records.map((r) => cell({ lead: h("span", { style: { color: "var(--yellow)" } }, icon("trophy", 20)), label: r }))) : null,
    ],
  };
}
