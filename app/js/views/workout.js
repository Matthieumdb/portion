// Séance tab: start screen, template editor and the running workout.
import { h, icon, kg, formatDate, duration, sheet, confirmSheet, toast } from "../ui.js";
import { getState, update } from "../store.js";
import { iso, backupIsDue, exportBackup } from "../backup.js";
import { MUSCLE_GROUPS, MUSCLE_COLORS } from "../data.js";
import {
  workoutFromTemplate, newWorkout, entryFor, cleanUp, records, history, workoutVolume, isWarmup,
} from "../training.js";
import { rest } from "../rest.js";

export function workoutTab() {
  const s = getState();
  return s.active ? activeWorkout(s.active) : startScreen(s);
}

// MARK: Start

function greeting() {
  const hour = new Date().getHours();
  return hour >= 5 && hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
}

function weekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function weekStats(workouts) {
  const start = weekStart();
  const thisWeek = workouts.filter((w) => new Date(w.startedAt) >= start).length;
  const trained = new Set(workouts.map((w) => +weekStart(w.startedAt)));
  let streak = 0;
  let week = new Date(start);
  if (!trained.has(+week)) week.setDate(week.getDate() - 7);
  while (trained.has(+week)) {
    streak++;
    week.setDate(week.getDate() - 7);
  }
  return { thisWeek, streak, total: workouts.length };
}

function start(workout) {
  update((s) => (s.active = workout));
  window.scrollTo(0, 0);
}

function startScreen(s) {
  const finished = s.workouts.filter((w) => w.endedAt);
  const stats = weekStats(finished);
  const last = [...finished].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];

  return h(
    "div.page",
    h("header.large-title", h("p.subtitle", formatDate(new Date())), h("h1", greeting())),

    backupIsDue() &&
      h(
        "section.card.reminder",
        h("div.row-icon", { style: { color: "var(--blue)" } }, icon("cloud", 26)),
        h("div.grow", h("h3", "Sauvegarde de la semaine"), h("p.footnote", "Garde une copie de tes données dans Fichiers ou iCloud Drive, au cas où.")),
        h("button.button.prominent.small", { onclick: () => exportBackup().then((ok) => ok && toast("Sauvegarde enregistrée")) }, "Sauvegarder")
      ),

    h(
      "section.card",
      h("div.card-title", { style: { color: "var(--orange)" } }, icon("flame", 18), "Activité"),
      h(
        "div.stats",
        stat(stats.thisWeek, "cette semaine", "var(--orange)"),
        stat(stats.streak, stats.streak > 1 ? "semaines d'affilée" : "semaine d'affilée", "var(--red)"),
        stat(stats.total, "séances au total", "var(--yellow-ink)")
      )
    ),

    h(
      "section.card.list-card",
      h(
        "div.card-header",
        h("div.card-title", icon("dumbbell", 18), "Mes modèles"),
        h("button.icon-button", { "aria-label": "Nouveau modèle", onclick: () => editTemplate(null) }, icon("plus"))
      ),
      s.templates.length === 0 &&
        h("p.footnote.pad", "Push, Pull, Legs… Crée un modèle et démarre ensuite en un geste, avec les charges de la dernière fois."),
      s.templates.map((t, i) =>
        h(
          "div.row",
          h(
            "button.row-main",
            { onclick: () => editTemplate(i), "aria-label": `Modifier ${t.name}` },
            h("span.row-text", h("span.headline", t.name), h("span.caption", t.items.map((x) => x.exercise).filter(Boolean).join(" · ") || "Aucun exercice"))
          ),
          h("button.play", { "aria-label": `Démarrer ${t.name}`, onclick: () => start(workoutFromTemplate(t)) }, icon("play", 18))
        )
      ),
      h(
        "button.row.row-button",
        { onclick: () => start(newWorkout(`Séance du ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`)) },
        h("span.badge-icon", icon("bolt", 18)),
        h("span.headline.grow", "Séance libre"),
        h("span.accent", icon("play", 18))
      )
    ),

    last &&
      h(
        "section.card",
        h("div.card-title", { style: { color: "var(--secondary)" } }, icon("history", 18), "Dernière séance"),
        h("h3", last.title),
        h(
          "p.footnote",
          `${formatDate(last.startedAt, { weekday: "long", day: "numeric", month: "long" })} · ${duration(new Date(last.endedAt) - new Date(last.startedAt))} · ${kg(workoutVolume(last))}`
        )
      )
  );
}

