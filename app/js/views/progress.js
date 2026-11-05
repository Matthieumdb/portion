// Progrès tab: figures, recap, weekly bars, sets per muscle, body (weight, measurements, photos, journal), per exercise
// (ProgressionView, BodyWeightView, MeasurementsView, ProgressPhotosView, CheckInHistoryView, WeeklyRecapView).
import {
  h, icon, section, cell, card, swipe, emptyState, segmented, barChart, lineChart, hBarChart, num, int, rnd, capitalized, fmtDate, dateAbbrev, dayMonth, plural,
  localInput, menu, confirm, toast, input, parseNumber, iconTile, choose, textCell, gradient,
} from "../ui.js";
import { S, commit, dayKey, newId } from "../store.js";
import {
  finishedWorkouts, startOfWeek, addWeeks, workoutVolume, muscle, MUSCLE_IDS, historyOf, entryBest1RM, entryMaxWeight, entryVolume, entryBestSet, set1RM, entrySummary,
  exById, MEASUREMENTS, MEASUREMENT_IDS, lowerIsBetter, measurementText, POSES, hasFeelings, dateFromKey, contains,
} from "../model.js";
import { setsPerGroup, freshness, recoveryScore, scoreTint, recapWeek, makeRecap } from "../insights.js";
import { N, baseTargets, runAdjustment } from "../nutrition.js";
import { listPhotos, putPhoto, deletePhoto } from "../db.js";
import { barBtn, okBtn, cancelBtn, muscleIcon, statTile, statItem, primaryButton, kgText } from "./common.js";

const toT = (d) => (typeof d === "number" ? d : new Date(d).getTime());

export function progressRoot(ctx) {
  const workouts = finishedWorkouts();
  const week = startOfWeek();
  const thisWeek = workouts.filter((w) => w.startedAt >= week);
  const weeks = Array.from({ length: 12 }, (_, i) => addWeeks(week, i - 11));
  const counts = weeks.map((s) => workouts.filter((w) => w.startedAt >= s && w.startedAt < addWeeks(s, 1)).length);
  const labels = weeks.map((s, i) => {
    const d = new Date(s);
    const prev = i ? new Date(weeks[i - 1]) : null;
    return !prev || prev.getMonth() !== d.getMonth() ? d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "") : "";
  });
  const perMuscle = setsPerGroup(workouts, 7);
  const muscles = MUSCLE_IDS.filter((g) => perMuscle[g]);
  const trained = S.exercises.filter((e) => historyOf(e.id).length).sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
  const latest = [...S.bodyWeights].sort((a, b) => toT(b.date) - toT(a.date))[0];
  return {
    title: "Progrès",
    large: true,
    body: [
      h("div.grid2", { style: { marginBottom: "22px" } }, statTile(String(thisWeek.length), "séances cette semaine", "calendar", "var(--orange)"), statTile(kgText(thisWeek.reduce((a, w) => a + workoutVolume(w), 0)), "soulevés cette semaine", "scale", "var(--green)")),
      section({}, cell({ label: "Bilan de la semaine", lead: h("span.lead-icon.accent", icon("calendarCheck")), chevron: true, onClick: () => ctx.push(recapView, { weeksBack: 0 }) })),
      section({ header: "Séances par semaine" }, h("div.cell", { style: { display: "block", padding: "14px 16px 10px" } }, barChart(counts, { height: 150, labels, color: "var(--accent)" }))),
      section(
        { header: "Séries par muscle (7 jours)", footer: "Repère courant pour progresser : 10 à 20 séries par muscle et par semaine." },
        muscles.length ? muscles.map((g) => cell({ label: muscle(g).label, value: `${perMuscle[g]} séries` })) : h("div.cell.secondary", "Aucune série ces 7 derniers jours.")
      ),
      section(
        { header: "Corps" },
        cell({ label: "Mensurations", lead: h("span.lead-icon.accent", icon("ruler")), chevron: true, onClick: () => ctx.push(measurementsView) }),
        cell({ label: "Photos de progression", lead: h("span.lead-icon.accent", icon("photo")), chevron: true, onClick: () => ctx.push(photosView) }),
        cell({ label: "Journal et récupération", lead: h("span.lead-icon.accent", icon("heartText")), chevron: true, onClick: () => ctx.push(checkInHistory) }),
        latest
          ? cell({ label: kgText(latest.weight), value: dateAbbrev(toT(latest.date)), lead: h("span.lead-icon.accent", icon("scale")), chevron: true, onClick: () => ctx.push(bodyWeightView) })
          : cell({ label: "Ajouter une pesée", lead: h("span.lead-icon.accent", icon("scale")), chevron: true, onClick: () => ctx.push(bodyWeightView) })
      ),
      section(
        { header: "Par exercice" },
        trained.length
          ? trained.map((ex) => {
              const hist = historyOf(ex.id);
              const best = Math.max(0, ...hist.map((x) => entryBest1RM(x.entry)));
              return cell({ label: ex.name, sub: `1RM estimé : ${kgText(best)} · ${hist.length} ${plural(hist.length, "séance")}`, lead: muscleIcon(ex.muscleGroup, 32), chevron: true, onClick: () => ctx.push(exerciseProgress, { id: ex.id }) });
            })
          : h("div.cell.secondary", "Termine une séance pour voir ta progression.")
      ),
    ],
  };
}

