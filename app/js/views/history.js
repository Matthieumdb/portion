// Historique tab: month calendar, finished workouts by month, and the workout detail (HistoryView.swift).
import { h, icon, section, cell, menu, alert, toast, swipe, emptyState, durationText, capitalized, fmtDate, monthYear, plural, localInput, textCell, card } from "../ui.js";
import { S, commit, silent } from "../store.js";
import {
  finishedWorkouts, mainMuscleGroup, workoutDuration, workoutSetCount, workoutVolume, exById, kindOf, SET_KINDS, entryBestSet, activeWorkout, repeatWorkout,
  newTemplate, newTemplateItem, invalidateHistory, startOfDay,
} from "../model.js";
import { openInTab } from "../nav.js";
import { muscleIcon, statTile, barBtn, kgText } from "./common.js";
import { shareFile } from "../backup.js";

export function historyRoot(ctx) {
  const workouts = finishedWorkouts();
  const sections = new Map();
  for (const w of workouts) {
    const d = new Date(w.startedAt);
    const key = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key).push(w);
  }
  ctx.local.month ??= monthStart(Date.now());
  return {
    title: "Historique",
    large: true,
    body: workouts.length
      ? [
          section({}, h("div.cell", { style: { display: "block" } }, calendar(ctx, new Set(workouts.map((w) => startOfDay(w.startedAt)))))),
          [...sections].map(([month, list]) =>
            section(
              { header: h("div.hstack", h("span.grow", capitalized(monthYear(month))), h("span", `${list.length} ${plural(list.length, "séance")}`)) },
              list.map((w) =>
                swipe(workoutRow(ctx, w), {
                  onDelete: () =>
                    commit(() => {
                      S.workouts = S.workouts.filter((x) => x !== w);
                      invalidateHistory();
                    }),
                })
              )
            )
          ),
        ]
      : emptyState("dumbbell", "Aucune séance", "Tes séances terminées apparaîtront ici."),
  };
}

const monthStart = (t) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

function workoutRow(ctx, w) {
  const meta = (name, text) => h("span.hstack", { style: { gap: "3px" } }, icon(name, 12), text);
  return cell({
    onClick: () => ctx.push(workoutDetail, { id: w.id }),
    chevron: true,
    lead: muscleIcon(mainMuscleGroup(w) || "fullBody", 40),
    labelNode: h(
      "div.cell-label",
      h("span.headline", w.title),
      h("span.subheadline.secondary", capitalized(fmtDate(w.startedAt, { weekday: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }))),
      h("span.caption.secondary.hstack", { style: { gap: "10px" } }, meta("timer", durationText(workoutDuration(w))), meta("stack", String(workoutSetCount(w))), meta("scale", kgText(workoutVolume(w))))
    ),
  });
}

/** Month grid with a dot on each training day. */
function calendar(ctx, days) {
  const month = ctx.local.month;
  const d0 = new Date(month);
  const daysIn = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
  const leading = (d0.getDay() + 6) % 7; // Monday first
  const cells = [...Array(leading).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(d0.getFullYear(), d0.getMonth(), i + 1).getTime())];
  const count = cells.filter((d) => d && days.has(d)).length;
  const today = startOfDay();
  const isCurrent = month === monthStart(Date.now());
  const shift = (n) => {
    ctx.local.month = new Date(d0.getFullYear(), d0.getMonth() + n, 1).getTime();
    ctx.refresh();
  };
  return h(
    "div.vstack",
    { style: { gap: "10px", padding: "4px 0" } },
    h(
      "div.hstack",
      h("span.headline", capitalized(monthYear(month))),
      h("span.subheadline.secondary", `· ${count} ${plural(count, "séance")}`),
      h("span.spacer"),
      h("button.icon-btn.accent", { type: "button", "aria-label": "Mois précédent", onclick: () => shift(-1) }, icon("back", 20)),
      h("button.icon-btn.accent", { type: "button", "aria-label": "Mois suivant", disabled: isCurrent, style: isCurrent ? { opacity: 0.3 } : null, onclick: () => shift(1) }, icon("chevron", 20))
    ),
    h(
      "div.cal",
      ["L", "M", "M", "J", "V", "S", "D"].map((s) => h("span.wd", s)),
      cells.map((d) => (d == null ? h("span") : h("span.d" + (days.has(d) ? ".on" : d === today ? ".today" : ""), String(new Date(d).getDate()))))
    )
  );
}

// MARK: Detail

