// Nutrition tab: Aujourd'hui, Courses, Recettes, Bilan, plus settings, food search and barcode scanner
// (NutritionView, TodayPage, GroceriesPage, RecipesPage, NutritionStatsPage, NutritionSettingsView, FoodSearchView, BarcodeScannerView).
import {
  h, icon, card, cardTitle, section, cell, ring, progressBar, segmented, menu, choose, confirm, alert, prompt, toast, haptic, input, parseNumber, num, int, rnd,
  capitalized, fmtDate, plural, stepper, toggleCell, pickerCell, picker, numberCell, searchField, longPress, swipe, emptyState, inlineError, barChart, lineChart, disclosure, s as svg,
} from "../ui.js";
import { S, commit, silent, dayKey, newId } from "../store.js";
import {
  ND, food, recipeTpl, AISLES, AISLE_IDS, MEAL_TYPES, MEAL_TYPE_IDS, DIETS, STYLES, MACRO_COLORS, ACTIVITY_LABELS, GOAL_LABELS, GOAL_OFFSETS,
  N, defaultNutrition, settings, dayTargets, slotTargets, typeTarget, guessSlot, baseTargets, computedTargets, waterGoal, prefOf, prefFood, allowed, excluded,
  score, scoreFood, grade, GRADE_VERDICT, GRADE_COLORS, productFromFood, shortName, macrosOf, unitLabel, weightText, money, packs, macroLine, isWeighedRaw,
  weeklyQuantity, matchRow, pricePerKg, need, rowTitle, normalized, solve, totals, offsetDay, keyDate, keysBetween, weightsByDay, avgWeights, runAdjustment,
  choices, build, todayLog, eaten, remaining, addToCart, logMeal, pastMeals, repeatMeal, addToList, recipeCounts, drawRecipes, newRecipes, recipeTotals,
  sendRecipesToList, recipeKey, plan, dayStats, onTarget, offProduct, offSearch, readPortion, portionInBrowser, mergeWeights,
} from "../nutrition.js";
import { checkInFor } from "../model.js";
import { barBtn, okBtn, primaryButton, kgText } from "./common.js";
import { bodyWeightView } from "./progress.js";

const KEYS = ["kcal", "p", "c", "f"];
const LABEL = { kcal: "Calories", p: "Protéines", c: "Glucides", f: "Lipides" };
const SHORT = { kcal: "kcal", p: "Prot.", c: "Gluc.", f: "Lip." };
const AISLE_COLORS = { viandes: "var(--red)", oeufs: "var(--yellow)", laitiers: "var(--cyan, #32ade6)", fromages: "var(--orange)", feculents: "#a2845e", legumes: "var(--green)", fruits: "var(--pink)", graisses: "var(--mint)", sauces: "var(--indigo)", poudre: "var(--purple)", extras: "#8e8e93" };
const CYAN = "#32ade6";

/** Shared while the app is open, not saved (NutritionSession). */
const session = { page: "today", slotId: null, doses: null, mealError: null, groceryError: null, groceryItem: null, groceryMatch: null, groceryTake: null, editingRecipe: null, lookingUp: false, open: new Set() };

const flash = (text) => toast(text);

function use(product, target) {
  session.mealError = null;
  session.groceryError = null;
  if (target === "meal") {
    session.doses = null;
    commit(() => addToCart(product));
    flash(`${product.name} ajouté · note ${grade(score(settings(), product).value)}`);
  } else {
    session.groceryItem = product;
    session.groceryMatch = matchRow(settings(), product, N().shopList);
    session.groceryTake = null;
    commit(() => {});
  }
}

async function lookup(code, target) {
  session.mealError = null;
  session.groceryError = null;
  session.lookingUp = true;
  commit(() => {});
  try {
    use(await offProduct(code), target);
  } catch (e) {
    const m = e?.message || "Produit introuvable.";
    if (target === "meal") session.mealError = m;
    else session.groceryError = m;
  }
  session.lookingUp = false;
  commit(() => {});
}

// MARK: Shared pieces

function gradeBadge(g, size = 22) {
  return h("span.grade", { style: { width: size + "px", height: size + "px", fontSize: size * 0.58 + "px", borderRadius: size * 0.3 + "px", background: GRADE_COLORS[g] }, "aria-label": `Note ${g}, ${GRADE_VERDICT[g]}` }, g);
}

function productThumb(p, { g, size = 46 } = {}) {
  const color = AISLE_COLORS[p.fam] || "#8e8e93";
  const ph = () => h("span", { style: { width: size + "px", height: size + "px", display: "inline-flex", alignItems: "center", justifyContent: "center", color, background: `color-mix(in srgb, ${color} 15%, transparent)` } }, icon(AISLES[p.fam]?.icon || "bag", size * 0.4));
  const box = h("span", { style: { width: size + "px", height: size + "px", borderRadius: size * 0.26 + "px", overflow: "hidden", display: "inline-flex", background: "var(--card)", flex: "none" } });
  if (p.imageURL) {
    const img = h("img", { src: p.imageURL, alt: "", loading: "lazy", style: { width: "100%", height: "100%", objectFit: "cover" } });
    img.addEventListener("error", () => img.replaceWith(ph()));
    box.append(img);
  } else box.append(ph());
  if (!g) return box;
  return h("span", { style: { position: "relative", display: "inline-flex", paddingRight: "4px", paddingBottom: "4px", flex: "none" } }, box, h("span", { style: { position: "absolute", right: 0, bottom: 0 } }, gradeBadge(g, size * 0.42)));
}

function mixBar(n) {
  const kp = n.p * 4, kc = n.c * 4, kf = n.f * 9;
  const sum = Math.max(kp + kc + kf, 1);
  return h("div.mix", h("i", { style: { width: (kp / sum) * 100 + "%", background: MACRO_COLORS.p } }), h("i", { style: { width: (kc / sum) * 100 + "%", background: MACRO_COLORS.c } }), h("i", { style: { width: (kf / sum) * 100 + "%", background: MACRO_COLORS.f } }));
}

const chip = (title, on, onClick, iconName) => h("button.chip" + (on ? ".on" : ""), { type: "button", "aria-pressed": String(on), onclick: onClick }, iconName && icon(iconName), title);

function countRow(title, value, onChange, min, max) {
  return h("div.hstack", { style: { gap: "10px" } }, h("span.grow", title), h("span.semibold.secondary.mono", String(value)), stepper(value, onChange, { min, max, label: title }));
}

function emptyCard(iconName, title, message) {
  return card(h("div.vstack", { style: { gap: "8px" } }, h("span.accent", icon(iconName, 30)), h("span.headline", title), h("span.subheadline.secondary", message)));
}

// MARK: Root

export function nutritionRoot(ctx) {
  const s = settings();
  if (session.slotId == null || !slotTargets(s).some((x) => x.id === session.slotId)) session.slotId = guessSlot(s);
  const t = dayTargets(s);
  const pages = [["today", "Aujourd'hui"], ["groceries", "Courses"], ["recipes", "Recettes"], ["stats", "Bilan"]];
  const body = session.page === "today" ? todayPage(ctx) : session.page === "groceries" ? groceriesPage(ctx) : session.page === "recipes" ? recipesPage(ctx) : statsPage(ctx);
  return {
    title: "Nutrition",
    large: true,
    subtitle: `Objectif ${int(t.kcal)} kcal · ${int(t.p)} g de protéines`,
    right: barBtn("", () => ctx.present(nutritionSettings, {}), { iconName: "person", aria: "Réglages nutrition" }),
    body: [h("div", { style: { marginBottom: "18px" } }, segmented(pages, session.page, (v) => { session.page = v; ctx.refresh(); window.scrollTo(0, 0); }, { label: "Section" })), h("div.vstack", { style: { gap: "16px" } }, body)],
    bottom: actions(ctx),
  };
}

function actions(ctx) {
  const glass = (content, onClick, opts = {}) => h("button.btn.glass" + (opts.auto ? ".auto" : ""), { type: "button", onclick: onClick, "aria-label": opts.aria, disabled: opts.disabled, style: opts.style }, content);
  const prominent = (content, onClick, disabled) => h("button.btn.primary", { type: "button", onclick: onClick, disabled, style: { flex: 1, opacity: disabled ? 0.5 : 1 } }, content);
  const cart = N().cart;
  if (session.page === "today") {
    if (session.doses == null)
      return h(
        "div.btn-row",
        glass(icon("search"), () => ctx.present(foodSearch, { onPick: (p) => use(p, "meal") }), { auto: true, aria: "Rechercher", style: { width: "50px", padding: 0 } }),
        glass([icon("barcode"), "Scanner"], () => ctx.present(scanner, { onCode: (c) => lookup(c, "meal") }, { onClose: stopScanner }), { auto: true }),
        prominent(cart.length ? `Calculer (${cart.length})` : "Calculer", () => {
          document.activeElement?.blur?.();
          session.doses = solve(cart, remaining(session.slotId));
          ctx.refresh();
        }, !cart.length)
      );
    return h(
      "div.btn-row",
      glass("Modifier", () => { session.doses = null; ctx.refresh(); }, { auto: true }),
      prominent([icon("check"), "J'ai mangé ça"], () => {
        const slot = session.slotId ?? slotTargets()[0]?.id;
        if (!session.doses || !slot) return;
        const d = session.doses;
        session.doses = null;
        commit(() => logMeal(d, slot));
        haptic([10, 40, 10]);
        flash("Repas noté. Bon appétit !");
      })
    );
  }
  if (session.page === "groceries" && !session.groceryItem)
    return h(
      "div.btn-row",
      glass(icon("search"), () => ctx.present(foodSearch, { onPick: (p) => use(p, "groceries") }), { auto: true, aria: "Rechercher", style: { width: "50px", padding: 0 } }),
      prominent([icon("barcode"), "Scanner un produit"], () => ctx.present(scanner, { onCode: (c) => lookup(c, "groceries") }, { onClose: stopScanner }))
    );
  return null;
}

// MARK: Today

function todayPage(ctx) {
  const cart = N().cart;
  return [dayCard(ctx), session.doses && session.doses.length === cart.length ? dosesCard(ctx) : mealCard(ctx), journalCard(ctx)];
}