const METRICS = [
  ["oneRepMax", "1RM estimé", entryBest1RM],
  ["maxWeight", "Charge max", entryMaxWeight],
  ["volume", "Volume", entryVolume],
];

export function exerciseProgress(ctx) {
  const ex = exById(ctx.props.id);
  if (!ex) return { title: "Exercice", body: emptyState("dumbbell", "Exercice supprimé") };
  const hist = historyOf(ex.id);
  ctx.local.metric ??= "oneRepMax";
  const metric = METRICS.find((m) => m[0] === ctx.local.metric);
  const points = [...hist].reverse().map((x) => ({ x: x.workout.startedAt, y: metric[2](x.entry) }));
  const bestSet = hist.map((x) => entryBestSet(x.entry)).filter(Boolean).reduce((b, s) => (!b || set1RM(s) > set1RM(b) ? s : b), null);
  return {
    title: ex.name,
    body: [
      section(
        {},
        h("div.cell", { style: { display: "block" } }, segmented(METRICS.map((m) => [m[0], m[1]]), ctx.local.metric, (v) => { ctx.local.metric = v; ctx.refresh(); }, { label: "Mesure" }), h("div", { style: { marginTop: "12px" } }, lineChart(points, { height: 220, format: (v) => num(v, 0) })))
      ),
      section(
        { header: "Records" },
        cell({ label: "1RM estimé", value: kgText(Math.max(0, ...hist.map((x) => entryBest1RM(x.entry)))) }),
        cell({ label: "Charge max", value: kgText(Math.max(0, ...hist.map((x) => entryMaxWeight(x.entry)))) }),
        bestSet && cell({ label: "Meilleure série", value: `${kgText(bestSet.weight)} × ${bestSet.reps}` }),
        cell({ label: "Séances", value: String(hist.length) })
      ),
      section({ header: "Historique" }, hist.map((x) => cell({ label: dateAbbrev(x.workout.startedAt), sub: entrySummary(x.entry) }))),
    ],
  };
}

// MARK: Body weight

