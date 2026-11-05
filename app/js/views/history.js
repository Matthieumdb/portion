// Historique tab: finished workouts by month, and their detail.
import { h, icon, kg, formatDate, duration, confirmSheet } from "../ui.js";
import { getState, update } from "../store.js";
import { workoutVolume, isWarmup, workoutFromTemplate } from "../training.js";

export function historyTab(nav) {
  const workouts = [...getState().workouts].filter((w) => w.endedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (nav.detail) {
    const w = workouts.find((x) => x.startedAt === nav.detail);
    if (w) return detail(w, nav);
    nav.detail = null;
  }
  const months = new Map();
  for (const w of workouts) {
    const key = new Date(w.startedAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(w);
  }
  return h(
    "div.page",
    h("header.large-title", h("h1", "Historique")),
    workouts.length === 0 && h("section.card", h("p.footnote", "Tes séances terminées apparaîtront ici.")),
    [...months].map(([month, list]) =>
      h(
        "div",
        h("h4.group-title", month.charAt(0).toUpperCase() + month.slice(1)),
        h(
          "div.group",
          list.map((w) =>
            h(
              "button.row.row-button",
              { onclick: () => nav.open({ detail: w.startedAt }) },
              h("span.row-text.grow", h("span.headline", w.title), h("span.caption", `${formatDate(w.startedAt, { weekday: "short", day: "numeric", month: "short" })} · ${duration(new Date(w.endedAt) - new Date(w.startedAt))} · ${kg(workoutVolume(w))}`)),
              h("span.chevron", icon("chevron", 16))
            )
          )
        )
      )
    )
  );
}

function detail(w, nav) {
  return h(
    "div.page",
    h("button.back-button", { onclick: () => nav.back() }, icon("back", 18), "Historique"),
    h("header.large-title", h("p.subtitle", formatDate(w.startedAt)), h("h1", w.title)),
    h(
      "div.stats.card",
      stat(duration(new Date(w.endedAt) - new Date(w.startedAt)), "durée"),
      stat(w.exercises.reduce((t, e) => t + e.sets.length, 0), "séries"),
      stat(kg(workoutVolume(w)), "soulevés")
    ),
    w.exercises.map((e) =>
      h(
        "div",
        h("h4.group-title", e.exercise),
        h("div.group", e.sets.map((s, i) => h("div.row", h("span.caption.set-index", isWarmup(s) ? "É" : i + 1), h("span.grow", `${kg(s.weight)} × ${s.reps}`))))
      )
    ),
    h(
      "div.stack",
      h("button.button", {
        onclick: () => {
          const template = { name: w.title, items: w.exercises.map((e) => ({ exercise: e.exercise, targetSets: e.sets.filter((s) => !isWarmup(s)).length || 1, targetReps: e.targetReps || Math.max(...e.sets.map((s) => s.reps)), minReps: e.minReps, restSeconds: e.restSeconds })) };
          if (getState().active) return;
          update((s) => (s.active = workoutFromTemplate(template)));
          nav.goTo("workout");
        },
        disabled: !!getState().active,
      }, "Refaire cette séance"),
      h("button.button.destructive", {
        onclick: () => confirmSheet("Supprimer cette séance ?", null, "Supprimer", () => {
          update((s) => (s.workouts = s.workouts.filter((x) => x.startedAt !== w.startedAt)));
          nav.back();
        }),
      }, "Supprimer la séance")
    )
  );
}

const stat = (value, label) => h("div.stat", h("span.stat-value", value), h("span.caption", label));