function dayCard(ctx) {
  const s = settings();
  const t = dayTargets(s), e = eaten();
  const left = rnd(t.kcal - e.kcal);
  const protLeft = Math.max(0, rnd(t.p - e.p));
  const late = new Date().getHours() >= 18 && protLeft > 40;
  const slots = slotTargets(s);
  const selected = slots.find((x) => x.id === session.slotId) || slots[0];
  const rem = selected ? remaining(selected.id, s) : null;
  return card(
    cardTitle("Calories", "flame", MACRO_COLORS.kcal),
    h(
      "div.hstack",
      { style: { gap: "20px", marginTop: "4px" } },
      ring(t.kcal > 0 ? e.kcal / t.kcal : 0, left < 0 ? "var(--red)" : MACRO_COLORS.kcal, { size: 104, width: 14, center: [h("span.display", { style: { fontSize: "26px" } }, String(Math.abs(left))), h("span.caption2.secondary", left >= 0 ? "kcal restantes" : "kcal en trop")] }),
      h(
        "div.grow.vstack",
        { style: { gap: "10px" } },
        ["p", "c", "f"].map((k) =>
          h("div.vstack", { style: { gap: "4px" } }, h("div.hstack", h("span.subheadline.grow", LABEL[k]), h("span.caption.secondary.mono", `${rnd(e[k])}/${int(t[k])} g`)), progressBar(t[k] > 0 ? e[k] / t[k] : 0, MACRO_COLORS[k], 5))
        )
      )
    ),
    slots.length > 1 &&
      h("div", { style: { marginTop: "16px" } }, segmented(slots.map((x) => [x.id, x.label]), selected?.id, (id) => {
        session.slotId = id;
        if (session.doses) session.doses = solve(N().cart, remaining(id));
        ctx.refresh();
      }, { label: "Repas" })),
    rem && h("p.footnote.secondary", { style: { marginTop: "12px" } }, `Reste pour ${selected.label.toLowerCase()} : `, h("b", `${int(rem.kcal)} kcal`), ` · P ${int(rem.p)} · G ${int(rem.c)} · L ${int(rem.f)} g`),
    s.training &&
      h("p.footnote.hstack", { style: { gap: "6px", marginTop: "10px", color: s.training.trained ? "var(--green)" : "var(--secondary)" } }, icon(s.training.trained ? "dumbbell" : "bed", 16), s.training.trained ? `Jour de séance : +${int(s.training.kcal)} kcal, en glucides` : `Jour de repos : ${int(s.training.kcal)} kcal pour équilibrer tes séances de la semaine`),
    late && h("p.footnote.hstack", { style: { gap: "6px", marginTop: "10px", color: "var(--orange)" } }, icon("exclamation", 16), `Il te manque ${protLeft} g de protéines ce soir : un skyr, du poulet ou une dose de whey.`)
  );
}

function quickFoods(s) {
  const liked = ND.foods.filter((f) => prefFood(s, f) === 1 && !ND.quick.includes(f.id)).map((f) => f.id);
  return [...ND.quick, ...liked].map(food).filter((f) => f && allowed(s, f));
}

function mealCard(ctx) {
  const s = settings();
  const cart = N().cart;
  const openPast = () => ctx.present(pastMealsSheet, {}, { detent: "large" });
  return card(
    h("div.hstack", cardTitle("Ce que tu manges", "fork", MACRO_COLORS.kcal), h("span.spacer"), cart.length > 0 && h("span.subheadline.secondary", `${cart.length} produit${cart.length > 1 ? "s" : ""}`), h("button.icon-btn.sm", { type: "button", "aria-label": "Repas déjà mangés", onclick: openPast }, icon("history"))),
    session.lookingUp && h("p.subheadline.secondary", "Recherche du produit…"),
    session.mealError && inlineError(session.mealError),
    cart.length === 0
      ? h("p.subheadline.secondary", "Scanne tes produits ou touche un aliment, puis Calculer.")
      : h("div", cart.map((item, i) => [i > 0 && h("div.divider", { style: { marginLeft: "52px" } }), cartRow(ctx, item, i, s)])),
    h(
      "div.scroll-x",
      { style: { margin: "12px -18px 0", padding: "0 18px", gap: "6px" } },
      quickFoods(s).map((f) =>
        h("button.chip.small", { type: "button", onclick: () => { session.doses = null; commit(() => addToCart(productFromFood(f))); } }, icon("plus"), shortName(f.name))
      )
    ),
    cart.length === 0 && h("button.subheadline.semibold.accent.hstack", { type: "button", style: { gap: "6px", marginTop: "12px" }, onclick: openPast }, icon("history", 18), "Reprendre un repas déjà mangé")
  );
}

function cartRow(ctx, item, index, s) {
  const setFixed = (v) => {
    session.doses = null;
    commit(() => (N().cart[index].fixed = v));
  };
  const open = () =>
    menu([
      { label: "Quantité calculée", icon: "wand", onClick: () => setFixed(null) },
      { label: "Fixer la quantité…", icon: "scale", onClick: () => prompt("Quantité fixe", { message: item.name, value: item.fixed ?? item.unit?.grams ?? 100, numeric: true, decimal: false, placeholder: "Grammes", onSubmit: (v) => v != null && setFixed(Math.max(0, v)) }) },
      null,
      { label: "Retirer", icon: "trash", destructive: true, onClick: () => { session.doses = null; commit(() => N().cart.splice(index, 1)); } },
    ]);
  return h(
    "div.hstack",
    { style: { gap: "12px", padding: "8px 0" } },
    productThumb(item, { g: grade(score(s, item).value), size: 40 }),
    h("div.grow.vstack", { style: { gap: "4px", minWidth: 0 } }, h("span.subheadline.semibold.ellipsis", item.name), mixBar(item.n)),
    h("button.chip.small", { type: "button", onclick: open, style: { color: item.fixed == null ? "var(--secondary)" : "var(--ink)", fontWeight: 600 } }, item.fixed != null ? `${int(item.fixed)} g` : "auto")
  );
}

function dosesCard(ctx) {
  const cart = N().cart;
  const doses = session.doses;
  const total = totals(cart, doses);
  const target = remaining(session.slotId);
  let worst = ["kcal", 0];
  for (const k of KEYS) {
    const d = target[k] > 0 ? (total[k] - target[k]) / target[k] : 0;
    if (Math.abs(d) > Math.abs(worst[1])) worst = [k, d];
  }
  const ok = Math.abs(worst[1]) <= 0.1;
  const note = (item, g) => {
    if (g === 0) return "Pas besoin pour ce repas";
    const parts = [];
    if (item.unit) {
      const c = g / item.unit.grams;
      parts.push(`${num(c, 1)} ${unitLabel(item.unit, c)}`);
    }
    if (isWeighedRaw(item.name)) parts.push("pesé cru");
    if (item.fixed != null) parts.push("fixé");
    return parts.join(" · ") || null;
  };
  return card(
    cardTitle("Tes doses à peser", "scale"),
    h("p.footnote.semibold.hstack", { style: { gap: "6px", color: ok ? "var(--green)" : "var(--orange)" } }, icon(ok ? "checkCircle" : "exclamation", 16), ok ? "Pile dans tes objectifs" : worst[1] < 0 ? `Il manque des ${LABEL[worst[0]].toLowerCase()}` : `Trop de ${LABEL[worst[0]].toLowerCase()} : fixe une quantité plus bas`),
    h(
      "div",
      cart.map((item, i) => {
        const g = doses[i];
        const n = note(item, g);
        return [
          i > 0 && h("div.divider", { style: { marginLeft: "52px" } }),
          h("div.hstack", { style: { gap: "12px", padding: "8px 0" } }, productThumb(item, { size: 40 }), h("div.grow.vstack", { style: { gap: "2px", minWidth: 0 } }, h("span.subheadline.semibold.ellipsis", item.name), n && h("span.caption.secondary", n)), h("span.display.mono", { style: { fontSize: "22px", color: g === 0 ? "var(--secondary)" : "var(--accent)" } }, `${int(g)} g`)),
        ];
      })
    ),
    h(
      "div.hstack",
      { style: { padding: "8px 0", background: "var(--field)", borderRadius: "12px", marginTop: "12px" } },
      KEYS.map((k) => h("div.vstack", { style: { flex: 1, alignItems: "center", gap: "2px" } }, h("span.subheadline.semibold", { style: { color: MACRO_COLORS[k] } }, String(rnd(total[k]))), h("span.caption2.secondary", `/ ${rnd(target[k])} ${SHORT[k]}`)))
    )
  );
}

function sparkline(weights) {
  const days = Array.from({ length: 30 }, (_, i) => offsetDay(29 - i));
  const pts = [];
  days.forEach((d, i) => {
    const win = [];
    for (let k = 0; k < 7; k++) if (i - k >= 0 && weights[days[i - k]] != null) win.push(weights[days[i - k]]);
    if (win.length) pts.push({ x: keyDate(d), y: win.reduce((a, b) => a + b, 0) / win.length });
  });
  const el = lineChart(pts, { height: 36, axes: false, dots: false, width: 2.5 });
  el.style.width = "96px";
  el.style.height = "36px";
  el.setAttribute("viewBox", "0 0 340 36");
  el.setAttribute("preserveAspectRatio", "none");
  return el;
}