function stat(value, label, color) {
  return h("div.stat", h("span.stat-value", { style: { color } }, value), h("span.caption", label));
}

// MARK: Templates

function editTemplate(index) {
  const isNew = index == null;
  const draft = isNew
    ? { name: "", programName: null, programOrder: null, items: [] }
    : JSON.parse(JSON.stringify(getState().templates[index]));

  const save = () => {
    if (!draft.name.trim()) draft.name = "Nouveau modèle";
    update((s) => {
      if (isNew) s.templates.push(draft);
      else s.templates[index] = draft;
    });
  };

  sheet(isNew ? "Nouveau modèle" : "Modèle", (close, rerender) =>
    h(
      "div.stack",
      h("div.group", h("input.field", { value: draft.name, placeholder: "Nom (Push, Haut du corps…)", "aria-label": "Nom du modèle", oninput: (e) => (draft.name = e.target.value) })),
      h(
        "div.group",
        draft.items.length === 0 && h("p.footnote.pad", "Ajoute les exercices dans l'ordre où tu les fais."),
        draft.items.map((item, i) =>
          h(
            "div.template-item",
            h("div.row-text.grow", h("span.headline", item.exercise), h("span.caption", `${item.targetSets} × ${item.minReps ? item.minReps + "-" : ""}${item.targetReps} · repos ${restLabel(item.restSeconds ?? getState().settings.restSeconds)}`)),
            h(
              "div.steppers",
              stepper("Séries", item.targetSets, 1, 10, (v) => { item.targetSets = v; rerender(); }),
              stepper("Reps", item.targetReps, 1, 30, (v) => { item.targetReps = v; rerender(); })
            ),
            h("button.icon-button.danger", { "aria-label": `Retirer ${item.exercise}`, onclick: () => { draft.items.splice(i, 1); rerender(); } }, icon("trash", 18))
          )
        ),
        h(
          "button.row.row-button.accent",
          { onclick: () => pickExercise((name) => { draft.items.push({ exercise: name, targetSets: 3, targetReps: 10, minReps: null, restSeconds: null, notes: null }); rerender(); }) },
          icon("plus", 18),
          "Ajouter un exercice"
        )
      ),
      h("button.button.prominent", { onclick: () => { save(); close(); } }, "Enregistrer"),
      !isNew &&
        h(
          "button.button.destructive",
          {
            onclick: () =>
              confirmSheet("Supprimer ce modèle ?", "Les séances déjà faites restent dans l'historique.", "Supprimer", () => {
                update((s) => s.templates.splice(index, 1));
                close();
              }),
          },
          "Supprimer le modèle"
        )
    )
  );
}

function stepper(label, value, min, max, onChange) {
  return h(
    "div.stepper",
    { role: "group", "aria-label": label },
    h("button", { "aria-label": `${label} moins`, disabled: value <= min, onclick: () => onChange(value - 1) }, "−"),
    h("span", { "aria-live": "polite" }, value),
    h("button", { "aria-label": `${label} plus`, disabled: value >= max, onclick: () => onChange(value + 1) }, "+")
  );
}

export const restLabel = (sec) => (sec % 60 === 0 ? `${sec / 60} min` : `${Math.floor(sec / 60)} min ${sec % 60}`);

/** Exercise list with search, and a way to create one. */
export function pickExercise(onPick) {
  let query = "";
  const close = sheet("Exercices", (closeSheet, rerender) => {
    const all = getState().exercises;
    const q = query.trim().toLowerCase();
    const shown = all
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const groups = Object.keys(MUSCLE_GROUPS).map((g) => [g, shown.filter((e) => e.muscleGroup === g)]).filter(([, list]) => list.length);
    const search = h("input.field.search", {
      type: "search", value: query, placeholder: "Rechercher", "aria-label": "Rechercher un exercice",
      oninput: (e) => { query = e.target.value; rerender(); requestAnimationFrame(() => { const el = document.querySelector(".sheet .search"); el?.focus(); el?.setSelectionRange(query.length, query.length); }); },
    });
    return h(
      "div.stack",
      search,
      groups.map(([g, list]) =>
        h(
          "div",
          h("h4.group-title", MUSCLE_GROUPS[g]),
          h("div.group", list.map((e) => h("button.row.row-button", { onclick: () => { closeSheet(); onPick(e.name); } }, h("span.dot", { style: { background: MUSCLE_COLORS[e.muscleGroup] } }), h("span.grow", e.name))))
        )
      ),
      q &&
        !all.some((e) => e.name.toLowerCase() === q) &&
        h("button.button", { onclick: () => createExercise(query.trim(), (name) => { closeSheet(); onPick(name); }) }, `Créer « ${query.trim()} »`)
    );
  });
  return close;
}

