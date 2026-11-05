// Exercise picker, library, library detail, replacement, exercise list and editor, plate calculator.
import { h, icon, section, cell, searchField, emptyState, choose, toast, picker, input, textCell, num, kgPrecise, confirm, swipe, chev } from "../ui.js";
import { S, commit } from "../store.js";
import {
  LIB, MUSCLES, MUSCLE_IDS, exerciseSections, libEntry, libMatches, libMuscleGroup, libMuscleLabel, libEquipmentLabel, libLevelLabel, libPrimaryLabel,
  libInstructions, LIB_MUSCLES, LIB_EQUIPMENTS, newExercise, contains, EQUIPMENT, STEP_OPTIONS, inferEquipment, equipmentOf, BAR_OPTIONS, deleteExercise, muscle,
} from "../model.js";
import { barBtn, okBtn, cancelBtn, exerciseIcon, muscleIcon, thumb, exerciseAnimation, primaryButton } from "./common.js";

const addFromLibrary = (entry) => {
  const ex = newExercise(entry.nameFR, libMuscleGroup(entry), { libraryId: entry.id });
  S.exercises.push(ex);
  return ex;
};
const existingFor = (entry) => S.exercises.find((e) => e.libraryId === entry.id) || S.exercises.find((e) => libEntry(e)?.id === entry.id);

// MARK: Picker (sheet)

export function exercisePicker(ctx) {
  const { onPick } = ctx.props;
  ctx.local.search ??= "";
  const list = h("div");
  const fill = () => {
    const q = ctx.local.search;
    const sections = exerciseSections(q);
    list.replaceChildren(
      section({}, cell({ lead: h("span.lead-icon", icon("books")), label: q ? `Chercher « ${q} » dans la bibliothèque` : "Chercher dans la bibliothèque", chevron: true, cls: "action", onClick: () => ctx.push(libraryScreen, { initialSearch: q, onPick: (ex) => { onPick(ex); ctx.close(); } }) })),
      ...sections.map((s) =>
        section({ header: MUSCLES[s.group].label }, ...s.exercises.map((ex) => cell({ lead: exerciseIcon(ex, 32), label: ex.name, trailing: h("span.accent", icon("plus", 22)), onClick: () => { onPick(ex); ctx.close(); } })))
      ),
      !sections.length && q ? emptyState("search", `Aucun résultat pour « ${q} »`, "Cherche dans la bibliothèque.") : null
    );
  };
  fill();
  return {
    title: "Choisir un exercice",
    left: cancelBtn(ctx),
    search: searchField(ctx.local.search, "Rechercher", (v) => { ctx.local.search = v; fill(); }),
    body: list,
  };
}

// MARK: Library