export function bodyWeightView(ctx) {
  const entries = [...S.bodyWeights].sort((a, b) => toT(b.date) - toT(a.date));
  ctx.local.date ??= localInput(Date.now(), false);
  const add = () => {
    const v = ctx.local.weight;
    if (!(v > 0)) return;
    const [y, m, d] = ctx.local.date.split("-").map(Number);
    const date = new Date(y, m - 1, d, 12).getTime();
    commit(() => {
      S.bodyWeights.push({ id: newId(), date: Math.min(date, Date.now()), weight: v });
      runAdjustment();
    });
    ctx.local.weight = null;
    ctx.local.date = localInput(Date.now(), false);
    document.activeElement?.blur?.();
    toast("Pesée ajoutée");
  };
  const change = entries.length > 1 ? entries[0].weight - entries[entries.length - 1].weight : 0;
  const dateEl = h("input.field.right", { type: "date", value: ctx.local.date, max: localInput(Date.now(), false), style: { maxWidth: "170px" } });
  dateEl.addEventListener("change", () => (ctx.local.date = dateEl.value || localInput(Date.now(), false)));
  return {
    title: "Poids de corps",
    body: [
      entries.length > 1 &&
        section(
          {},
          h("div.cell", { style: { display: "block" } }, lineChart([...entries].reverse().map((e) => ({ x: toT(e.date), y: e.weight })), { height: 200 })),
          cell({ label: "Évolution", value: `${change >= 0 ? "+" : "−"}${kgText(Math.abs(change))}` })
        ),
      section(
        { header: "Nouvelle pesée" },
        h("label.cell", input({ type: "number", decimal: true, value: ctx.local.weight ?? "", placeholder: "Poids", attrs: { "data-fid": "bw-new" }, onInput: (v) => (ctx.local.weight = v), onCommit: (v) => { ctx.local.weight = v; ctx.refresh(); } }), h("span.secondary", "kg")),
        h("label.cell", h("span.grow", "Date"), dateEl),
        cell({ label: "Ajouter", action: true, onClick: add })
      ),
      section(
        { header: "Historique" },
        entries.map((e) => swipe(cell({ label: dateAbbrev(toT(e.date)), value: kgText(e.weight) }), { onDelete: () => commit(() => (S.bodyWeights = S.bodyWeights.filter((x) => x !== e))) }))
      ),
    ],
  };
}

// MARK: Measurements

const valuesOf = (kind) => S.measurements.filter((m) => m.kind === kind).sort((a, b) => toT(b.date) - toT(a.date));

export function measurementsView(ctx) {
  const addMenu = () => menu(MEASUREMENT_IDS.map((k) => ({ label: MEASUREMENTS[k].label, icon: MEASUREMENTS[k].icon, onClick: () => ctx.present(addMeasurement, { kind: k }, { detent: "medium" }) })));
  return {
    title: "Mensurations",
    large: true,
    right: barBtn("", addMenu, { iconName: "plus", aria: "Ajouter" }),
    body: section(
      { footer: "Mesure-toi le matin, au même endroit, une fois par semaine ou par mois. Glisse vers la droite pour ajouter une valeur." },
      MEASUREMENT_IDS.map((k) => {
        const values = valuesOf(k);
        const last = values[0];
        let trailing = h("span.secondary", "—");
        if (last) {
          const delta = values.length > 1 ? last.value - values[values.length - 1].value : null;
          const good = lowerIsBetter(k) ? delta <= 0 : delta >= 0;
          trailing = h(
            "div.vstack",
            { style: { alignItems: "flex-end", gap: "2px" } },
            h("span.headline.mono", measurementText(k, last.value)),
            delta != null && h("span.caption.mono", { style: { color: delta === 0 ? "var(--secondary)" : good ? "var(--green)" : "var(--orange)" } }, (delta > 0 ? "+" : "") + measurementText(k, delta))
          );
        }
        return swipe(
          cell({ label: MEASUREMENTS[k].label, sub: last ? dateAbbrev(toT(last.date)) : null, lead: iconTile(MEASUREMENTS[k].icon, "var(--teal)"), trailing, chevron: true, onClick: () => ctx.push(measurementDetail, { kind: k }) }),
          { leading: { label: "Ajouter", onClick: () => ctx.present(addMeasurement, { kind: k }, { detent: "medium" }) } }
        );
      })
    ),
  };
}

function addMeasurement(ctx) {
  const k = ctx.props.kind;
  const last = valuesOf(k)[0];
  ctx.local.date ??= localInput(Date.now(), false);
  const save = () => {
    const v = ctx.local.value;
    if (v > 0) {
      const [y, m, d] = ctx.local.date.split("-").map(Number);
      commit(() => S.measurements.push({ id: newId(), date: Math.min(new Date(y, m - 1, d, 12).getTime(), Date.now()), kind: k, value: v }));
    }
    ctx.close();
  };
  const dateEl = h("input.field.right", { type: "date", value: ctx.local.date, max: localInput(Date.now(), false), style: { maxWidth: "170px" } });
  dateEl.addEventListener("change", () => (ctx.local.date = dateEl.value || ctx.local.date));
  const field = input({ type: "number", decimal: true, value: ctx.local.value ?? "", placeholder: last ? measurementText(k, last.value) : MEASUREMENTS[k].unit, cls: "field title2", attrs: { "data-fid": "meas-new", autofocus: true }, onInput: (v) => (ctx.local.value = v) });
  setTimeout(() => field.isConnected && document.activeElement !== field && field.focus(), 400);
  return {
    title: MEASUREMENTS[k].label,
    left: cancelBtn(ctx),
    right: barBtn("Ajouter", save, { bold: true }),
    body: section({}, h("label.cell", field, h("span.secondary", MEASUREMENTS[k].unit)), h("label.cell", h("span.grow", "Date"), dateEl)),
  };
}