export function createExercise(name, done) {
  let group = "chest";
  const close = sheet("Nouvel exercice", (closeSheet, rerender) =>
    h(
      "div.stack",
      h("div.group", h("input.field", { value: name, "aria-label": "Nom", oninput: (e) => (name = e.target.value) })),
      h(
        "div.group",
        Object.entries(MUSCLE_GROUPS).map(([g, label]) =>
          h("button.row.row-button", { onclick: () => { group = g; rerender(); }, "aria-pressed": group === g ? "true" : "false" }, h("span.grow", label), group === g && h("span.accent", icon("check", 18)))
        )
      ),
      h(
        "button.button.prominent",
        {
          onclick: () => {
            const clean = name.trim();
            if (!clean) return;
            update((s) => { if (!s.exercises.some((e) => e.name === clean)) s.exercises.push({ name: clean, muscleGroup: group, notes: "" }); });
            closeSheet();
            done?.(clean);
          },
        },
        "Ajouter"
      )
    )
  );
  return close;
}

// MARK: Running workout

function activeWorkout(w) {
  const done = w.exercises.reduce((t, e) => t + e.sets.filter((s) => s.isCompleted).length, 0);
  const total = w.exercises.reduce((t, e) => t + e.sets.length, 0);

  return h(
    "div.page.workout",
    h(
      "header.workout-header",
      h("input.title-field", { value: w.title, "aria-label": "Nom de la séance", oninput: (e) => update((s) => (s.active.title = e.target.value), { silent: true }) }),
      h("p.subtitle", h("span.elapsed", { "data-start": w.startedAt }, duration(Date.now() - new Date(w.startedAt))), ` · ${done}/${total} séries`)
    ),
    w.exercises.length === 0 && h("section.card", h("p.footnote", "Ajoute un premier exercice pour commencer.")),
    w.exercises.map((entry, ei) => exerciseCard(entry, ei)),
    h("button.button", { onclick: () => pickExercise((name) => update((s) => s.active.exercises.push(entryFor(name)))) }, icon("plus", 18), "Ajouter un exercice"),
    h("div.workout-actions",
      h("button.button.prominent", { onclick: () => finish() }, "Terminer la séance"),
      h("button.button.destructive", { onclick: () => confirmSheet("Abandonner la séance ?", "Rien ne sera enregistré dans l'historique.", "Abandonner", () => { rest.stop(); update((s) => (s.active = null)); }) }, "Abandonner")
    )
  );
}

function exerciseCard(entry, ei) {
  const previous = history(entry.exercise)[0]?.entry.sets.filter((s) => s.isCompleted) || [];
  const range = entry.targetReps ? `${entry.minReps ? entry.minReps + "-" : ""}${entry.targetReps} reps` : null;

  return h(
    "section.card.exercise",
    h(
      "div.card-header",
      h("div.row-text", h("h3", entry.exercise), range && h("span.caption", `Objectif ${range} · repos ${restLabel(entry.restSeconds ?? getState().settings.restSeconds)}`)),
      h("button.icon-button.danger", { "aria-label": `Retirer ${entry.exercise}`, onclick: () => confirmSheet(`Retirer ${entry.exercise} ?`, null, "Retirer", () => update((s) => s.active.exercises.splice(ei, 1))) }, icon("trash", 18))
    ),
    h("div.set-row.set-head", h("span", "Série"), h("span", "Avant"), h("span", "kg"), h("span", "Reps"), h("span.sr-only", "Fait")),
    entry.sets.map((set, si) => setRow(set, si, ei, previous[si])),
    h("button.row-button.add-set", { onclick: () => update((s) => { const sets = s.active.exercises[ei].sets; const last = sets[sets.length - 1]; sets.push({ reps: last?.reps ?? 10, weight: last?.weight ?? 0, isCompleted: false, rpe: null, kind: null }); }) }, icon("plus", 16), "Ajouter une série")
  );
}