function journalCard(ctx) {
  const s = N().settings;
  const weights = weightsByDay();
  const now = avgWeights(weights, 0, 6), prev = avgWeights(weights, 7, 13);
  const trend = now.count >= 3 && prev.count >= 3 ? now.avg - prev.avg : null;
  const losing = GOAL_OFFSETS[Math.min(Math.max(s.profile.goal, 0), 4)] <= 0;
  const log = todayLog();
  const e = eaten();
  const adj = s.adj;
  const adjNote = adj.message && adj.last && keysBetween(adj.last, dayKey()) < 7 ? adj.message : null;
  const addWeight = () =>
    prompt("Poids du jour", {
      message: "Le matin à jeun, c'est le plus fiable.",
      numeric: true,
      placeholder: "kg",
      action: "Noter",
      onSubmit: (kg) => {
        if (!(kg > 20 && kg < 400)) return;
        commit(() => {
          const today = dayKey();
          const existing = [...S.bodyWeights].reverse().find((b) => dayKey(b.date) === today);
          if (existing) {
            existing.weight = kg;
            existing.date = Date.now();
          } else S.bodyWeights.push({ id: newId(), date: Date.now(), weight: kg });
          runAdjustment();
        });
      },
    });
  const water = checkInFor(dayKey())?.water ?? 0;
  const goal = waterGoal(s);
  const waterBtn = longPress(
    h("button.glass-circle", { type: "button", "aria-label": "Ajouter un verre d'eau", onclick: () => { haptic(); commit(() => (checkInFor(dayKey(), true).water += 1)); } }, icon("plus")),
    () => menu([{ label: "Retirer un verre", icon: "minus", onClick: () => commit(() => { const c = checkInFor(dayKey(), true); c.water = Math.max(0, c.water - 1); }) }])
  );
  return card(
    h(
      "div.hstack",
      { style: { gap: "12px" } },
      h(
        "button.vstack.grow",
        { type: "button", style: { alignItems: "flex-start", gap: "2px", textAlign: "left" }, onclick: () => ctx.push(bodyWeightView) },
        cardTitle("Poids", "scale", "var(--indigo)"),
        h("span.hstack", { style: { gap: "6px", alignItems: "baseline" } }, h("span.display", { style: { fontSize: "22px" } }, now.avg != null ? kgText(now.avg) : weights[dayKey()] != null ? kgText(weights[dayKey()]) : "—"), trend != null && h("span.footnote.semibold", { style: { color: (losing ? trend <= 0 : trend >= 0) ? "var(--green)" : "var(--orange)" } }, (trend > 0 ? "+" : "") + kgText(trend))),
        h("span.caption2.secondary", now.avg == null ? "pèse-toi le matin à jeun" : "moyenne sur 7 jours")
      ),
      Object.keys(weights).length > 1 && sparkline(weights),
      h("button.glass-circle", { type: "button", "aria-label": "Noter mon poids", onclick: addWeight }, icon("plus"))
    ),
    adjNote && h("p.caption.secondary", { style: { marginTop: "8px" } }, adjNote),
    h("div.divider", { style: { margin: "12px 0" } }),
    h(
      "div.hstack",
      { style: { gap: "12px" } },
      cardTitle("Eau", "drop", CYAN),
      h("div.hstack", { style: { gap: "3px" } }, Array.from({ length: goal }, (_, i) => h("i", { style: { width: "6px", height: "16px", borderRadius: "3px", background: i < water ? CYAN : `color-mix(in srgb, ${CYAN} 18%, transparent)` } }))),
      h("span.spacer"),
      h("span.subheadline.semibold.mono", { style: { color: water >= goal ? CYAN : "var(--secondary)" } }, `${water}/${goal}`),
      waterBtn
    ),
    h("div.divider", { style: { margin: "12px 0 4px" } }),
    disclosure(
      session.open,
      "log",
      h("span.hstack.grow", h("span.subheadline.grow", "Mangé aujourd'hui"), h("span.caption.secondary.mono", `${rnd(e.kcal)} kcal · ${rnd(e.p)} g P`)),
      h(
        "div",
        log.length === 0 && h("p.subheadline.secondary", { style: { paddingTop: "8px" } }, "Rien de noté aujourd'hui."),
        log.map((entry) =>
          longPress(
            h("div.hstack", { style: { padding: "6px 0" } }, h("span.subheadline.grow.ellipsis", entry.name), h("span.caption.secondary.mono", `${rnd(entry.kcal)} kcal · ${int(entry.g)} g`)),
            () => menu([{ label: "Supprimer", icon: "trash", destructive: true, onClick: () => commit(() => (N().logs[dayKey()] = todayLog().filter((x) => x.id !== entry.id))) }], { title: entry.name })
          )
        )
      )
    )
  );
}

function pastMealsSheet(ctx) {
  const slots = slotTargets();
  const slotId = session.slotId ?? slots[0]?.id ?? "";
  const slotLabel = slots.find((x) => x.id === slotId)?.label ?? "ce repas";
  ctx.local.q ??= "";
  const results = h("div");
  const fill = () => {
    const q = ctx.local.q.trim();
    const meals = pastMeals().filter((m) => !q || m.entries.some((e) => normalized(e.name).includes(normalized(q))));
    const when = (m) => {
      const d = keyDate(m.day);
      const diff = keysBetween(m.day, dayKey());
      const day = diff === 0 ? "Aujourd'hui" : diff === 1 ? "Hier" : capitalized(fmtDate(d, { weekday: "long", day: "numeric", month: "long" }));
      return [day, slots.find((x) => x.id === m.slot)?.label].filter(Boolean).join(" · ");
    };
    results.replaceChildren(
      meals.length
        ? section(
            { footer: `Touche un repas pour le noter à nouveau dans ${slotLabel.toLowerCase()}, avec les mêmes quantités.` },
            meals.map((m) =>
              h(
                "button.cell",
                {
                  type: "button",
                  style: { display: "block", textAlign: "left" },
                  onclick: () => {
                    commit(() => repeatMeal(m, slotId));
                    haptic([10, 40, 10]);
                    flash(`Ajouté à ${slotLabel.toLowerCase()} · ${rnd(m.macros.kcal)} kcal`);
                    ctx.close();
                  },
                },
                h("div.hstack", h("span.footnote.semibold.secondary.grow", when(m)), m.times > 1 && h("span.footnote.semibold.secondary", `×${m.times}`)),
                h("div.clamp2", { style: { margin: "4px 0" } }, m.title),
                h("div.caption.secondary.mono", `${rnd(m.macros.kcal)} kcal · P ${rnd(m.macros.p)} · G ${rnd(m.macros.c)} · L ${rnd(m.macros.f)} g`)
              )
            )
          )
        : emptyState(q ? "search" : "fork", q ? "Aucun résultat" : "Aucun repas noté", q ? "Essaie un autre aliment." : "Les repas que tu notes avec « J'ai mangé ça » apparaîtront ici.")
    );
  };
  fill();
  return {
    title: "Repas déjà mangés",
    left: barBtn("Fermer", () => ctx.close()),
    search: searchField(ctx.local.q, "Aliment", (v) => { ctx.local.q = v; fill(); }),
    body: results,
  };
}

// MARK: Groceries

function groceriesPage(ctx) {
  return [session.groceryItem ? scannedCard(ctx) : session.groceryError ? card(inlineError(session.groceryError)) : session.lookingUp ? card(h("p.subheadline.secondary", "Recherche du produit…")) : null, shoppingList(ctx), goodChoices(ctx)];
}

function closeScanned() {
  session.groceryItem = null;
  session.groceryMatch = null;
  session.groceryTake = null;
}

function scannedCard(ctx) {
  const p = session.groceryItem;
  const s = settings();
  const n = N();
  const sc = score(s, p);
  const g = grade(sc.value);
  const q = weeklyQuantity(s, p, p.fam, n.variety);
  const isExcluded = sc.excludedBy != null;
  const row = !isExcluded && session.groceryMatch != null && n.shopList[session.groceryMatch] ? session.groceryMatch : null;
  const openRows = n.shopList.map((_, i) => i).filter((i) => !n.shopList[i].done || i === session.groceryMatch);
  return card(
    h(
      "div.hstack",
      { style: { alignItems: "flex-start", gap: "12px" } },
      productThumb(p, { size: 52 }),
      h("div.grow.vstack", { style: { gap: "2px", minWidth: 0 } }, h("span.headline.clamp2", p.name), h("span.subheadline.secondary", [p.brand, p.packG > 0 ? weightText(p.packG) : ""].filter(Boolean).join(" · "))),
      h("button.secondary", { type: "button", "aria-label": "Fermer", onclick: () => { closeScanned(); ctx.refresh(); } }, icon("xmark", 24))
    ),
    h(
      "div.hstack",
      { style: { gap: "12px", marginTop: "14px" } },
      ring(sc.value / 100, GRADE_COLORS[g], { size: 46, width: 5, center: h("span.display", { style: { fontSize: "18px", color: GRADE_COLORS[g] } }, g) }),
      h("div.vstack", { style: { gap: "2px" } }, h("span.headline", { style: { color: GRADE_COLORS[g] } }, GRADE_VERDICT[g]), h("span.caption.secondary", `${sc.value}/100 · ${macroLine(p.n)}`))
    ),
    sc.reasons.length > 0 &&
      h("div.hstack.wrap", { style: { gap: "6px", marginTop: "14px" } }, sc.reasons.map((r) => {
        const tint = r.bad ? "var(--orange)" : "var(--green)";
        return h("span.tag", { style: { color: tint, background: `color-mix(in srgb, ${tint} 12%, transparent)`, fontWeight: 500 } }, icon(r.bad ? "minus" : "plus", 11), r.text);
      })),
    !isExcluded && openRows.length > 0 && [
      h("div.divider", { style: { margin: "14px 0" } }),
      h("div.hstack.subheadline", h("span.secondary.grow", "C'est pour"), picker([[-1, "Rien de ma liste"], ...openRows.map((i) => [i, `${rowTitle(n.shopList[i])} · ${weightText(need(s, n.shopList[i], n.variety))}`])], session.groceryMatch ?? -1, (v) => { session.groceryMatch = v < 0 ? null : v; session.groceryTake = null; ctx.refresh(); }, { accent: true, label: "C'est pour" })),
    ],
    h("div.divider", { style: { margin: "14px 0" } }),
    row != null ? listMatch(ctx, p, row, s) : planContent(ctx, p, q, isExcluded, s)
  );
}

function planContent(ctx, p, q, isExcluded, s) {
  const big = (text) => h("div.display", { style: { fontSize: "40px", textAlign: "center" } }, text);
  const extras = p.fam === "extras";
  return h(
    "div.vstack",
    { style: { gap: "14px" } },
    h("button.subheadline.semibold.accent.hstack", { type: "button", style: { gap: "6px", alignSelf: "flex-start" }, onclick: () => menu(AISLE_IDS.map((a) => ({ label: AISLES[a].label, icon: AISLES[a].icon, checked: a === p.fam, onClick: () => { p.fam = a; ctx.refresh(); } }))) }, icon(AISLES[p.fam].icon, 18), AISLES[p.fam].label, icon("chevronUpDown", 14)),
    h(
      "div.vstack",
      { style: { gap: "2px", alignItems: "center" } },
      big(isExcluded ? "0 g" : extras ? (q.grams > 0 ? `≤ ${weightText(q.grams)}` : "0 g") : weightText(q.grams)),
      h("span.subheadline.secondary", { style: { textAlign: "center" } }, isExcluded ? "tu as exclu ce type de produit dans tes réglages" : extras ? "maximum pour la semaine" : `pour la semaine${isWeighedRaw(p.name) ? " · poids cru" : ""}`),
      !isExcluded && !extras && packs(q.grams, p.packG) && h("span.footnote.secondary", packs(q.grams, p.packG))
    ),
    !extras && !isExcluded && h("div.subheadline", countRow(`Produits différents en ${AISLES[p.fam].label.toLowerCase()} cette semaine`, q.count, (v) => commit(() => (N().variety[p.fam] = Math.min(8, Math.max(1, v)))), 1, 8)),
    !isExcluded && [
      h("p.footnote.secondary", q.explanation),
      primaryButton("Ajouter à ma liste", () => {
        commit(() => addToList(p, p.fam));
        flash(`${p.name} : ${weightText(q.grams)} ajouté à ta liste`);
        closeScanned();
        ctx.refresh();
      }, "plus"),
    ]
  );
}

