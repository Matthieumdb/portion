// Progrès tab: workouts per week, body weight and each exercise's estimated 1RM.
import { h, icon, kg, formatDate, barChart, lineChart, sheet, toast } from "../ui.js";
import { getState, update } from "../store.js";
import { history, bestOneRepMax, workoutVolume } from "../training.js";
import { iso } from "../backup.js";
import { MUSCLE_COLORS } from "../data.js";

function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function progressTab(nav) {
  if (nav.exercise) return exerciseDetail(nav.exercise, nav);
  if (nav.weights) return weightsView(nav);

  const s = getState();
  const finished = s.workouts.filter((w) => w.endedAt);
  const now = weekStart(new Date());
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(now);
    start.setDate(start.getDate() - (11 - i) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, count: finished.filter((w) => new Date(w.startedAt) >= start && new Date(w.startedAt) < end).length };
  });
  const thisWeek = finished.filter((w) => new Date(w.startedAt) >= now);
  const trained = s.exercises
    .map((e) => ({ e, h: history(e.name) }))
    .filter((x) => x.h.length)
    .sort((a, b) => a.e.name.localeCompare(b.e.name, "fr"));
  const latestWeight = [...s.bodyWeights].sort((a, b) => b.date.localeCompare(a.date))[0];

  return h(
    "div.page",
    h("header.large-title", h("h1", "Progrès")),
    h(
      "div.tiles",
      tile(thisWeek.length, "séances cette semaine", "var(--orange)"),
      tile(kg(thisWeek.reduce((t, w) => t + workoutVolume(w), 0)), "soulevés cette semaine", "var(--green)")
    ),
    h("section.card", h("div.card-title", "Séances par semaine"), barChart(weeks.map((w) => w.count), weeks.map((w, i) => (i % 3 === 0 ? w.start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "")))),
    h("h4.group-title", "Corps"),
    h(
      "div.group",
      h("button.row.row-button", { onclick: () => nav.open({ weights: true }) },
        h("span.row-icon", icon("scale", 20)),
        h("span.grow", "Poids"),
        h("span.caption", latestWeight ? kg(latestWeight.weight) : "Ajouter"),
        h("span.chevron", icon("chevron", 16)))
    ),
    h("h4.group-title", "Par exercice"),
    h(
      "div.group",
      trained.length === 0 && h("p.footnote.pad", "Termine une séance pour voir ta progression."),
      trained.map(({ e, h: hist }) =>
        h("button.row.row-button", { onclick: () => nav.open({ exercise: e.name }) },
          h("span.dot", { style: { background: MUSCLE_COLORS[e.muscleGroup] } }),
          h("span.row-text.grow", h("span", e.name), h("span.caption", `1RM estimé : ${kg(Math.max(...hist.map((x) => bestOneRepMax(x.entry))))} · ${hist.length} séance${hist.length > 1 ? "s" : ""}`)),
          h("span.chevron", icon("chevron", 16)))
      )
    )
  );
}

const tile = (value, label, color) => h("div.tile", h("span.stat-value", { style: { color } }, value), h("span.caption", label));

function exerciseDetail(name, nav) {
  const hist = history(name);
  const points = [...hist].reverse().map((x) => ({ x: new Date(x.workout.startedAt), y: bestOneRepMax(x.entry) })).filter((p) => p.y > 0);
  const best = Math.max(0, ...points.map((p) => p.y));
  const maxWeight = Math.max(0, ...hist.flatMap((x) => x.entry.sets.map((s) => s.weight)));
  return h(
    "div.page",
    h("button.back-button", { onclick: () => nav.back() }, icon("back", 18), "Progrès"),
    h("header.large-title", h("h1", name)),
    h("section.card", h("div.card-title", "1RM estimé"), points.length > 1 ? lineChart(points, { format: (v) => `${Math.round(v)} kg` }) : h("p.footnote", "Il faut au moins deux séances pour tracer la courbe.")),
    h("h4.group-title", "Records"),
    h("div.group", row("1RM estimé", kg(best)), row("Charge max", kg(maxWeight)), row("Séances", hist.length)),
    h("h4.group-title", "Historique"),
    h("div.group", hist.map((x) => h("div.row", h("span.row-text.grow", h("span", formatDate(x.workout.startedAt, { day: "numeric", month: "short", year: "numeric" })), h("span.caption", x.entry.sets.map((s) => `${s.weight}×${s.reps}`).join("  "))))))
  );
}

const row = (label, value) => h("div.row", h("span.grow", label), h("span.secondary", value));

function weightsView(nav) {
  const list = [...getState().bodyWeights].sort((a, b) => b.date.localeCompare(a.date));
  const points = [...list].reverse().slice(-60).map((b) => ({ x: new Date(b.date), y: b.weight }));
  return h(
    "div.page",
    h("button.back-button", { onclick: () => nav.back() }, icon("back", 18), "Progrès"),
    h("header.large-title", h("h1", "Poids")),
    h("button.button.prominent", { onclick: addWeight }, icon("plus", 18), "Noter mon poids"),
    points.length > 1 && h("section.card", lineChart(points, { color: "var(--purple)", format: (v) => `${v.toFixed(1)} kg` })),
    h(
      "div.group",
      list.length === 0 && h("p.footnote.pad", "Aucune pesée pour l'instant."),
      list.map((b) =>
        h("div.row", h("span.grow", formatDate(b.date, { weekday: "short", day: "numeric", month: "long" })), h("span.secondary", kg(b.weight)),
          h("button.icon-button.danger", { "aria-label": "Supprimer cette pesée", onclick: () => update((s) => (s.bodyWeights = s.bodyWeights.filter((x) => x !== b))) }, icon("trash", 18)))
      )
    )
  );
}

function addWeight() {
  const last = [...getState().bodyWeights].sort((a, b) => b.date.localeCompare(a.date))[0];
  let value = last ? String(last.weight) : "";
  const close = sheet("Poids du jour", (closeSheet) =>
    h(
      "div.stack",
      h("div.group", h("input.field.big", { type: "number", inputmode: "decimal", step: "0.1", value, placeholder: "75,0", "aria-label": "Poids en kilos", oninput: (e) => (value = e.target.value) })),
      h("button.button.prominent", {
        onclick: () => {
          const weight = Number(String(value).replace(",", "."));
          if (!(weight > 20 && weight < 400)) return toast("Entre un poids valide");
          update((s) => s.bodyWeights.push({ date: iso(), weight }));
          closeSheet();
        },
      }, "Enregistrer")
    )
  );
  return close;
}