function setRow(set, si, ei, prev) {
  const field = (key, label, step) =>
    h("input.set-input", {
      type: "number", inputmode: key === "weight" ? "decimal" : "numeric", step, min: 0, value: set[key] || "", placeholder: "0",
      "aria-label": `${label}, série ${si + 1}`,
      oninput: (e) => {
        const n = Number(e.target.value.replace(",", ".")) || 0;
        // Reps are whole numbers in the backup file, as the iPhone app reads them
        update((s) => (s.active.exercises[ei].sets[si][key] = key === "reps" ? Math.round(n) : n), { silent: true });
      },
      onfocus: (e) => e.target.select(),
    });

  return h(
    "div.set-row" + (set.isCompleted ? ".done" : ""),
    h("button.set-number", {
      "aria-label": `Série ${si + 1}${isWarmup(set) ? ", échauffement" : ""}. Toucher pour changer le type`,
      onclick: () => update((s) => { const x = s.active.exercises[ei].sets[si]; x.kind = x.kind === "warmup" ? null : "warmup"; }),
    }, isWarmup(set) ? "É" : si + 1),
    h("span.previous", prev ? `${prev.weight} × ${prev.reps}` : "—"),
    field("weight", "Charge", "0.25"),
    field("reps", "Répétitions", "1"),
    h("button.check" + (set.isCompleted ? ".on" : ""), {
      "aria-label": set.isCompleted ? "Série validée" : "Valider la série",
      "aria-pressed": set.isCompleted ? "true" : "false",
      onclick: () => {
        let restFor = null;
        update((s) => {
          const entry = s.active.exercises[ei];
          const x = entry.sets[si];
          x.isCompleted = !x.isCompleted;
          if (x.isCompleted) {
            restFor = entry.restSeconds ?? s.settings.restSeconds;
            // Carry the load to the next sets still empty
            for (const next of entry.sets.slice(si + 1)) {
              if (!next.isCompleted && !next.weight && !isWarmup(x)) next.weight = x.weight;
            }
          }
        });
        if (restFor) rest.start(restFor);
      },
    }, icon("check", 20))
  );
}

function finish() {
  const w = getState().active;
  const doneSets = w.exercises.reduce((t, e) => t + e.sets.filter((s) => s.isCompleted).length, 0);
  if (doneSets === 0) {
    confirmSheet("Aucune série validée", "Valide au moins une série, ou abandonne la séance.", "Abandonner la séance", () => { rest.stop(); update((s) => (s.active = null)); });
    return;
  }
  confirmSheet("Terminer la séance ?", "Les séries non validées ne seront pas gardées.", "Terminer", () => {
    rest.stop();
    let summary;
    update((s) => {
      const finished = cleanUp({ ...s.active, endedAt: iso() });
      s.workouts.push(finished);
      s.active = null;
      summary = finished;
    });
    const beaten = records(summary);
    showSummary(summary, beaten);
  }, { destructive: false });
}

function showSummary(w, beaten) {
  sheet("Bravo !", () =>
    h(
      "div.stack",
      h(
        "div.stats.card",
        stat(duration(new Date(w.endedAt) - new Date(w.startedAt)), "durée", "var(--blue)"),
        stat(w.exercises.reduce((t, e) => t + e.sets.length, 0), "séries", "var(--purple)"),
        stat(kg(workoutVolume(w)), "soulevés", "var(--green)")
      ),
      beaten.length > 0 &&
        h(
          "div.group",
          beaten.map((r) =>
            h("div.row", h("span.row-icon", { style: { color: "var(--yellow-ink)" } }, icon("trophy", 20)), h("span.row-text.grow", h("span", r.exercise), h("span.caption", `Nouveau record : 1RM estimé ${kg(r.now)} (avant ${kg(r.before)})`)))
          )
        )
    )
  );
}

export function tickElapsed() {
  const el = document.querySelector(".elapsed");
  if (el) el.textContent = duration(Date.now() - new Date(el.dataset.start));
}