function listMatch(ctx, p, rowIndex, s) {
  const n = N();
  const row = n.shopList[rowIndex];
  const nd = need(s, row, n.variety);
  const left = Math.max(0, nd - row.got);
  const takeCount = session.groceryTake ?? (p.packG > 0 ? Math.max(1, Math.ceil(left / p.packG)) : rnd(left));
  ctx.local.price ??= null;
  ctx.local.grams ??= null;
  const take = () => {
    commit(() => {
      const r = N().shopList[rowIndex];
      if (!r) return;
      const g = p.packG > 0 ? takeCount * p.packG : ctx.local.grams ?? takeCount;
      r.got += g;
      if (p.packG > 0 && r.ref) r.ref.packG = p.packG;
      if (ctx.local.price > 0 && p.packG > 0) r.ppk = ctx.local.price / (p.packG / 1000);
      const nn = need(s, r, N().variety);
      r.done = r.got >= nn * 0.95;
      haptic([10, 40, 10]);
      flash(r.done ? `${rowTitle(r)} : quantité atteinte, rayé de ta liste` : `${rowTitle(r)} : encore ${weightText(nn - r.got)} à prendre`);
    });
    ctx.local.price = null;
    ctx.local.grams = null;
    closeScanned();
    ctx.refresh();
  };
  return h(
    "div.vstack",
    { style: { gap: "14px" } },
    h(
      "div.vstack",
      { style: { gap: "2px", alignItems: "center", textAlign: "center" } },
      h("div.display", { style: { fontSize: "40px" } }, left > 0 ? weightText(left) : "✓"),
      h("span.footnote.secondary", `${left > 0 ? "encore à prendre" : "Tu as déjà tout ce qu'il faut"} · il en faut ${weightText(nd)}, ${weightText(row.got)} déjà dans le caddie`),
      left > 0 && packs(left, p.packG) && h("span.footnote.secondary", packs(left, p.packG))
    ),
    p.packG > 0
      ? [
          countRow(`Je prends (paquets de ${weightText(p.packG)})`, takeCount, (v) => { session.groceryTake = Math.max(1, v); ctx.refresh(); }, 1, 30),
          input({ type: "number", decimal: true, value: ctx.local.price ?? "", placeholder: `Prix du paquet (facultatif, ${s.currency})`, attrs: { "data-fid": "pack-price", style: "background: var(--field); border-radius: 10px; padding: 10px 12px" }, onInput: (v) => (ctx.local.price = v) }),
        ]
      : h("div.hstack", h("span.grow", "Je prends (g)"), input({ type: "number", value: ctx.local.grams ?? takeCount, placeholder: "g", align: "center", attrs: { "data-fid": "take-g", style: "width: 96px; background: var(--field); border-radius: 10px; padding: 8px" }, onInput: (v) => (ctx.local.grams = v) })),
    primaryButton("Mettre dans le caddie", take, "cartPlus")
  );
}

function shoppingList(ctx) {
  const n = N();
  const list = n.shopList;
  const s = settings();
  const v = n.variety;
  const total = list.reduce((a, r) => a + (pricePerKg(r) * need(s, r, v)) / 1000, 0);
  const left = list.reduce((a, r) => a + (r.done ? 0 : (pricePerKg(r) * Math.max(0, need(s, r, v) - r.got)) / 1000), 0);
  const order = list.map((_, i) => i).sort((a, b) => (list[a].done ? 1 : 0) - (list[b].done ? 1 : 0) || a - b);
  return card(
    h(
      "div.hstack",
      cardTitle("Ma liste", "checklist"),
      h("span.spacer"),
      list.length > 0 && [
        h("span.display", { style: { fontSize: "17px" } }, `≈ ${money(total, s.currency)}`),
        h("button.icon-btn.sm", { type: "button", "aria-label": "Options de la liste", onclick: () => menu([{ label: "Vider la liste", icon: "trash", destructive: true, onClick: () => confirm("Vider la liste de courses ?", null, "Vider", () => commit(() => (N().shopList = []))) }]) }, icon("ellipsis")),
      ]
    ),
    h("p.caption.secondary", { style: { marginTop: "2px", marginBottom: list.length ? "6px" : 0 } }, list.length ? `${list.filter((r) => r.done).length}/${list.length} dans le caddie · reste ≈ ${money(left, s.currency)}` : "Scanne un produit ou pioche dans les bons choix."),
    order.map((i) => [h("div.divider"), shopRow(i, s, v)])
  );
}

function shopRow(index, s, v) {
  const row = N().shopList[index];
  const nd = need(s, row, v);
  const left = Math.max(0, nd - row.got);
  const pk = row.fam === "extras" || !row.ref || row.done ? null : packs(row.got > 0 ? left : nd, row.ref?.packG ?? 0);
  const meta = [AISLES[row.fam]?.label, `≈ ${money((pricePerKg(row) * nd) / 1000, s.currency)}`, pk, row.got > 0 && !row.done ? `${weightText(left)} encore à prendre` : null].filter(Boolean).join(" · ");
  const el = h(
    "div.hstack",
    { style: { gap: "12px", padding: "10px 0" } },
    h("button", { type: "button", "aria-label": row.done ? "Décocher" : "Cocher", style: { color: row.done ? "var(--accent)" : "var(--secondary)", display: "inline-flex" }, onclick: () => { haptic(); commit(() => (N().shopList[index].done = !row.done)); } }, icon(row.done ? "checkCircle" : "circle", 26)),
    h(
      "div.grow.vstack",
      { style: { gap: "2px", minWidth: 0 } },
      h("span", { style: { textDecoration: row.done ? "line-through" : null, color: row.done ? "var(--secondary)" : null } }, rowTitle(row)),
      h("span.caption.secondary", meta),
      row.got > 0 && !row.done && progressBar(nd > 0 ? row.got / nd : 0, "var(--accent)", 4)
    ),
    h("span.subheadline.semibold", { style: { fontFamily: "var(--rounded)", color: row.done ? "var(--secondary)" : null, whiteSpace: "nowrap" } }, `${row.fam === "extras" ? "≤ " : ""}${row.got > 0 && !row.done ? weightText(row.got) + " / " : ""}${weightText(nd)}`)
  );
  return longPress(el, () => menu([{ label: "Supprimer", icon: "trash", destructive: true, onClick: () => commit(() => N().shopList.splice(index, 1)) }], { title: rowTitle(row) }));
}

const CHOICE_ORDER = ["viandes", "oeufs", "laitiers", "feculents", "legumes", "fruits", "fromages", "graisses", "sauces", "poudre"];

function goodChoices(ctx) {
  const s = settings();
  const v = N().variety;
  const groups = CHOICE_ORDER.map((a) => ({
    a,
    foods: ND.foods.filter((f) => f.fam === a && allowed(s, f)).map((f) => ({ f, score: scoreFood(s, f).value })).sort((x, y) => prefFood(s, y.f) - prefFood(s, x.f) || y.score - x.score),
  })).filter((g) => g.foods.length);
  return card(
    cardTitle("Bons choix pour toi", "thumbUp", "var(--green)"),
    h("p.caption.secondary", { style: { margin: "2px 0 4px" } }, "Rayon par rayon, avec la quantité pour la semaine."),
    groups.map((g, gi) => [
      gi > 0 && h("div.divider"),
      disclosure(
        session.open,
        "aisle-" + g.a,
        h("span.subheadline.semibold.hstack", { style: { gap: "8px" } }, icon(AISLES[g.a].icon, 18), AISLES[g.a].label),
        h(
          "div",
          g.foods.map(({ f, score: sv }) => {
            const p = productFromFood(f);
            const grams = weeklyQuantity(s, p, f.fam, v).grams;
            return h(
              "div.hstack",
              { style: { gap: "10px", padding: "6px 0" } },
              gradeBadge(grade(sv)),
              h("span.subheadline", f.name),
              prefFood(s, f) === 1 && h("span", { style: { color: "var(--pink)", display: "inline-flex" } }, icon("heartFill", 12)),
              h("span.spacer"),
              h("span.subheadline.secondary.mono.nowrap", `${weightText(grams)}/sem.`),
              h("button.accent", { type: "button", "aria-label": `Ajouter ${f.name} à ma liste`, style: { display: "inline-flex" }, onclick: () => { commit(() => addToList(p, f.fam)); flash(`${f.name} : ${weightText(grams)} ajouté à ta liste`); } }, icon("plus", 22))
            );
          })
        )
      ),
    ])
  );
}

// MARK: Recipes

function recipesPage(ctx) {
  const n = N();
  const groups = n.recipeGroups || [];
  const count = groups.reduce((a, g) => a + g.items.length, 0);
  return [
    recipeSetup(ctx),
    count === 0
      ? emptyCard("pan", n.recipeGroups == null ? "Pas encore de recettes" : "Aucune recette pour ces styles", n.recipeGroups == null ? "Choisis combien de recettes, puis appuie sur Proposer." : "Retire un style ou change de repas, puis relance.")
      : [groups.map((g, gi) => g.items.length > 0 && card(cardTitle(MEAL_TYPES[g.type].label, MEAL_TYPES[g.type].icon), g.items.map((_, i) => [h("div.divider", { style: { marginTop: i === 0 ? "4px" : 0 } }), recipeCard(ctx, gi, i)]))), recipeWeek(ctx)],
  ];
}