export function libraryScreen(ctx) {
  const { onPick } = ctx.props;
  ctx.local.search ??= ctx.props.initialSearch || "";
  const L = ctx.local;
  const results = h("div");
  const count = h("div.section-footer");
  const fill = () => {
    const r = LIB.all.filter((e) => libMatches(e, L.search) && (!L.muscle || e.primary.includes(L.muscle)) && (!L.equipment || e.equipment === L.equipment));
    count.textContent = `${r.length} exercice${r.length > 1 ? "s" : ""}`;
    const rows = r.slice(0, L.limit || 120).map((e) => cell({ lead: thumb(e, 44), labelNode: h("div.cell-label", h("span.clamp2", e.nameFR), h("span.caption.secondary.ellipsis", `${libPrimaryLabel(e)} · ${libEquipmentLabel(e.equipment)}`)), chevron: true, onClick: () => ctx.push(libraryDetail, { entry: e, onPick }) }));
    results.replaceChildren(
      r.length ? h("div.list-group", rows) : emptyState("search", L.search ? `Aucun résultat pour « ${L.search} »` : "Aucun résultat", "Vérifie l'orthographe ou essaie une autre recherche."),
      r.length > (L.limit || 120) ? h("button.text-btn", { type: "button", style: { margin: "10px auto", display: "flex" }, onclick: () => { L.limit = (L.limit || 120) + 200; fill(); } }, `Afficher plus (${r.length - (L.limit || 120)})`) : null
    );
  };
  const filter = (title, active, options, label, key) =>
    h("button.chip.small" + (active ? ".on" : ""), { type: "button", onclick: () => choose(title, [[null, "Tous"], ...options.map((o) => [o, label(o)])], L[key], (v) => { L[key] = v; ctx.refresh(); }) }, active ? label(L[key]) : title, icon("chevronDown"));
  fill();
  const search = searchField(L.search, "Squat, curl, poulie…", (v) => { L.search = v; fill(); });
  const filters = h(
    "div",
    h("div.scroll-x", { style: { padding: "2px 16px 6px" } },
      filter("Muscle", !!L.muscle, LIB_MUSCLES, libMuscleLabel, "muscle"),
      filter("Matériel", !!L.equipment, LIB_EQUIPMENTS, libEquipmentLabel, "equipment"),
      (L.muscle || L.equipment) && h("button.text-btn", { type: "button", onclick: () => { L.muscle = null; L.equipment = null; ctx.refresh(); } }, "Effacer")
    ),
    count
  );
  return {
    title: "Bibliothèque",
    large: !ctx.isSheet,
    search: ctx.isSheet ? search : null,
    body: [ctx.isSheet ? null : search, filters, results],
  };
}