function measurementDetail(ctx) {
  const k = ctx.props.kind;
  const values = valuesOf(k);
  return {
    title: MEASUREMENTS[k].label,
    large: true,
    right: barBtn("", () => ctx.present(addMeasurement, { kind: k }, { detent: "medium" }), { iconName: "plus", aria: "Ajouter" }),
    body: [
      values.length > 1 && section({}, h("div.cell", { style: { display: "block" } }, lineChart([...values].reverse().map((m) => ({ x: toT(m.date), y: m.value })), { height: 180, color: "var(--teal)" }))),
      section(
        {},
        values.length
          ? values.map((m) => swipe(cell({ label: dateAbbrev(toT(m.date)), value: measurementText(k, m.value) }), { onDelete: () => commit(() => (S.measurements = S.measurements.filter((x) => x !== m))) }))
          : h("div.cell.secondary", "Aucune mesure pour l'instant.")
      ),
    ],
  };
}

// MARK: Photos (kept in this browser only)

let photos = null; // cache [{id, date, pose, note, blob, thumb}]
const urls = new Map();
const urlOf = (blob, key) => {
  if (!urls.has(key)) urls.set(key, URL.createObjectURL(blob));
  return urls.get(key);
};
async function loadPhotos(ctx) {
  photos = (await listPhotos().catch(() => [])) || [];
  ctx.refresh();
}

async function downsample(file, max) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  let src = bmp;
  if (!src) {
    src = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = src.width, hgt = src.height;
  const k = Math.min(1, max / Math.max(w, hgt));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(hgt * k);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", 0.8));
}

export function photosView(ctx) {
  if (photos == null) loadPhotos(ctx);
  ctx.local.pose ??= "front";
  const pose = ctx.local.pose;
  const poseLabel = POSES.find((p) => p[0] === pose)[1];
  const shown = (photos || []).filter((p) => p.pose === pose).sort((a, b) => b.date - a.date);
  const pick = () => {
    const el = h("input", { type: "file", accept: "image/*", style: { display: "none" } });
    el.addEventListener("change", async () => {
      const file = el.files?.[0];
      el.remove();
      if (!file) return;
      ctx.local.loading = true;
      ctx.refresh();
      try {
        const [blob, thumb] = await Promise.all([downsample(file, 1600), downsample(file, 400)]);
        const p = { id: newId(), date: Date.now(), pose, note: "", blob, thumb };
        await putPhoto(p);
        photos.push(p);
      } catch {
        toast("Impossible de lire cette photo");
      }
      ctx.local.loading = false;
      ctx.refresh();
    });
    document.body.append(el);
    el.click();
  };
  return {
    title: "Photos",
    large: true,
    right: barBtn("", pick, { iconName: "plus", aria: "Ajouter une photo", disabled: ctx.local.loading }),
    body: [
      h("div", { style: { marginBottom: "16px" } }, segmented(POSES, pose, (v) => { ctx.local.pose = v; ctx.refresh(); }, { label: "Pose" })),
      ctx.local.loading && h("div.loading", "Chargement…"),
      photos == null
        ? null
        : !shown.length
        ? h("div", { style: { paddingTop: "40px" } }, emptyState("photo", `Aucune photo de ${poseLabel.toLowerCase()}`, "Prends-toi en photo toutes les 2 à 4 semaines, même lumière et même pose, pour voir les changements que le miroir ne montre pas."))
        : [
            shown.length >= 2 && h("button.btn.primary", { type: "button", style: { width: "100%", marginBottom: "16px" }, onclick: () => ctx.present(photoCompare, { pose }) }, icon("split"), "Comparer avant et après"),
            h(
              "div.photo-grid",
              shown.map((p) =>
                h("button.photo-thumb.press", { type: "button", "aria-label": `Photo du ${dateAbbrev(p.date)}`, onclick: () => ctx.push(photoDetail, { id: p.id }) }, h("img", { src: urlOf(p.thumb || p.blob, p.id + "t"), alt: "" }), h("span", fmtDate(p.date, { day: "numeric", month: "short", year: "2-digit" })))
              )
            ),
            h("p.footnote.secondary", { style: { marginTop: "16px" } }, "Tes photos restent dans ce navigateur : elles ne sont pas incluses dans le fichier de sauvegarde."),
          ],
    ],
  };
}