function recipeSetup(ctx) {
  const n = N();
  const counts = recipeCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const styles = n.recipeStyles;
  const setCount = (type, v) => commit(() => (N().recipeCounts = { ...recipeCounts(), [type]: Math.min(14, Math.max(0, v)) }));
  const addFavorite = (fav, name) => {
    commit(() => {
      const groups = N().recipeGroups ? [...N().recipeGroups] : [];
      const i = groups.findIndex((g) => g.type === fav.type);
      const pick = { id: newId(), tpl: fav.tpl, picks: [...fav.picks], servings: 1 };
      if (i >= 0) groups[i] = { ...groups[i], items: [...groups[i].items, pick] };
      else {
        groups.push({ type: fav.type, items: [pick] });
        groups.sort((a, b) => MEAL_TYPE_IDS.indexOf(a.type) - MEAL_TYPE_IDS.indexOf(b.type));
      }
      N().recipeCounts = { ...recipeCounts(), [fav.type]: groups.find((g) => g.type === fav.type).items.length };
      N().recipeGroups = groups;
    });
    flash(`${name} ajouté à ta sélection`);
  };
  return card(
    h(
      "div.hstack",
      { style: { gap: "8px" } },
      MEAL_TYPE_IDS.map((type) => {
        const v = counts[type] ?? 0;
        return h(
          "div.vstack",
          { style: { flex: 1, alignItems: "center", gap: "6px", padding: "6px 0", background: "var(--field)", borderRadius: "14px", minWidth: 0 }, role: "group", "aria-label": MEAL_TYPES[type].label },
          h("span.caption.secondary.hstack.ellipsis", { style: { gap: "4px", maxWidth: "100%" } }, icon(MEAL_TYPES[type].icon, 13), MEAL_TYPES[type].label),
          h(
            "div.hstack.subheadline.semibold",
            h("button.accent", { type: "button", "aria-label": "Moins", disabled: v <= 0, style: { width: "40px", height: "40px", opacity: v <= 0 ? 0.3 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }, onclick: () => setCount(type, v - 1) }, icon("minus", 16)),
            h("span.display.mono", { style: { fontSize: "20px", minWidth: "22px", textAlign: "center" } }, String(v)),
            h("button.accent", { type: "button", "aria-label": "Plus", disabled: v >= 14, style: { width: "40px", height: "40px", opacity: v >= 14 ? 0.3 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }, onclick: () => setCount(type, v + 1) }, icon("plus", 16))
          )
        );
      })
    ),
    h(
      "div.scroll-x",
      { style: { margin: "14px -18px", padding: "0 18px", gap: "8px" } },
      chip("Tout", styles.length === 0, () => commit(() => (N().recipeStyles = []))),
      STYLES.map(([id, label]) => chip(label, styles.includes(id), () => commit(() => (N().recipeStyles = styles.includes(id) ? styles.filter((x) => x !== id) : [...styles, id])))),
      n.favorites.map((fav) => {
        const tpl = recipeTpl(fav.tpl);
        return tpl && chip(tpl.name, false, () => addFavorite(fav, tpl.name), "starFill");
      })
    ),
    h("button.btn.primary", { type: "button", disabled: total === 0, style: { opacity: total === 0 ? 0.5 : 1 }, onclick: () => { session.editingRecipe = null; commit(() => newRecipes()); } }, icon("sparkles"), `Proposer ${total} recette${total > 1 ? "s" : ""}`)
  );
}

function recipeCard(ctx, gi, index) {
  const n = N();
  const g = n.recipeGroups[gi];
  const pick = g.items[index];
  const s = settings();
  const built = build(s, pick, typeTarget(g.type, s));
  if (!built) return null;
  const key = recipeKey(gi, index);
  const editing = session.editingRecipe === key;
  const isFav = n.favorites.some((f) => f.tpl === pick.tpl);
  const openKey = "recipe-" + pick.id;
  const open = session.open.has(openKey) || editing;
  const toggle = () => {
    if (session.open.has(openKey)) session.open.delete(openKey);
    else session.open.add(openKey);
    ctx.refresh();
  };
  const change = () => {
    const fresh = drawRecipes(1, g.type, g.items.map((x) => x.tpl))[0];
    if (!fresh) return;
    fresh.servings = pick.servings;
    session.editingRecipe = null;
    commit(() => (N().recipeGroups[gi].items[index] = fresh));
  };
  const toggleFav = () => commit(() => (N().favorites = isFav ? N().favorites.filter((f) => f.tpl !== pick.tpl) : [...N().favorites, { tpl: pick.tpl, picks: [...pick.picks], type: g.type }]));
  const remove = () => {
    session.editingRecipe = null;
    commit(() => {
      const gr = N().recipeGroups[gi];
      gr.items.splice(index, 1);
      N().planOverrides = {};
      N().recipeCounts = { ...recipeCounts(), [gr.type]: gr.items.length };
    });
  };
  const cook = () => {
    const cart = built.items.filter((it) => it.grams > 0).map((it) => ({ ...productFromFood(it.food), fixed: it.grams }));
    const same = slotTargets(s).filter((x) => x.type === g.type);
    const guess = guessSlot(s);
    session.slotId = (same.find((x) => x.id === guess) || same[0])?.id ?? session.slotId;
    commit(() => (N().cart = cart));
    session.doses = solve(cart, remaining(session.slotId));
    session.page = "today";
    ctx.refresh();
    window.scrollTo(0, 0);
  };
  const t = built.totals;
  const macro = (value, label, color) => h("div.vstack", { style: { gap: "1px" } }, h("span.subheadline.bold", { style: { color, fontFamily: "var(--rounded)" } }, value), h("span.caption2.secondary", label));
  const ingredient = (it) => {
    const ch = choices(s, built.template.parts[it.part]);
    const name =
      editing && ch.length > 1
        ? picker(ch.map((f) => [f.id, f.name + (prefFood(s, f) === 1 ? " ♥" : "")]), it.food.id, (id) => commit(() => { const picks = [...built.picks]; picks[it.part] = id; N().recipeGroups[gi].items[index].picks = picks; }), { accent: true, label: "Changer d'ingrédient" })
        : [h("span.subheadline", it.food.name), prefFood(s, it.food) === 1 && h("span", { style: { color: "var(--pink)", display: "inline-flex" } }, icon("heartFill", 11))];
    return h(
      "div.hstack",
      { style: { gap: "10px" } },
      gradeBadge(grade(scoreFood(s, it.food).value), 20),
      name,
      h("span.spacer"),
      h("div.vstack", { style: { alignItems: "flex-end" } }, h("span.subheadline.semibold", { style: { fontFamily: "var(--rounded)" } }, `${int(it.grams)} g`), it.food.unit && it.grams > 0 && h("span.caption2.secondary", `${num(it.grams / it.food.unit.grams, 1)} ${unitLabel(it.food.unit, it.grams / it.food.unit.grams)}`))
    );
  };
  return h(
    "div.vstack",
    { style: { gap: "14px", padding: "12px 0" } },
    h(
      "div.hstack",
      { style: { gap: "12px" } },
      h(
        "button.grow.hstack",
        { type: "button", style: { gap: "12px", textAlign: "left" }, "aria-expanded": String(open), onclick: toggle },
        h("div.grow.vstack", { style: { gap: "3px" } }, h("span.hstack", { style: { gap: "6px" } }, h("span.headline", built.template.name), isFav && h("span", { style: { color: "var(--yellow)", display: "inline-flex" } }, icon("starFill", 12))), h("span.caption.secondary", `${built.template.minutes} min · ${rnd(t.kcal)} kcal · ${rnd(t.p)} g prot.${pick.servings > 1 ? ` · ×${pick.servings}` : ""}`)),
        h("span.tertiary", { style: { display: "inline-flex", transform: open ? "rotate(180deg)" : null, transition: "transform .2s" } }, icon("chevronDown", 16))
      ),
      h("button.icon-btn.sm", { type: "button", "aria-label": "Options", onclick: () => menu([{ label: "Changer de recette", icon: "swap", onClick: change }, { label: isFav ? "Retirer des favoris" : "Ajouter aux favoris", icon: "star", onClick: toggleFav }, { label: "Supprimer", icon: "trash", destructive: true, onClick: remove }], { title: built.template.name }) }, icon("ellipsis"))
    ),
    open &&
      h(
        "div.vstack.fade-in",
        { style: { gap: "14px" } },
        h("div.hstack", { style: { gap: "6px" } }, built.template.tags.map((tag) => STYLES.find((x) => x[0] === tag)).filter(Boolean).map(([, label]) => h("span.tag", { style: { color: "var(--accent)", background: "var(--accent-soft)" } }, label))),
        h("div.hstack", { style: { gap: "14px" } }, macro(String(rnd(t.kcal)), "kcal", MACRO_COLORS.kcal), macro(`${rnd(t.p)} g`, "Prot.", MACRO_COLORS.p), macro(`${rnd(t.c)} g`, "Gluc.", MACRO_COLORS.c), macro(`${rnd(t.f)} g`, "Lip.", MACRO_COLORS.f)),
        h("div.vstack", { style: { gap: "8px" } }, built.items.filter((it) => it.grams > 0 || editing).map(ingredient)),
        pick.servings > 1 && h("p.footnote.secondary", `Quantités pour 1 portion · à faire ${pick.servings} fois (les courses comptent les ${pick.servings}).`),
        h("p.subheadline", { style: { padding: "12px", background: "var(--field)", borderRadius: "14px" } }, built.steps),
        h("div.hstack", h("span.subheadline.semibold.grow", `Portions : ${pick.servings}`), stepper(pick.servings, (v) => commit(() => (N().recipeGroups[gi].items[index].servings = Math.min(14, Math.max(1, v)))), { min: 1, max: 14, label: "Portions" })),
        h("div.btn-row", h("button.btn.plain.auto", { type: "button", onclick: () => { session.editingRecipe = editing ? null : key; ctx.refresh(); } }, editing ? "Terminé" : "Modifier"), h("button.btn.primary", { type: "button", style: { flex: 1 }, onclick: cook }, icon("pan"), "Je cuisine ça"))
      )
  );
}