export function libraryDetail(ctx) {
  const { entry, onPick, showsAddButton = true, pickLabel, pickIcon } = ctx.props;
  const tags = [libPrimaryLabel(entry), libEquipmentLabel(entry.equipment), libLevelLabel(entry.level)];
  if (entry.mechanic) tags.push(entry.mechanic === "compound" ? "Polyarticulaire" : "Isolation");
  const existing = existingFor(entry);
  let bottom = null;
  if (onPick) bottom = primaryButton(pickLabel || "Ajouter à la séance", () => onPick(existingFor(entry) || addFromLibrary(entry)), pickIcon || "plus");
  else if (showsAddButton) {
    bottom = existing
      ? h("div.btn.glass", { style: { color: "var(--green-ink)" } }, icon("checkCircle"), ctx.local.added ? "Ajouté à tes exercices" : "Déjà dans tes exercices")
      : primaryButton("Ajouter à mes exercices", () => commit(() => { addFromLibrary(entry); ctx.local.added = true; }), "plus");
  }
  return {
    title: entry.nameFR,
    right: ctx.isSheet && ctx.depth === 0 ? okBtn(ctx) : null,
    bottom,
    body: [
      exerciseAnimation(entry),
      h("div.vstack.gap6", h("h2.title2", entry.nameFR), h("span.subheadline.secondary", entry.name)),
      h("div.hstack.wrap.gap6", tags.map((t) => h("span.chip.small", { style: { background: "var(--card)" } }, t))),
      h(
        "div.card",
        h("div.hstack", h("span.headline.grow", "Exécution"), !entry.instructionsFR && h("span.caption.secondary", "en anglais")),
        libInstructions(entry).map((step, i) => h("div.hstack.top.gap12", h("span", { style: { width: "22px", height: "22px", borderRadius: "50%", background: "linear-gradient(180deg, var(--accent-2), var(--accent))", color: "#fff", fontSize: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" } }, i + 1), h("span.callout", step)))
      ),
      entry.secondary.length ? h("div.card", h("span.headline", "Muscles secondaires"), h("span.callout.secondary", entry.secondary.map(libMuscleLabel).join(", "))) : null,
      h("p.caption2.tertiary", "Illustrations : Free Exercise DB (domaine public)."),
    ],
  };
}

/** Library detail opened on its own (from a workout or the coach). */
export function demoSheet(ctx) {
  return libraryDetail({ ...ctx, props: { ...ctx.props, showsAddButton: false } });
}

// MARK: Replace

const EQUIPMENT_FILTERS = ["barbell", "dumbbell", "machine", "cable", "body only"];

export function replaceExercise(ctx) {
  const { current, onPick } = ctx.props;
  const L = ctx.local;
  L.search ??= "";
  const currentEntry = libEntry(current);
  const muscles = currentEntry?.primary[0]
    ? [currentEntry.primary[0]]
    : { chest: ["chest"], back: ["lats", "middle back"], shoulders: ["shoulders"], biceps: ["biceps"], triceps: ["triceps"], legs: ["quadriceps", "hamstrings"], glutes: ["glutes"], abs: ["abdominals"] }[current.muscleGroup] || [];
  const muscleTitle = muscles.length ? muscles.map(libMuscleLabel).join(", ") : muscle(current.muscleGroup).label;
  const passes = (e) => !L.equipment || (L.equipment === "barbell" ? e.equipment === "barbell" || e.equipment === "e-z curl bar" : e.equipment === L.equipment);
  const pick = (ex) => {
    ctx.close();
    onPick(ex);
  };
  const list = h("div");
  const fill = () => {
    const mine = S.exercises
      .filter((e) => e.id !== current.id)
      .filter((e) => {
        const en = libEntry(e);
        if (en) return muscles.some((m) => en.primary.includes(m)) && passes(en);
        return e.muscleGroup === current.muscleGroup && !L.equipment;
      })
      .filter((e) => !L.search || contains(e.name, L.search))
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
    const taken = new Set(S.exercises.map((e) => libEntry(e)?.id).filter(Boolean));
    const mech = currentEntry?.mechanic;
    const levels = { beginner: 0, intermediate: 1, expert: 2 };
    const lib = LIB.all
      .filter((e) => !taken.has(e.id) && muscles.some((m) => e.primary.includes(m)) && passes(e) && libMatches(e, L.search))
      .sort((a, b) => {
        const as = a.mechanic === mech, bs = b.mechanic === mech;
        if (as !== bs) return as ? -1 : 1;
        const al = levels[a.level] ?? 3, bl = levels[b.level] ?? 3;
        if (al !== bl) return al - bl;
        return a.nameFR.localeCompare(b.nameFR, "fr", { numeric: true });
      });
    const row = (title, subtitle, entry, fallback, action) =>
      h(
        "div.cell",
        entry ? h("button.press", { type: "button", "aria-label": "Voir l'exécution", onclick: () => ctx.push(libraryDetail, { entry, onPick: () => pickEntry(entry), pickLabel: "Choisir cet exercice", pickIcon: "swap" }) }, thumb(entry, 40)) : muscleIcon(fallback, 40),
        h("button.hstack.grow", { type: "button", onclick: action, style: { textAlign: "left" } }, h("div.cell-label", h("span", title), h("span.caption.secondary", subtitle)), h("span.accent", icon("swap", 20)))
      );
    const pickEntry = (entry) => {
      commit(() => {});
      pick(existingFor(entry) || addFromLibrary(entry));
    };
    list.replaceChildren(
      mine.length ? section({ header: "Tes exercices" }, ...mine.map((e) => { const en = libEntry(e); return row(e.name, en ? libEquipmentLabel(en.equipment) : EQUIPMENT[equipmentOf(e)].label.replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()), en, e.muscleGroup, () => pick(e)); })) : null,
      lib.length ? section({ header: "Bibliothèque" }, ...lib.slice(0, 150).map((e) => row(e.nameFR, `${libEquipmentLabel(e.equipment)} · ${libLevelLabel(e.level)}`, e, libMuscleGroup(e), () => pickEntry(e)))) : null,
      !mine.length && !lib.length ? emptyState("swap", "Aucune variante", "Essaie un autre matériel ou une autre recherche.") : null
    );
  };
  fill();
  const chip = (title, on, fn) => h("button.chip.small" + (on ? ".on" : ""), { type: "button", style: on ? null : { background: "var(--card)" }, onclick: fn }, title);
  return {
    title: `Remplacer ${current.name}`,
    left: cancelBtn(ctx),
    search: searchField(L.search, "Rechercher", (v) => { L.search = v; fill(); }),
    body: [
      h("div.section-header.plain", `Même muscle : ${muscleTitle}`),
      h("div.scroll-x", { style: { marginBottom: "14px" } }, chip("Tout", !L.equipment, () => { L.equipment = null; ctx.refresh(); }), EQUIPMENT_FILTERS.map((o) => chip(libEquipmentLabel(o), L.equipment === o, () => { L.equipment = L.equipment === o ? null : o; ctx.refresh(); }))),
      list,
    ],
  };
}

// MARK: Exercise list (Réglages)

export function exerciseList(ctx) {
  ctx.local.search ??= "";
  const list = h("div");
  const fill = () => {
    const q = ctx.local.search;
    const sections = exerciseSections(q);
    list.replaceChildren(
      !q ? section({}, cell({ lead: h("span.icon-tile", { style: { width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(180deg, var(--accent-2), var(--accent))" } }, icon("books")), labelNode: h("div.cell-label", h("span.headline", "Bibliothèque"), h("span.caption.secondary", `${LIB.all.length} exercices illustrés et animés`)), chevron: true, onClick: () => ctx.push(libraryScreen, {}) })) : null,
      ...sections.map((s) =>
        section(
          { header: MUSCLES[s.group].label },
          ...s.exercises.map((ex) =>
            swipe(cell({ lead: exerciseIcon(ex, 32), labelNode: h("div.cell-label", h("span", ex.name), ex.notes && h("span.caption.secondary.ellipsis", ex.notes)), onClick: () => ctx.present(exerciseEdit, { exercise: ex }) }), {
              onDelete: () => confirm(`Supprimer ${ex.name} ?`, "Tes séances passées sont conservées.", "Supprimer", () => commit(() => deleteExercise(ex))),
            })
          )
        )
      ),
      !sections.length && q ? emptyState("search", `Aucun résultat pour « ${q} »`, null) : null
    );
  };
  fill();
  return {
    title: "Exercices",
    large: true,
    right: barBtn("", () => menuAdd(ctx), { iconName: "plus", aria: "Ajouter" }),
    body: [searchField(ctx.local.search, "Rechercher", (v) => { ctx.local.search = v; fill(); }), h("div", { style: { height: "8px" } }), list],
  };
}
function menuAdd(ctx) {
  import("../ui.js").then(({ menu }) =>
    menu([
      { label: "Depuis la bibliothèque", icon: "books", onClick: () => ctx.push(libraryScreen, {}) },
      { label: "Exercice personnalisé", icon: "edit", onClick: () => ctx.present(exerciseEdit, { exercise: null }) },
    ])
  );
}

export function exerciseEdit(ctx) {
  const ex = ctx.props.exercise;
  const L = ctx.local;
  if (!L.init) Object.assign(L, { init: true, name: ex?.name ?? "", muscleGroup: ex?.muscleGroup ?? "chest", notes: ex?.notes ?? "", weightStep: ex?.weightStep ?? null });
  const entry = ex && libEntry(ex);
  const inferred = inferEquipment(L.name);
  const trimmed = () => L.name.trim();
  const save = () => {
    if (!trimmed()) return;
    commit(() => {
      if (ex) Object.assign(ex, { name: trimmed(), muscleGroup: L.muscleGroup, notes: L.notes, weightStep: L.weightStep });
      else S.exercises.push(newExercise(trimmed(), L.muscleGroup, { notes: L.notes, weightStep: L.weightStep }));
    });
    ctx.close();
  };
  const nameInput = input({ value: L.name, placeholder: "Nom de l'exercice", onInput: (v) => { L.name = v; saveBtn.disabled = !v.trim(); } });
  const saveBtn = barBtn("Enregistrer", save, { bold: true, disabled: !trimmed() });
  return {
    title: ex ? "Modifier" : "Nouvel exercice",
    left: cancelBtn(ctx),
    right: saveBtn,
    body: [
      entry ? section({}, h("div", { style: { padding: "0" } }, exerciseAnimation(entry)), cell({ label: "Voir l'exécution", chevron: true, cls: "action", onClick: () => ctx.push(libraryDetail, { entry, showsAddButton: false }) })) : null,
      section({}, h("label.cell", nameInput), h("label.cell", h("span.grow", "Groupe musculaire"), picker(MUSCLE_IDS.map((g) => [g, MUSCLES[g].label]), L.muscleGroup, (v) => { L.muscleGroup = v; ctx.refresh(); }))),
      section(
        { header: "Progression", footer: `Le plus petit poids que tu peux ajouter sur cet exercice. Quand tu atteins le haut de ta fourchette de reps, l'app ajoute environ ${num(S.settings.progressionPercent, 1)} % de la charge, arrondi à ce saut (au moins un saut).` },
        h("label.cell", h("span.grow", "Saut de charge"), picker([["", `Auto : ${kgPrecise(EQUIPMENT[inferred].step)} (${EQUIPMENT[inferred].label})`], ...STEP_OPTIONS.map((s) => [String(s), kgPrecise(s)])], L.weightStep == null ? "" : String(L.weightStep), (v) => { L.weightStep = v === "" ? null : Number(v); ctx.refresh(); }))
      ),
      section({ header: "Notes", footer: ex ? "Supprimer un exercice (glisser dans la liste) conserve tes séances passées." : null }, textCell(L.notes, "Réglages machine, consignes…", (v) => (L.notes = v), { multiline: true, attrs: { oninput: (e) => (L.notes = e.target.value) } })),
    ],
  };
}

// MARK: Plate calculator

const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const PLATE_COLORS = { 25: "var(--red)", 20: "var(--blue)", 15: "var(--yellow)", 10: "var(--green)", 5: "#fff" };

export function plateCalculator(ctx) {
  const L = ctx.local;
  L.target ??= ctx.props.target ?? 60;
  const bar = S.settings.barWeight;
  const result = h("div");
  const fill = () => result.replaceChildren(plateList(L.target, bar));
  fill();
  return {
    title: "Calculateur de disques",
    right: okBtn(ctx),
    body: [
      section(
        {},
        h("label.cell", h("span.grow", "Charge totale"), input({ type: "number", decimal: true, value: L.target, cls: "field right", attrs: { style: "max-width:90px", "data-fid": "plate-target" }, onInput: (v) => { L.target = v ?? 0; fill(); } }), h("span.secondary", "kg")),
        h("label.cell", h("span.grow", "Barre"), picker(BAR_OPTIONS.map((w) => [w, w === 0 ? "Sans barre" : `${num(w, 1)} kg`]), bar, (v) => commit((s) => (s.settings.barWeight = Number(v)))))
      ),
      result,
    ],
  };
}

function plateList(target, bar) {
  let remaining = Math.max(0, (target - bar) / 2);
  const counts = [];
  for (const p of PLATES) {
    const c = Math.trunc((remaining + 0.001) / p);
    if (c > 0) {
      counts.push([p, c]);
      remaining -= c * p;
    }
  }
  const missing = remaining * 2;
  return section(
    { header: "De chaque côté" },
    !counts.length ? cell({ label: h("span.secondary", target > 0 ? "Barre seule" : "Entre une charge") }) : null,
    ...counts.map(([p, c]) => h("div.cell", h("span", { style: { width: "18px", height: "18px", borderRadius: "50%", background: PLATE_COLORS[p] || "var(--gray)", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,.25)", flex: "none" } }), h("span.grow", `${num(p, 2)} kg`), h("span.headline.mono", `× ${c}`))),
    missing > 0.01 ? h("div.cell", h("span.footnote", { style: { color: "var(--orange)" } }, `Impossible de faire le compte exact : il reste ${num(missing, 1)} kg.`)) : null
  );
}