function photoDetail(ctx) {
  const p = (photos || []).find((x) => x.id === ctx.props.id);
  if (!p) return { title: "Photo", body: emptyState("photo", "Photo supprimée") };
  const save = () => putPhoto(p).catch(() => toast("Enregistrement impossible"));
  const dateEl = h("input.field.right", { type: "date", value: localInput(p.date, false), max: localInput(Date.now(), false), style: { maxWidth: "170px" } });
  dateEl.addEventListener("change", () => {
    const [y, m, d] = dateEl.value.split("-").map(Number);
    if (!y) return;
    p.date = new Date(y, m - 1, d, 12).getTime();
    save();
    ctx.refresh();
  });
  return {
    title: dateAbbrev(p.date),
    body: [
      h("div", { style: { marginBottom: "22px" } }, h("img", { src: urlOf(p.blob, p.id), alt: "Photo de progression", style: { width: "100%", borderRadius: "12px", display: "block" } })),
      section(
        {},
        h("label.cell", h("span.grow", "Date"), dateEl),
        h("label.cell", h("span.grow", "Pose"), h("span", segmented(POSES, p.pose, (v) => { p.pose = v; save(); ctx.refresh(); }))),
        textCell(p.note, "Note (poids, forme…)", (v) => { p.note = v; save(); }, { multiline: true })
      ),
      section(
        {},
        cell({
          label: "Supprimer la photo",
          destructive: true,
          onClick: () =>
            confirm("Supprimer cette photo ?", null, "Supprimer", async () => {
              await deletePhoto(p.id).catch(() => {});
              photos = photos.filter((x) => x !== p);
              ctx.pop();
            }),
        })
      ),
    ],
  };
}

function photoCompare(ctx) {
  const list = (photos || []).filter((p) => p.pose === ctx.props.pose).sort((a, b) => b.date - a.date);
  const before = list.find((p) => p.id === ctx.local.before) || list[list.length - 1];
  const after = list.find((p) => p.id === ctx.local.after) || list[0];
  ctx.local.split ??= 0.5;
  if (!before || !after) return { title: "Avant / après", right: okBtn(ctx), body: null };
  const top = h("img", { src: urlOf(before.blob, before.id), alt: "" });
  const handle = h("div.handle", h("div.knob", icon("swap", 20)));
  const box = h("div.compare", { role: "slider", tabindex: 0, "aria-label": "Comparaison avant et après", "aria-valuemin": 0, "aria-valuemax": 100 }, h("img", { src: urlOf(after.blob, after.id), alt: "" }), top, handle);
  const set = (v) => {
    ctx.local.split = Math.min(1, Math.max(0, v));
    top.style.clipPath = `inset(0 ${(1 - ctx.local.split) * 100}% 0 0)`;
    handle.style.left = ctx.local.split * 100 + "%";
    box.setAttribute("aria-valuenow", rnd(ctx.local.split * 100));
    box.setAttribute("aria-valuetext", `${rnd(ctx.local.split * 100)} % avant`);
  };
  set(ctx.local.split);
  const move = (e) => {
    const r = box.getBoundingClientRect();
    set((e.clientX - r.left) / r.width);
  };
  box.addEventListener("pointerdown", (e) => {
    box.setPointerCapture(e.pointerId);
    move(e);
  });
  box.addEventListener("pointermove", (e) => e.buttons && move(e));
  box.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") set(ctx.local.split + 0.1);
    if (e.key === "ArrowLeft") set(ctx.local.split - 0.1);
  });
  const chooser = (title, current, key) =>
    h(
      "button.vstack",
      { type: "button", style: { alignItems: "flex-start", gap: "2px" }, onclick: () => choose(title, list.map((p) => [p.id, dateAbbrev(p.date)]), current.id, (v) => { ctx.local[key] = v; ctx.refresh(); }) },
      h("span.caption.secondary", title),
      h("span.subheadline.semibold.accent.hstack", { style: { gap: "4px" } }, dateAbbrev(current.date), icon("chevronUpDown", 14))
    );
  return {
    title: "Avant / après",
    right: okBtn(ctx),
    body: h("div.vstack", { style: { gap: "16px" } }, box, h("div.hstack", chooser("Avant", before, "before"), h("span.spacer"), chooser("Après", after, "after"))),
  };
}