function recipeWeek(ctx) {
  const n = N();
  const s = settings();
  const t = recipeTotals();
  const groups = n.recipeGroups || [];
  const servings = groups.reduce((a, g) => a + g.items.reduce((b, i) => b + i.servings, 0), 0);
  const p = plan();
  const options = (type) => groups.flatMap((g, gi) => (g.type === type ? g.items.map((it, i) => [recipeKey(gi, i), recipeTpl(it.tpl)?.name ?? ""]) : []));
  const dayName = (d) => (d.offset === 0 ? "Aujourd'hui" : d.offset === 1 ? "Demain" : capitalized(fmtDate(d.date, { weekday: "long" })));
  return card(
    cardTitle("Courses et semaine", "basket"),
    h("p.caption.secondary", { style: { margin: "2px 0 6px" } }, `${servings} portion${servings > 1 ? "s" : ""} · ${t.length} produit${t.length > 1 ? "s" : ""}`),
    h("div.divider"),
    disclosure(
      session.open,
      "rec-groceries",
      h("span.subheadline.semibold.hstack", { style: { gap: "8px" } }, icon("basket", 18), "Ingrédients à acheter"),
      h("div.vstack", { style: { gap: "8px", paddingTop: "8px" } }, t.map((x) => h("div.hstack", { style: { gap: "10px" } }, gradeBadge(grade(scoreFood(s, x.food).value), 20), h("span.subheadline", x.food.name), x.recipes > 1 && h("span.caption2.secondary", `×${x.recipes}`), h("span.spacer"), h("span.subheadline.semibold", { style: { fontFamily: "var(--rounded)" } }, weightText(x.grams)))))
    ),
    h("div.divider"),
    disclosure(
      session.open,
      "rec-plan",
      h("span.subheadline.semibold.hstack", { style: { gap: "8px" } }, icon("calendar", 18), "Ma semaine"),
      h(
        "div.vstack",
        p.days.map((d) => [
          h("span.subheadline.semibold", { style: { paddingTop: "10px", color: d.offset === 0 ? "var(--accent)" : "var(--secondary)" } }, dayName(d)),
          d.cells.map((c) => h("div.hstack.subheadline", { style: { minHeight: "36px" } }, h("span.grow", c.slot.label), picker([["", "Libre"], ...options(c.slot.type)], c.key, (v) => commit(() => (N().planOverrides[c.id] = v)), { accent: true, label: c.slot.label }))),
        ]),
        p.extra > 0 && h("p.footnote.hstack", { style: { gap: "6px", color: "var(--orange)", paddingTop: "10px" } }, icon("exclamation", 16), `${p.extra} portion${p.extra > 1 ? "s" : ""} en trop pour la semaine.`),
        Object.keys(n.planOverrides).length > 0 && h("button.subheadline.semibold.accent", { type: "button", style: { paddingTop: "10px", alignSelf: "flex-start" }, onclick: () => commit(() => (N().planOverrides = {})) }, "Répartir automatiquement")
      )
    ),
    h(
      "div",
      { style: { marginTop: "6px" } },
      primaryButton("Tout envoyer à ma liste", () => {
        let k = 0;
        commit(() => (k = sendRecipesToList()));
        session.page = "groceries";
        flash(`${k} produits envoyés à ta liste de courses`);
        window.scrollTo(0, 0);
      }, "cartPlus")
    )
  );
}

// MARK: Stats