export function workoutDetail(ctx) {
  const w = S.workouts.find((x) => x.id === ctx.props.id);
  if (!w) return { title: "Séance", body: emptyState("dumbbell", "Séance supprimée") };
  const options = () =>
    menu([
      { label: "Refaire cette séance", icon: "swap", onClick: () => repeat(w) },
      { label: "Enregistrer comme modèle", icon: "copy", onClick: () => saveTemplate(w) },
      { label: "Partager", icon: "share", onClick: () => shareWorkout(w) },
    ]);
  return {
    title: w.title,
    right: barBtn("", options, { iconName: "ellipsis", aria: "Options" }),
    body: [
      h(
        "div.vstack",
        { style: { gap: "12px", marginBottom: "22px" } },
        h("span.subheadline.secondary", capitalized(fmtDate(w.startedAt, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }))),
        h("div.grid3", statTile(durationText(workoutDuration(w)), "durée", "timer", "var(--orange)"), statTile(String(workoutSetCount(w)), "séries", "stack", "var(--blue)"), statTile(kgText(workoutVolume(w)), "volume", "scale", "var(--green)"))
      ),
      w.exercises.map((entry) => {
        const ex = exById(entry.exerciseId);
        let n = 0;
        return section(
          { header: h("div.hstack", { style: { gap: "8px", textTransform: "none", color: "var(--ink)" } }, ex && muscleIcon(ex.muscleGroup, 24), h("span.headline", ex?.name ?? "Exercice supprimé")) },
          entry.sets.map((s) => {
            const k = kindOf(s);
            if (k === "normal") n++;
            return h("div.cell", h("span.grow", { style: { color: k === "warmup" ? "var(--orange)" : "var(--secondary)" } }, k === "normal" ? `Série ${n}` : SET_KINDS[k].label), h("span.mono", `${kgText(s.weight)} × ${s.reps}`));
          })
        );
      }),
      section({ header: "Notes" }, textCell(w.notes, "Ressenti, douleurs, sommeil…", (v) => commit(() => (w.notes = v)), { multiline: true })),
      section(
        { header: "Horaires" },
        dateRow("Début", w.startedAt, (t) =>
          commit(() => {
            const len = (w.endedAt ?? t) - w.startedAt;
            w.startedAt = t;
            if (w.endedAt != null && w.endedAt < t) w.endedAt = t + Math.max(len, 0);
            invalidateHistory();
          })
        ),
        dateRow("Fin", w.endedAt ?? w.startedAt, (t) => commit(() => (w.endedAt = Math.max(t, w.startedAt))), w.startedAt)
      ),
    ],
  };
}

function dateRow(label, value, onChange, min) {
  const el = h("input.field.right", { type: "datetime-local", value: localInput(value), min: min != null ? localInput(min) : null, style: { maxWidth: "210px" } });
  el.addEventListener("change", () => {
    const t = new Date(el.value).getTime();
    if (Number.isFinite(t)) onChange(t);
  });
  return h("label.cell", h("span.grow", label), el);
}

function repeat(w) {
  if (activeWorkout()) return toast("Termine d'abord la séance en cours");
  commit(() => repeatWorkout(w));
  menu([{ label: "Aller à la séance", icon: "dumbbell", onClick: () => openInTab("workout") }], { title: "Séance démarrée", message: "Elle t'attend dans l'onglet Séance, avec les charges de cette fois-ci." });
}

function saveTemplate(w) {
  commit(() => {
    const t = newTemplate(w.title);
    for (const e of w.exercises) {
      if (!exById(e.exerciseId)) continue;
      const it = newTemplateItem(e.exerciseId);
      it.targetSets = Math.max(e.sets.length, 1);
      it.targetReps = e.targetReps ?? e.sets[0]?.reps ?? 10;
      it.minReps = e.minReps;
      it.restSeconds = e.restSeconds;
      it.notes = e.note;
      t.items.push(it);
    }
    S.templates.push(t);
  });
  alert("Modèle créé", `Retrouve « ${w.title} » dans l'onglet Séance.`);
}

/** Image to share: title, figures and the best set of each exercise (WorkoutShareCard). */
async function shareWorkout(w) {
  const scale = 3, W = 380;
  const rows = w.exercises.slice(0, 8);
  const H = 24 + 20 + 16 + 40 + 16 + 44 + 16 + 1 + 16 + rows.length * 28 + 24;
  const c = document.createElement("canvas");
  c.width = W * scale;
  c.height = H * scale;
  const g = c.getContext("2d");
  g.scale(scale, scale);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, W, H);
  const font = (size, weight = 400) => `${weight} ${size}px -apple-system, "SF Pro Text", system-ui, sans-serif`;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#007aff";
  let y = 24 + 15;
  g.font = font(15, 600);
  g.fillStyle = accent;
  g.fillText("Musculation", 24, y);
  g.font = font(15);
  g.fillStyle = "#8e8e93";
  g.textAlign = "right";
  g.fillText(fmtDate(w.startedAt, { day: "numeric", month: "short", year: "numeric" }), W - 24, y);
  g.textAlign = "left";
  y += 20 + 34;
  g.font = font(34, 700);
  g.fillStyle = "#000";
  g.fillText(w.title, 24, y, W - 48);
  y += 16 + 24;
  let x = 24;
  for (const [v, l] of [[durationText(workoutDuration(w)), "durée"], [String(workoutSetCount(w)), "séries"], [kgText(workoutVolume(w)), "volume"]]) {
    g.font = font(22, 700);
    g.fillStyle = "#000";
    g.fillText(v, x, y);
    const vw = g.measureText(v).width;
    g.font = font(12);
    g.fillStyle = "#8e8e93";
    g.fillText(l, x, y + 18);
    x += Math.max(vw, g.measureText(l).width) + 24;
  }
  y += 20 + 16;
  g.fillStyle = "#e5e5ea";
  g.fillRect(24, y, W - 48, 1);
  y += 16;
  for (const e of rows) {
    y += 20;
    g.font = font(15);
    g.fillStyle = "#000";
    g.fillText(exById(e.exerciseId)?.name ?? "Exercice", 24, y, W - 150);
    const best = entryBestSet(e);
    if (best) {
      g.fillStyle = "#8e8e93";
      g.textAlign = "right";
      g.fillText(`${kgText(best.weight)} × ${best.reps}`, W - 24, y);
      g.textAlign = "left";
    }
    y += 8;
  }
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  if (blob) shareFile(new File([blob], `${w.title.replace(/[\\/:*?"<>|]/g, "-")}.png`, { type: "image/png" }));
}