// MARK: Journal

export function checkInHistory(ctx) {
  const workouts = finishedWorkouts();
  const days = [...S.checkIns]
    .filter(hasFeelings)
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, 60)
    .map((entry) => ({ entry, score: recoveryScore(entry, freshness(workouts, dateFromKey(entry.day) + 9 * 3_600_000)) }));
  const compare = (text, test) => {
    const yes = days.filter((d) => test(d.entry) === true).map((d) => d.score.value);
    const no = days.filter((d) => test(d.entry) === false).map((d) => d.score.value);
    if (yes.length < 3 || no.length < 3) return null;
    const avg = (l) => Math.trunc(l.reduce((a, b) => a + b, 0) / l.length);
    return { text, delta: avg(yes) - avg(no) };
  };
  const insights = [
    compare("Dormir 7 h ou plus", (e) => (e.sleepHours == null ? null : e.sleepHours >= 7)),
    compare("Boire de l'alcool la veille", (e) => e.alcohol > 0),
    compare("Boire au moins 6 verres d'eau", (e) => e.water >= 6),
    compare("Plus de 2 cafés", (e) => e.caffeine > 2),
  ].filter(Boolean);
  const summary = (e) => {
    const parts = [];
    if (e.sleepHours != null) parts.push(`${num(e.sleepHours, 1)} h de sommeil`);
    if (e.water > 0) parts.push(`${e.water} verres d'eau`);
    if (e.alcohol > 0) parts.push("alcool");
    if (e.note) parts.push(e.note);
    return parts.join(" · ");
  };
  return {
    title: "Journal",
    large: true,
    body: [
      insights.length > 0 &&
        section(
          { header: "Ce qui compte pour toi", footer: "Écart de score moyen, d'après tes propres journées." },
          insights.map((i) => cell({ label: i.text, lead: h("span.subheadline.bold.mono", { style: { color: i.delta >= 0 ? "var(--green)" : "var(--red)", minWidth: "32px" } }, `${i.delta > 0 ? "+" : ""}${i.delta}`) }))
        ),
      section(
        { header: "Journées" },
        days.length
          ? days.map((d) =>
              cell({
                label: capitalized(fmtDate(dateFromKey(d.entry.day), { weekday: "long", day: "numeric", month: "long" })),
                sub: summary(d.entry) || null,
                lead: h("span.headline.mono", { style: { width: "40px", height: "40px", borderRadius: "50%", background: gradient(scoreTint(d.score.value)), color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" } }, String(d.score.value)),
              })
            )
          : h("div.cell.secondary", "Fais le point chaque matin depuis l'onglet Séance : ton historique apparaîtra ici.")
      ),
    ],
  };
}

// MARK: Weekly recap

export function recapView(ctx) {
  ctx.local.weeksBack ??= ctx.props.weeksBack || 0;
  const back = ctx.local.weeksBack;
  const week = recapWeek(addWeeks(Date.now(), -back));
  const n = N();
  const t = baseTargets(n.settings);
  const r = makeRecap(week, { workouts: S.workouts, logs: n.logs, targets: { kcal: t.kcal, p: t.p }, weights: S.bodyWeights, checkIns: S.checkIns });
  const title = back === 0 ? "Cette semaine" : back === 1 ? "La semaine dernière" : `Du ${dayMonth(week.start)} au ${dayMonth(week.end - 1)}`;
  const shift = (d) => {
    ctx.local.weeksBack = Math.max(0, back + d);
    ctx.refresh();
  };
  const comparison = (value, previous, unit) => {
    if (!(previous > 0)) return null;
    const change = unit === "%" ? (value / previous - 1) * 100 : value - previous;
    const k = rnd(change);
    if (k === 0) return "comme la semaine d'avant";
    return `${k > 0 ? "+" : "−"}${Math.abs(k)}${unit ? " " + unit : ""} vs semaine d'avant`;
  };
  const dur = (ms) => {
    const m = int(ms / 60000);
    return m >= 60 ? `${int(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
  };
  const figure = (value, label, delta, tint) => h("div.vstack", { style: { gap: "2px", minWidth: 0 } }, h("span.display.ellipsis", { style: { fontSize: "24px", color: tint } }, value), h("span.caption.secondary", label), delta && h("span.caption2.semibold.secondary", delta));
  return {
    title: "Bilan de la semaine",
    right: [
      barBtn("", () => shift(1), { iconName: "back", aria: "Semaine précédente" }),
      barBtn("", () => shift(-1), { iconName: "chevron", aria: "Semaine suivante", disabled: back === 0 }),
    ],
    body: [
      section({}, h("div.cell", { style: { display: "block" } }, h("div.subheadline.semibold.secondary", title), h("div.display", { style: { fontSize: "26px", marginTop: "6px" } }, r.headline))),
      section(
        { header: "Entraînement" },
        h(
          "div.cell",
          { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } },
          figure(String(r.workouts), plural(r.workouts, "séance"), comparison(r.workouts, r.previousWorkouts, ""), "var(--orange)"),
          figure(kgText(r.volume), "soulevés", comparison(r.volume, r.previousVolume, "%"), "var(--green)"),
          figure(dur(r.duration), "d'entraînement", null, "var(--blue)"),
          figure(String(r.sets), "séries", null, "var(--purple)")
        )
      ),
      r.records.length > 0 &&
        section(
          { header: "Records" },
          r.records.map((rec) =>
            cell({
              label: rec.exercise,
              sub: `1RM estimé ${kgText(rec.oneRepMax)}, avant ${kgText(rec.previous)}`,
              lead: h("span", { style: { color: "var(--yellow)" } }, icon("trophy")),
              trailing: h("span.subheadline.semibold.mono", { style: { color: "var(--green)" } }, `+${rnd((rec.oneRepMax / rec.previous - 1) * 100)} %`),
            })
          )
        ),
      r.muscles.length > 0 &&
        section(
          { header: "Séries par muscle", footer: "Entre 10 et 20 séries par muscle et par semaine suffisent pour progresser." },
          h("div.cell", { style: { display: "block" } }, hBarChart(r.muscles.map((m) => ({ label: muscle(m.group).label, value: m.sets, color: muscle(m.group).color }))))
        ),
      section(
        { header: "Alimentation", footer: r.loggedDays > 0 ? `Moyenne sur ${r.loggedDays} jour${r.loggedDays > 1 ? "s" : ""} noté${r.loggedDays > 1 ? "s" : ""}.` : null },
        r.averageKcal != null
          ? [cell({ label: "Calories par jour", value: `${rnd(r.averageKcal)} / ${rnd(r.targetKcal)} kcal` }), cell({ label: "Protéines par jour", value: `${rnd(r.averageProtein)} / ${rnd(r.targetProtein)} g` })]
          : h("div.cell.secondary", "Aucun repas noté cette semaine."),
        r.averageWater != null && cell({ label: "Eau par jour", value: `${num(r.averageWater, 1)} verres` })
      ),
      (r.weightEnd != null || r.averageSleep != null) &&
        section(
          { header: "Corps et récupération" },
          r.weightEnd != null &&
            cell({ label: "Poids", value: h("span", kgText(r.weightEnd), r.weightStart != null && Math.abs(r.weightEnd - r.weightStart) >= 0.05 && h("span.secondary", { style: { marginLeft: "6px" } }, `${r.weightEnd > r.weightStart ? "+" : "−"}${num(Math.abs(r.weightEnd - r.weightStart), 1, 1)} kg`)) }),
          r.averageSleep != null && cell({ label: "Sommeil moyen", value: `${num(r.averageSleep, 1)} h` })
        ),
    ],
  };
}