function statsPage(ctx) {
  const n = N();
  const period = n.statPeriod || 7;
  const weights = weightsByDay();
  const s = settings();
  const t = baseTargets(s);
  const tdee = s.manual.on ? null : computedTargets(s).tdee;
  const all = dayStats(period, weights);
  const logged = all.filter((d) => d.logged);
  const head = segmented([[7, "7 jours"], [30, "30 jours"], [90, "3 mois"]], period, (v) => commit(() => (N().statPeriod = v)), { label: "Période" });
  if (!logged.length && !all.some((d) => d.weight != null)) return [head, emptyCard("chartBar", "Pas encore de données", "Note tes repas dans Aujourd'hui : tes stats apparaîtront ici dès le premier jour.")];
  const avg = logged.length ? KEYS.reduce((a, k) => ({ ...a, [k]: logged.reduce((x, d) => x + d.macros[k], 0) / logged.length }), {}) : { kcal: 0, p: 0, c: 0, f: 0 };
  const on = all.filter((d) => onTarget(d, t)).length;
  const ws = all.filter((d) => d.weight != null);
  const half = Math.min(7, Math.trunc(period / 2));
  const wa = all.slice(0, half).map((d) => d.weight).filter((x) => x != null), wb = all.slice(-half).map((d) => d.weight).filter((x) => x != null);
  const mean = (l) => l.reduce((a, b) => a + b, 0) / l.length;
  const dW = period >= 14 && wa.length >= 2 && wb.length >= 2 ? mean(wb) - mean(wa) : ws.length >= 2 ? ws[ws.length - 1].weight - ws[0].weight : null;
  const deficit = tdee != null && logged.length ? tdee - avg.kcal : null;
  const fatKg = ((deficit ?? 0) * logged.length) / 7700;
  const long = dayStats(98, weights);
  const streaks = (() => {
    let best = 0, run = 0;
    for (const d of long) {
      run = onTarget(d, t) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    let current = 0;
    for (let i = long.length - 1; i >= 0; i--) {
      if (onTarget(long[i], t)) current++;
      else if (i < long.length - 1 || long[i].logged) break;
    }
    return { current, best };
  })();
  const metric = (value, label, tint) => h("div.vstack", { style: { gap: "2px", minWidth: 0 } }, h("span.display.ellipsis", { style: { fontSize: "24px", color: tint } }, value), h("span.caption.secondary.clamp2", label));
  const averages = card(
    cardTitle("Moyennes", "chart"),
    h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px", margin: "4px 0 14px" } },
      metric(logged.length ? String(rnd(avg.kcal)) : "—", `kcal / jour · cible ${int(t.kcal)}`, MACRO_COLORS.kcal),
      metric(logged.length ? `${rnd(avg.p)} g` : "—", `protéines / jour · cible ${int(t.p)} g`, MACRO_COLORS.p),
      metric(`${on}/${logged.length}`, `jours dans la cible · ${logged.length} notés sur ${period}`, "var(--green)"),
      metric(dW != null ? (dW > 0 ? "+" : "") + kgText(dW) : "—", dW == null ? "pas assez de pesées" : ws.length ? `poids · ${kgText(ws[ws.length - 1].weight)}` : "poids", "var(--indigo)")
    ),
    h("div.divider"),
    h(
      "div.vstack.footnote.secondary",
      { style: { gap: "4px", marginTop: "12px" } },
      deficit != null && h("span.hstack", { style: { gap: "6px" } }, icon("arrowDown", 14), deficit > 0 ? `Déficit moyen ${rnd(deficit)} kcal / j · ≈ ${kgText(fatKg)} de gras` : `Surplus moyen ${rnd(-deficit)} kcal / j`),
      h("span.hstack", { style: { gap: "6px" } }, icon("flame", 14), `Série : ${streaks.current} jour${streaks.current > 1 ? "s" : ""} dans la cible · record ${streaks.best}`)
    )
  );

  ctx.local.protein ??= false;
  const showP = ctx.local.protein;
  const target = showP ? t.p : t.kcal;
  const tint = showP ? MACRO_COLORS.p : MACRO_COLORS.kcal;
  const unit = showP ? "g" : "kcal";
  const val = (m) => (showP ? m.p : m.kcal);
  let bars;
  if (period > 30) {
    bars = [];
    for (let k = 0; k < all.length; k += 7) {
      const chunk = all.slice(k, k + 7);
      const lg = chunk.filter((d) => d.logged);
      bars.push({ value: lg.length ? lg.reduce((a, d) => a + val(d.macros), 0) / lg.length : 0, hi: lg.length > 0 });
    }
  } else bars = all.map((d) => ({ value: val(d.macros), hi: onTarget(d, t) }));
  const chart = card(
    h("div.hstack", cardTitle(period > 30 ? "Par semaine" : "Par jour", "chartBar", tint), h("span.spacer"), segmented([[false, "kcal"], [true, "Protéines"]], showP, (v) => { ctx.local.protein = v; ctx.refresh(); }, { label: "Mesure" })),
    h("div", { style: { margin: "12px 0" } }, barChart(bars.map((b) => b.value), { height: 170, color: tint, opacities: bars.map((b) => (b.hi ? 1 : 0.35)), rule: target, ruleLabel: `cible ${int(target)} ${unit}`, max: Math.max(target * 1.25, ...bars.map((b) => b.value), 1) })),
    h("p.caption.secondary", period > 30 ? "Moyenne par jour, semaine par semaine. Barre foncée = semaine notée." : "Barre foncée = jour dans la cible.")
  );

  const parts = [["Prot.", avg.p * 4, MACRO_COLORS.p], ["Gluc.", avg.c * 4, MACRO_COLORS.c], ["Lip.", avg.f * 9, MACRO_COLORS.f]];
  const sum = Math.max(parts.reduce((a, x) => a + x[1], 0), 1);
  const count = Math.max(1, rnd(period / 7));
  const rows = Array.from({ length: count }, (_, k) => {
    const chunk = long.slice(long.length - 7 * (k + 1), long.length - 7 * k);
    const lg = chunk.filter((d) => d.logged);
    const w = chunk.map((d) => d.weight).filter((x) => x != null);
    return { from: chunk[0].day, kcal: lg.length ? mean(lg.map((d) => d.macros.kcal)) : null, p: lg.length ? mean(lg.map((d) => d.macros.p)) : null, on: chunk.filter((d) => onTarget(d, t)).length, weight: w.length ? mean(w) : null };
  });
  const cellS = { padding: "4px 6px 4px 0" };
  const split = card(
    cardTitle("Répartition des calories", "pie", MACRO_COLORS.kcal),
    h("div.hstack", { style: { gap: "3px", height: "12px", margin: "12px 0" } }, parts.map(([, v, c]) => h("i", { style: { height: "12px", borderRadius: "6px", width: Math.max(0, (v / sum) * 100) + "%", background: c } }))),
    h("div.hstack.wrap", { style: { gap: "16px" } }, parts.map(([l, v, c]) => h("span.hstack.subheadline", { style: { gap: "6px" } }, h("i", { style: { width: "8px", height: "8px", borderRadius: "50%", background: c } }), `${l} ${rnd((v / sum) * 100)} %`))),
    h("div.divider", { style: { margin: "12px 0 4px" } }),
    disclosure(
      session.open,
      "stat-weeks",
      h("span.subheadline.semibold.hstack", { style: { gap: "8px" } }, icon("table", 18), "Semaine par semaine"),
      h(
        "div",
        { style: { paddingTop: "8px" } },
        h(
          "table",
          { style: { width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" } },
          h("thead", h("tr", ["Semaine", "kcal", "Prot.", "Cible", "Poids"].map((x) => h("th.caption.semibold.secondary", { style: { ...cellS, textAlign: "left" } }, x)))),
          h(
            "tbody.subheadline",
            rows.map((r) => {
              const d = keyDate(r.from);
              return h("tr", { style: { borderTop: "0.5px solid var(--separator)" } }, h("td", { style: cellS }, `du ${fmtDate(d, { day: "2-digit", month: "2-digit" })}`), h("td", { style: cellS }, r.kcal != null ? String(rnd(r.kcal)) : "—"), h("td", { style: cellS }, r.p != null ? `${rnd(r.p)} g` : "—"), h("td", { style: cellS }, `${r.on}/7`), h("td", { style: cellS }, r.weight != null ? kgText(r.weight) : "—"));
            })
          )
        ),
        h("p.caption.secondary", { style: { marginTop: "10px" } }, "Dans la cible = calories entre 90 et 105 % de ta cible et protéines ≥ 90 %.")
      )
    )
  );
  return [head, averages, chart, split];
}

// MARK: Settings

export function nutritionSettings(ctx) {
  const n = N();
  const st = n.settings;
  const set = (fn) => commit(() => fn(N().settings));
  const breakdown = computedTargets(st);
  const targets = baseTargets(st);
  const loss = Math.max(0, ((breakdown.tdee - targets.kcal) * 7) / 7700);
  const pill = (value, label, color) => h("div.vstack", { style: { flex: 1, alignItems: "center", gap: "2px" } }, h("span.headline", { style: { color, fontFamily: "var(--rounded)" } }, value), h("span.caption.secondary", label));
  const nameEl = input({ value: st.profile.name, placeholder: "Prénom", attrs: { autocomplete: "given-name", "data-fid": "n-name" }, onCommit: (v) => set((s) => (s.profile.name = v)) });
  const sk = st.slots.reduce((a, x) => a + x.pk, 0), sp = st.slots.reduce((a, x) => a + x.pp, 0);
  const pct = (slot, key, label) =>
    h("div.vstack", { style: { alignItems: "center" } }, h("span.hstack", { style: { gap: "1px" } }, input({ type: "number", value: slot[key], align: "right", attrs: { style: "width: 38px", "data-fid": `slot-${slot.id}-${key}`, "aria-label": `${label} en %` }, onCommit: (v) => v != null && set((s) => (s.slots.find((x) => x.id === slot.id)[key] = Math.max(0, v))) }), h("span.secondary", "%")), h("span.caption2.secondary", label));
  const likes = Object.values(st.prefs).filter((v) => v === 1).length, dislikes = Object.values(st.prefs).filter((v) => v === -1).length;
  const importPortion = (result) =>
    confirm("Remplacer tes données nutrition ?", `La sauvegarde contient ${result.days} jours de repas et ${Object.keys(result.weights).length} pesées. Les pesées s'ajoutent à celles de l'app.`, "Importer", () => {
      commit(() => {
        S.nutrition = result.state;
        mergeWeights(result.weights);
      });
      alert("Données Portion importées.");
    }, { destructive: false });
  const fromFile = () => {
    const el = h("input", { type: "file", accept: "application/json,.json", style: { display: "none" } });
    el.addEventListener("change", async () => {
      const f = el.files?.[0];
      el.remove();
      if (!f) return;
      try {
        const root = JSON.parse(await f.text());
        if (!root || typeof root.all !== "object") throw new Error();
        importPortion(readPortion(root.all));
      } catch {
        alert("Ce fichier n'est pas une sauvegarde Portion.");
      }
    });
    document.body.append(el);
    el.click();
  };
  const fromBrowser = async () => {
    const all = await portionInBrowser();
    if (!all) return alert("Aucune donnée Portion dans ce navigateur", "Ouvre l'ancienne page Portion dans ce même navigateur, ou importe son fichier de sauvegarde.");
    importPortion(readPortion(all));
  };
  return {
    title: "Nutrition",
    right: okBtn(ctx),
    body: [
      section(
        { header: "Profil" },
        h("label.cell", nameEl),
        h("div.cell", { style: { display: "block" } }, segmented([["m", "Homme"], ["f", "Femme"]], st.profile.sex, (v) => set((s) => (s.profile.sex = v)), { label: "Sexe" })),
        numberCell("Âge", st.profile.age, (v) => set((s) => (s.profile.age = v)), { unit: "ans", digits: 0 }),
        numberCell("Taille", st.profile.height, (v) => set((s) => (s.profile.height = v)), { unit: "cm", digits: 0 }),
        numberCell("Poids", st.profile.weight, (v) => set((s) => (s.profile.weight = v)), { unit: "kg", digits: 1 }),
        pickerCell("Activité", ACTIVITY_LABELS.map((l, i) => [i, l]), st.profile.act, (v) => set((s) => (s.profile.act = v))),
        pickerCell("Objectif", GOAL_LABELS.map((l, i) => [i, l]), st.profile.goal, (v) => set((s) => (s.profile.goal = v))),
        numberCell("Protéines", st.profile.protKg, (v) => set((s) => (s.profile.protKg = v)), { unit: "g / kg", digits: 2 }),
        numberCell("Lipides minimum", st.profile.fatKg, (v) => set((s) => (s.profile.fatKg = v)), { unit: "g / kg", digits: 2 })
      ),
      section(
        { header: "Mes cibles", footer: "Calculées avec la formule de Mifflin-St Jeor. Chaque semaine, ta tendance de poids corrige les calories de 100 kcal si besoin." },
        !st.manual.on && [cell({ label: "Métabolisme de base", value: `${rnd(breakdown.bmr)} kcal` }), cell({ label: "Dépense du jour", value: `${rnd(breakdown.tdee)} kcal` })],
        cell({ label: "Objectif calories", sub: loss > 0.05 ? `≈ ${kgText(loss)} par semaine` : null, trailing: h("span.headline", `${int(targets.kcal)} kcal`) }),
        st.adj.kcal !== 0 && !st.manual.on && cell({ label: "Ajustement auto (poids)", trailing: h("span.hstack", { style: { gap: "10px" } }, h("span.secondary", `${st.adj.kcal > 0 ? "+" : ""}${int(st.adj.kcal)} kcal`), h("button.accent", { type: "button", onclick: () => set((s) => (s.adj = { kcal: 0 })) }, "Remettre à 0")) }),
        h("div.cell", pill(`${int(targets.p)} g`, "Prot.", MACRO_COLORS.p), pill(`${int(targets.c)} g`, "Gluc.", MACRO_COLORS.c), pill(`${int(targets.f)} g`, "Lip.", MACRO_COLORS.f)),
        toggleCell("Fixer mes cibles à la main", st.manual.on, (on) => set((s) => {
          if (on) {
            const c = computedTargets(s).targets;
            s.manual = { on: true, kcal: c.kcal, p: c.p, c: c.c, f: c.f };
          } else s.manual.on = false;
        })),
        st.manual.on && [
          numberCell("Calories", st.manual.kcal, (v) => set((s) => (s.manual.kcal = v)), { unit: "kcal", digits: 0 }),
          numberCell("Protéines", st.manual.p, (v) => set((s) => (s.manual.p = v)), { unit: "g", digits: 0 }),
          numberCell("Glucides", st.manual.c, (v) => set((s) => (s.manual.c = v)), { unit: "g", digits: 0 }),
          numberCell("Lipides", st.manual.f, (v) => set((s) => (s.manual.f = v)), { unit: "g", digits: 0 }),
        ]
      ),
      section(
        { header: "Mes repas", footer: sk !== 100 || sp !== 100 ? h("span", { style: { color: "var(--orange)" } }, `Les parts doivent faire 100 % (calories : ${int(sk)} %, protéines : ${int(sp)} %). Je normalise automatiquement.`) : "Part des calories et des protéines de la journée pour chaque repas. Glisse vers la gauche pour supprimer." },
        st.slots.map((slot, i) =>
          swipe(
            h("div.cell", picker(MEAL_TYPE_IDS.map((t) => [t, MEAL_TYPES[t].label]), slot.type, (v) => set((s) => (s.slots[i].type = v)), { accent: true, label: "Type" }), h("span.spacer"), pct(slot, "pk", "kcal"), pct(slot, "pp", "prot."), h("span.hstack", { style: { flexDirection: "column", marginLeft: "4px" } }, h("button.secondary", { type: "button", "aria-label": "Monter", disabled: i === 0, style: { opacity: i === 0 ? 0.25 : 1 }, onclick: () => set((s) => s.slots.splice(i - 1, 0, s.slots.splice(i, 1)[0])) }, icon("arrowUp", 14)), h("button.secondary", { type: "button", "aria-label": "Descendre", disabled: i === st.slots.length - 1, style: { opacity: i === st.slots.length - 1 ? 0.25 : 1 }, onclick: () => set((s) => s.slots.splice(i + 1, 0, s.slots.splice(i, 1)[0])) }, icon("arrowDown", 14)))),
            { onDelete: st.slots.length > 1 ? () => set((s) => s.slots.splice(i, 1)) : null }
          )
        ),
        cell({ label: "Ajouter un repas", lead: h("span.lead-icon.accent", icon("plus")), action: true, onClick: () => set((s) => s.slots.push({ id: `s${Date.now()}`, type: "snack", pk: 10, pp: 10 })) }),
        slotTargets().map((x) => cell({ label: x.label, value: h("span.caption.mono", `${int(x.target.kcal)} kcal · P ${int(x.target.p)} · G ${int(x.target.c)} · L ${int(x.target.f)}`) }))
      ),
      section(
        { header: "Mon régime" },
        Object.entries(DIETS).map(([id, d]) => cell({ label: d.label, sub: d.detail, onClick: () => set((s) => (s.diet.type = id)), trailing: st.diet.type === id ? h("span.accent", icon("check")) : null })),
        st.diet.type !== "veg" && st.diet.type !== "vegan" && [
          toggleCell("Sans produits de la mer", !!st.diet.seafood, (v) => set((s) => (s.diet.seafood = v))),
          st.diet.seafood && toggleCell("…sauf le thon en boîte", !!st.diet.tuna, (v) => set((s) => (s.diet.tuna = v))),
        ]
      ),
      section(
        { footer: "Les aliments que tu n'aimes pas disparaissent des suggestions, ceux que tu aimes passent en premier, y compris dans les recettes." },
        cell({ label: "Mes goûts", value: `${likes} aimés · ${dislikes} évités`, chevron: true, onClick: () => ctx.push(tastesView) }),
        pickerCell("Devise", ["€", "$", "£"].map((c) => [c, c]), st.currency, (v) => set((s) => (s.currency = v)))
      ),
      section(
        { header: "Données", footer: "Exporte d'abord tes données depuis Portion (Réglages > Mes données > Exporter), puis importe le fichier ici. Si tu utilisais Portion dans ce navigateur, tu peux aussi les reprendre directement. La sauvegarde de Musculation inclut aussi la nutrition." },
        cell({ label: "Reprendre Portion depuis ce navigateur", lead: h("span.lead-icon.accent", icon("download")), action: true, onClick: fromBrowser }),
        cell({ label: "Importer une sauvegarde Portion", lead: h("span.lead-icon.accent", icon("importDoc")), action: true, onClick: fromFile }),
        cell({ label: "Effacer le journal du jour", lead: h("span.lead-icon", icon("eraser")), destructive: true, onClick: () => { commit(() => delete N().logs[dayKey()]); alert("Journal du jour effacé."); } }),
        cell({ label: "Réinitialiser la nutrition", lead: h("span.lead-icon", icon("trash")), destructive: true, onClick: () => confirm("Tout réinitialiser ?", "Profil, repas, courses et recettes seront effacés. Tes pesées restent dans l'app.", "Réinitialiser", () => { session.doses = null; closeScanned(); commit(() => (S.nutrition = defaultNutrition())); }) })
      ),
    ],
  };
}

function tastesView(ctx) {
  ctx.local.q ??= "";
  const results = h("div");
  const setPref = (f, v) => {
    commit(() => {
      const p = N().settings.prefs;
      if (p[f.id] === v) delete p[f.id];
      else p[f.id] = v;
    });
  };
  const row = (f, s) => {
    const v = prefFood(s, f);
    return h(
      "div.cell",
      h("div.cell-label", h("span", f.name), h("span.footnote.secondary", AISLES[f.fam].label)),
      h("button.icon-btn.sm", { type: "button", "aria-label": "J'aime", "aria-pressed": String(v === 1), style: { color: v === 1 ? "var(--green)" : "var(--secondary)" }, onclick: () => { setPref(f, 1); fill(); } }, icon("thumbUp")),
      h("button.icon-btn.sm", { type: "button", "aria-label": "J'aime pas", "aria-pressed": String(v === -1), style: { color: v === -1 ? "var(--red)" : "var(--secondary)" }, onclick: () => { setPref(f, -1); fill(); } }, icon("thumbDown"))
    );
  };
  const fill = () => {
    const s = N().settings;
    const visible = ND.foods.filter((f) => excluded(s, productFromFood(f)) == null);
    const q = normalized(ctx.local.q.trim());
    if (!q) {
      const likes = visible.filter((f) => prefFood(s, f) === 1), dislikes = visible.filter((f) => prefFood(s, f) === -1);
      const text = () => {
        const names = (v) => ND.foods.filter((f) => prefFood(s, f) === v).map((f) => f.name).join(", ");
        let diet = DIETS[s.diet.type].label;
        if (s.diet.seafood && s.diet.type !== "veg" && s.diet.type !== "vegan") diet += ", sans produits de la mer" + (s.diet.tuna ? " sauf le thon en boîte" : "");
        return `Mon régime : ${diet}\nJ'aime : ${names(1) || "—"}\nJe n'aime pas : ${names(-1) || "—"}`;
      };
      results.replaceChildren(
        ...[
          !likes.length && !dislikes.length && h("p.subheadline.secondary", { style: { margin: "0 16px 22px" } }, "Rien de noté pour l'instant. Cherche un aliment ci-dessus."),
          likes.length && section({ header: "Tu aimes" }, likes.map((f) => row(f, s))),
          dislikes.length && section({ header: "Tu n'aimes pas" }, dislikes.map((f) => row(f, s))),
          section(
            { footer: "Colle-les dans une conversation avec Claude pour qu'il te propose des repas à ton goût." },
            cell({
              label: "Copier mes goûts pour Claude",
              lead: h("span.lead-icon.accent", icon("copy")),
              action: true,
              onClick: async () => {
                try {
                  await navigator.clipboard.writeText(text());
                  toast("Copié !");
                } catch {
                  prompt("Mes goûts", { value: text(), onSubmit: () => {} });
                }
              },
            })
          ),
        ].filter(Boolean)
      );
    } else {
      const hits = visible.filter((f) => normalized(f.name).includes(q) || normalized(AISLES[f.fam].label).includes(q)).slice(0, 40);
      results.replaceChildren(hits.length ? section({}, hits.map((f) => row(f, s))) : emptyState("search", `Aucun résultat pour « ${ctx.local.q} »`, "Vérifie l'orthographe ou essaie un autre mot."));
    }
  };
  fill();
  return {
    title: "Mes goûts",
    body: [h("div", { style: { marginBottom: "16px" } }, searchField(ctx.local.q, "Chercher un aliment", (v) => { ctx.local.q = v; fill(); })), results],
  };
}

// MARK: Food search

function foodSearch(ctx) {
  const onPick = ctx.props.onPick;
  ctx.local.q ??= "";
  const results = h("div");
  let timer = null, seq = 0;
  const row = (p, s) =>
    h(
      "button.cell",
      { type: "button", onclick: () => { ctx.close(); onPick(p); } },
      productThumb(p, { g: grade(score(s, p).value), size: 40 }),
      h("div.cell-label", h("span.clamp2", p.name), h("span.footnote.secondary", [p.brand, `${rnd(p.n.kcal)} kcal`, `P ${rnd(p.n.p)} g`].filter(Boolean).join(" · ")))
    );
  const render = (off) => {
    const s = settings();
    const q = ctx.local.q.trim();
    if (q.length < 2) return results.replaceChildren(emptyState("search", "Cherche un aliment", "Par exemple « skyr », « riz basmati » ou une marque."));
    const basics = ND.foods.filter((f) => normalized(f.name).includes(normalized(q)) && allowed(s, f)).slice(0, 8);
    results.replaceChildren(
      ...[
        basics.length && section({ header: "Aliments de base" }, basics.map((f) => row(productFromFood(f), s))),
        section(
          { header: "Open Food Facts", footer: "Valeurs pour 100 g, données ouvertes et collaboratives." },
          off.loading && !off.items.length ? h("div.cell.secondary", "Recherche…") : off.error ? h("div.cell.secondary", off.error) : !off.items.length ? h("div.cell.secondary", "Aucun produit trouvé.") : null,
          off.items.map((p) => row(p, s))
        ),
      ].filter(Boolean)
    );
  };
  const search = () => {
    clearTimeout(timer);
    const q = ctx.local.q.trim();
    const my = ++seq;
    if (q.length < 2) return render({ items: [] });
    render({ items: [], loading: true });
    timer = setTimeout(async () => {
      try {
        const items = await offSearch(q);
        if (my === seq) render({ items });
      } catch (e) {
        if (my === seq) render({ items: [], error: e?.message });
      }
    }, 450);
  };
  search();
  return {
    title: "Rechercher",
    left: barBtn("Fermer", () => ctx.close()),
    search: searchField(ctx.local.q, "Aliment ou marque", (v) => { ctx.local.q = v; search(); }, { autofocus: true }),
    body: results,
  };
}

// MARK: Barcode scanner

let qrLib = null;
function loadQR() {
  qrLib ??= new Promise((res, rej) => {
    if (window.Html5Qrcode) return res(window.Html5Qrcode);
    const sc = document.createElement("script");
    sc.src = "vendor/html5-qrcode.min.js";
    sc.onload = () => res(window.Html5Qrcode);
    sc.onerror = () => {
      qrLib = null;
      rej(new Error("Scanner indisponible hors connexion."));
    };
    document.head.append(sc);
  });
  return qrLib;
}

let activeScan = null;
async function stopScanner() {
  const a = activeScan;
  activeScan = null;
  if (!a) return;
  try {
    await a.stop();
  } catch {}
}

function scanner(ctx) {
  const onCode = ctx.props.onCode;
  const done = (code) => {
    if (ctx.local.done) return;
    ctx.local.done = true;
    haptic([10, 40, 10]);
    stopScanner();
    ctx.close();
    onCode(code);
  };
  const typeCode = () =>
    prompt("Code-barres", { placeholder: "3017620422003", numeric: true, decimal: false, action: "Chercher", onSubmit: (v) => { const c = String(v ?? "").replace(/\D/g, ""); if (c) done(c); } });
  if (ctx.local.view && ctx.local.view.isConnected) {
    return { title: "Scanner", left: barBtn("Annuler", () => { stopScanner(); ctx.close(); }), right: barBtn("", typeCode, { iconName: "keyboard", aria: "Saisir le code" }), body: ctx.local.view };
  }
  const reader = h("div", { id: "scan-reader-" + Date.now() });
  const message = h("div");
  const view = h("div.vstack", { style: { gap: "16px" } }, h("div.scanner", reader, h("div.frame")), h("p.subheadline.semibold.center", { style: { textAlign: "center" } }, "Vise le code-barres du produit"), message);
  ctx.local.view = view;
  const unavailable = () => {
    stopScanner();
    view.replaceChildren(emptyState("photo", "Caméra indisponible", "Autorise la caméra pour ce site dans les réglages de Safari, ou tape le code-barres à la main."), primaryButton("Saisir le code", typeCode, "keyboard"));
  };
  (async () => {
    await stopScanner();
    // Native detector when the browser has it, otherwise the bundled html5-qrcode.
    if ("BarcodeDetector" in window) {
      try {
        const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = h("video", { autoplay: true, playsinline: true, muted: true, style: { width: "100%", display: "block" } });
        video.srcObject = stream;
        reader.append(video);
        let alive = true;
        activeScan = { stop: async () => { alive = false; stream.getTracks().forEach((t) => t.stop()); } };
        const loop = async () => {
          if (!alive || !view.isConnected) return stopScanner();
          try {
            const codes = await det.detect(video);
            if (codes[0]?.rawValue) return done(codes[0].rawValue);
          } catch {}
          setTimeout(loop, 150);
        };
        video.addEventListener("loadeddata", loop, { once: true });
        return;
      } catch (e) {
        if (e?.name === "NotAllowedError") return unavailable();
      }
    }
    try {
      const Q = await loadQR();
      const F = window.Html5QrcodeSupportedFormats;
      const sc = new Q(reader.id, { formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E], verbose: false });
      activeScan = { stop: async () => { try { await sc.stop(); sc.clear(); } catch {} } };
      await sc.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 260, height: 140 } }, (text) => done(text));
      const watch = setInterval(() => {
        if (!view.isConnected) {
          clearInterval(watch);
          stopScanner();
        }
      }, 500);
    } catch {
      unavailable();
    }
  })();
  return {
    title: "Scanner",
    left: barBtn("Annuler", () => { stopScanner(); ctx.close(); }),
    right: barBtn("", typeCode, { iconName: "keyboard", aria: "Saisir le code" }),
    body: view,
  };
}
