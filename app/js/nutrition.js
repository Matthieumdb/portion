// Nutrition: targets, scores, groceries, portion solver, recipes and stats
// (NutritionModels, NutritionEngine, NutritionData, NutritionStore, OpenFoodFacts, PortionImport).
// The state keeps the iPhone app's JSON shape, so the backup goes both ways.
import { S, commit, dayKey } from "./store.js";
import { startOfDay, addDays, DAY } from "./model.js";
import { rnd, int, num, uid } from "./ui.js";

// MARK: Data

export const ND = { foods: [], recipes: [], quick: [], byId: new Map() };
export async function loadNutritionData() {
  try {
    const d = await (await fetch("data/nutrition-data.json")).json();
    Object.assign(ND, d);
  } catch {}
  ND.byId = new Map(ND.foods.map((f) => [f.id, f]));
}
export const food = (id) => (id == null ? null : ND.byId.get(id) || null);
export const recipeTpl = (id) => ND.recipes.find((r) => r.id === id) || null;

export const BUDGETS = {
  viandes: { by: "p", budget: 720, count: 2 }, oeufs: { by: "grams", budget: 660, count: 1 }, laitiers: { by: "p", budget: 190, count: 1 },
  fromages: { by: "grams", budget: 150, count: 1 }, feculents: { by: "c", budget: 1000, count: 3 }, legumes: { by: "grams", budget: 2400, count: 3 },
  fruits: { by: "grams", budget: 1200, count: 2 }, graisses: { by: "f", budget: 120, count: 1 }, sauces: { by: "grams", budget: 450, count: 2 },
  poudre: { by: "grams", budget: 210, count: 1 }, extras: { by: "kcal", budget: 700, count: 1 },
};
export const BASE = { kcal: 2100, p: 180, c: 185, f: 70 };
const AISLE_PRICE = { viandes: 12, oeufs: 4.5, laitiers: 4, fromages: 12, feculents: 2.5, legumes: 3, fruits: 3.5, graisses: 10, sauces: 5, poudre: 28, extras: 10 };
const FOOD_PRICE = { 0: 13, 1: 12, 2: 9, 3: 13, 5: 25, 7: 16, 8: 14, 12: 4, 19: 2.5, 21: 1.8, 22: 2.2, 23: 1.5, 25: 2, 41: 9, 42: 12, 43: 18, 48: 30, 49: 22, 50: 25, 51: 25, 52: 11, 56: 14 };
export const ACTIVITY_FACTORS = [1.2, 1.375, 1.55, 1.725];
export const ACTIVITY_LABELS = ["Sédentaire", "Légèrement actif (1 à 3 séances)", "Modérément actif (3 à 5 séances)", "Très actif (6 à 7 séances)"];
export const GOAL_OFFSETS = [-750, -500, -300, 0, 250];
export const GOAL_LABELS = ["Sèche rapide (−750 kcal)", "Perte de gras (−500 kcal)", "Perte douce (−300 kcal)", "Maintien", "Prise de muscle (+250 kcal)"];
export const VEG_FIXED = 150;
const MAX_GRAMS = 600;

export const AISLES = {
  viandes: { label: "Viandes & volaille", icon: "fish", examples: "poulet, dinde, bœuf haché, porc" },
  oeufs: { label: "Œufs", icon: "egg" },
  laitiers: { label: "Laitiers protéinés", icon: "cup", examples: "skyr, yaourt grec, fromage blanc" },
  fromages: { label: "Fromages", icon: "cheese" },
  feculents: { label: "Féculents", icon: "bag", examples: "riz, pâtes, pommes de terre, avoine" },
  legumes: { label: "Légumes", icon: "carrot", examples: "frais ou surgelés" },
  fruits: { label: "Fruits", icon: "apple" },
  graisses: { label: "Huiles & oléagineux", icon: "drop", examples: "huile, beurre de cacahuète, amandes" },
  sauces: { label: "Sauces & condiments", icon: "flame" },
  poudre: { label: "Protéine en poudre", icon: "bolt" },
  extras: { label: "Plaisirs hors plan", icon: "cake" },
};
export const AISLE_IDS = Object.keys(AISLES);
export const MEAL_TYPES = {
  breakfast: { label: "Petit-déjeuner", icon: "sunrise" },
  meal: { label: "Repas", icon: "fork" },
  snack: { label: "Collation", icon: "carrot" },
};
export const MEAL_TYPE_IDS = Object.keys(MEAL_TYPES);
export const DIETS = {
  omni: { label: "Omnivore", detail: "Tu manges de tout." },
  pesc: { label: "Pescétarien", detail: "Pas de viande, mais poisson et fruits de mer." },
  veg: { label: "Végétarien", detail: "Ni viande ni poisson." },
  vegan: { label: "Végan", detail: "Aucun produit animal." },
  nopork: { label: "Sans porc", detail: "Tout sauf le porc." },
};
export const STYLES = [["h", "Healthy"], ["g", "Gourmand"], ["q", "Rapide"], ["b", "Batch cooking"], ["w", "Saveurs du monde"]];
export const MACRO_COLORS = { kcal: "var(--orange)", p: "var(--blue)", c: "var(--carbs)", f: "var(--pink)" };

// MARK: State

export function defaultSettings() {
  return {
    profile: { name: "", sex: "m", age: 30, height: 178, weight: 78, act: 1, goal: 1, protKg: 2, fatKg: 0.8 },
    manual: { on: false, kcal: 2100, p: 180, c: 185, f: 70 },
    slots: [{ id: "s1", type: "meal", pk: 43, pp: 39 }, { id: "s2", type: "snack", pk: 14, pp: 22 }, { id: "s3", type: "meal", pk: 43, pp: 39 }],
    diet: { type: "omni", seafood: true, tuna: true },
    prefs: {},
    adj: { kcal: 0 },
    currency: "€",
  };
}
export function defaultNutrition() {
  return { settings: defaultSettings(), logs: {}, cart: [], shopList: [], variety: {}, recipeStyles: [], recipeSeen: [], favorites: [], planOverrides: {}, statPeriod: 7 };
}
/** Fills what an older or partial state lacks (Swift's decoder needs every non-optional key). */
export function normalizeNutrition(n) {
  const d = defaultNutrition();
  const out = { ...d, ...(n || {}) };
  const s = (n && n.settings) || {};
  out.settings = {
    ...d.settings, ...s,
    profile: { ...d.settings.profile, ...(s.profile || {}) },
    manual: { ...d.settings.manual, ...(s.manual || {}) },
    diet: { ...d.settings.diet, ...(s.diet || {}) },
    adj: { ...d.settings.adj, ...(s.adj || {}) },
    prefs: { ...(s.prefs || {}) },
    slots: Array.isArray(s.slots) && s.slots.length ? s.slots : d.settings.slots,
  };
  delete out.settings.training;
  for (const k of ["logs", "variety", "planOverrides"]) if (!out[k] || typeof out[k] !== "object" || Array.isArray(out[k])) out[k] = {};
  for (const k of ["cart", "shopList", "recipeStyles", "recipeSeen", "favorites"]) if (!Array.isArray(out[k])) out[k] = [];
  out.cart = out.cart.map(fixProduct);
  out.shopList = out.shopList.map((r) => ({ got: 0, done: false, fromRecipes: false, ...r, id: r.id || uid(), ref: r.ref ? fixProduct(r.ref) : r.ref }));
  for (const [day, list] of Object.entries(out.logs)) out.logs[day] = (list || []).map((e) => ({ ...e, id: e.id || uid() }));
  if (!out.statPeriod) out.statPeriod = 7;
  return out;
}
function fixProduct(p) {
  return { brand: "", imageURL: "", additives: 0, categories: [], allergens: [], analysis: [], packG: 0, ...p, id: p.id || uid(), n: { kcal: 0, p: 0, c: 0, f: 0, ...(p.n || {}) } };
}

/** The nutrition state, created on first use. */
export function N() {
  if (!S.nutrition) S.nutrition = defaultNutrition();
  return S.nutrition;
}

// MARK: Products

export function productFromFood(f) {
  return {
    id: uid(), foodId: f.id, code: null, name: f.name, brand: "", imageURL: "", fam: f.fam, tags: f.tags, nova: f.nova,
    additives: 0, categories: [], allergens: [], analysis: [], packG: 0, n: { ...f.n }, unit: f.unit || null, fixed: null,
  };
}
export const shortName = (name) => name.replace(/\s*\([^)]*\)/g, "").replace(" en mélange", "").trim();
export const macrosOf = (x) => ({ kcal: x.kcal, p: x.p, c: x.c, f: x.f });
export const zero = () => ({ kcal: 0, p: 0, c: 0, f: 0 });
export const add = (a, b) => ({ kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f });
export const sub = (a, b) => ({ kcal: a.kcal - b.kcal, p: a.p - b.p, c: a.c - b.c, f: a.f - b.f });
export const mul = (a, k) => ({ kcal: a.kcal * k, p: a.p * k, c: a.c * k, f: a.f * k });
export const floored = (a) => ({ kcal: Math.max(0, a.kcal), p: Math.max(0, a.p), c: Math.max(0, a.c), f: Math.max(0, a.f) });
export const unitLabel = (u, count) => (u.kind === "egg" ? (count > 1 ? "œufs" : "œuf") : "c. à soupe");

// MARK: Formatting

export const nnum = (v, digits = 1) => num(v, digits);
export function weightText(g) {
  if (g >= 1000) return `${num(g / 1000, 1)} kg`;
  if (g >= 100) return `${int(rnd(g / 10)) * 10} g`;
  return `${int(rnd(g))} g`;
}
export const money = (v, cur) => `${num(v, 2, 2)} ${cur}`;
export function packs(g, packG) {
  if (!(packG > 0)) return null;
  const k = Math.max(1, int(rnd(g / packG)));
  return `≈ ${k} paquet${k > 1 ? "s" : ""} de ${weightText(packG)}`;
}
export const macroLine = (n) => `${int(rnd(n.kcal))} kcal · P ${num(n.p)} · G ${num(n.c)} · L ${num(n.f)} pour 100 g`;
export const isWeighedRaw = (name) => /riz|rice|pâtes|pasta|spaghetti|penne|fusilli|coquillettes|semoule|couscous|quinoa|lentil|avoine|oats|cru|dry/i.test(name);

// MARK: Targets (Mifflin-St Jeor)

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

export function computedTargets(s) {
  const p = s.profile;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5);
  const tdee = bmr * ACTIVITY_FACTORS[clamp(p.act, 0, 3)];
  const kcal = rnd((tdee + GOAL_OFFSETS[clamp(p.goal, 0, 4)] + (s.adj?.kcal || 0)) / 50) * 50;
  const prot = rnd(p.protKg * p.weight);
  const fat = rnd(p.fatKg * p.weight);
  const carbs = Math.max(0, rnd((kcal - prot * 4 - fat * 9) / 4));
  return { bmr, tdee, targets: { kcal, p: prot, c: carbs, f: fat } };
}
export const baseTargets = (s) => (s.manual.on ? macrosOf(s.manual) : computedTargets(s).targets);
export const waterGoal = (s) => Math.min(14, Math.max(6, int(rnd((s.profile.weight * 0.035) / 0.25))));

/** Settings with today's training adjustment, as the store reads them. */
export function settings() {
  return { ...N().settings, training: trainingToday() };
}

export function dayTargets(s = settings()) {
  const t = baseTargets(s);
  if (s.training && s.training.kcal !== 0) {
    t.kcal = Math.max(0, t.kcal + s.training.kcal);
    t.c = Math.max(0, rnd(t.c + s.training.kcal / 4));
  }
  return t;
}
function carbShare(s) {
  const t = dayTargets(s);
  const cK = t.c * 4, fK = t.f * 9;
  return cK + fK > 0 ? cK / (cK + fK) : 0.5;
}
export function slotTargets(s = settings()) {
  const t = dayTargets(s);
  const sk = s.slots.reduce((a, x) => a + x.pk, 0);
  const sp = s.slots.reduce((a, x) => a + x.pp, 0);
  const share = carbShare(s);
  const total = {};
  for (const x of s.slots) total[x.type] = (total[x.type] || 0) + 1;
  const seen = {};
  return s.slots.map((x) => {
    const kcal = (t.kcal * x.pk) / (sk === 0 ? 1 : sk);
    const p = (t.p * x.pp) / (sp === 0 ? 1 : sp);
    const rest = Math.max(0, kcal - p * 4);
    seen[x.type] = (seen[x.type] || 0) + 1;
    const n = total[x.type] || 1;
    const name = MEAL_TYPES[x.type].label;
    const subT = n > 1 ? `${seen[x.type]}/${n}` : "";
    return { id: x.id, type: x.type, name, sub: subT, label: subT ? `${name} ${subT}` : name, target: { kcal: rnd(kcal), p: rnd(p), c: rnd((rest * share) / 4), f: rnd((rest * (1 - share)) / 9) } };
  });
}
export function typeTarget(type, s = settings()) {
  const list = slotTargets(s).filter((x) => x.type === type);
  if (list.length) return list.reduce((a, x) => add(a, mul(x.target, 1 / list.length)), zero());
  const t = dayTargets(s);
  const [pk, pp] = type === "breakfast" ? [25, 25] : type === "meal" ? [43, 39] : [14, 22];
  const share = carbShare(s);
  const kcal = (t.kcal * pk) / 100, p = (t.p * pp) / 100, rest = Math.max(0, kcal - p * 4);
  return { kcal, p, c: (rest * share) / 4, f: (rest * (1 - share)) / 9 };
}
function scaleFor(by, s) {
  const t = dayTargets(s), b = BASE;
  return by === "p" ? t.p / b.p : by === "c" ? t.c / b.c : by === "f" ? t.f / b.f : t.kcal / b.kcal;
}
export function guessSlot(s = settings(), date = new Date()) {
  const list = slotTargets(s);
  const h = date.getHours() + date.getMinutes() / 60;
  const want = h < 10.5 ? "breakfast" : h >= 15.5 && h < 18.5 ? "snack" : "meal";
  let c = list.filter((x) => x.type === want);
  if (!c.length) c = list.filter((x) => x.type === "meal");
  if (!c.length) c = list;
  return (h < 15 ? c[0] : c[c.length - 1])?.id ?? null;
}
export const prefOf = (s, p) => (p.foodId != null ? s.prefs[p.foodId] ?? 0 : 0);
export const prefFood = (s, f) => s.prefs[f.id] ?? 0;

// MARK: Diet exclusions

const SEAFOOD = /seafood|fishes|(^|\s|:)fish|shellfish|crustacean|salmon|shrimp|prawn|mussel|sardine|mackerel|(^|\s|:)cod|saumon|crevette|moule|maquereau|cabillaud|surimi|poisson/;
const TUNA = /tuna|thon/;
const MEAT = /meats|poultry|chicken|beef|turkey|hams|sausages|poulet|boeuf|bœuf|dinde|jambon|viande|steak|saucisse|lardon|bacon/;
const PORK = /pork|hams|bacon|porc|jambon|lardon|saucisson|chorizo/;
export const hay = (p) => ((p.categories || []).join(" ") + " " + (p.allergens || []).join(" ") + " " + p.name).toLowerCase();
export const DIET_WORDS = { seafood: "produit de la mer", meat: "viande", fish: "poisson", pork: "porc", dairy: "produit laitier", egg: "œuf", animal: "produit animal" };

/** p: a product, or a food (with tags). */
export function excluded(s, p) {
  const d = s.diet, h = hay(p), al = p.allergens || [];
  const tags = p.tags ?? null;
  const has = (t) => tags.some((x) => x.includes(t));
  const isTuna = tags ? has("tuna") : TUNA.test(h);
  const isSea = tags ? has("seafood") : (SEAFOOD.test(h) && !TUNA.test(h)) || al.some((x) => /crustacean|mollusc/.test(x));
  const isFish = tags ? has("fish") : isTuna || isSea || al.includes("en:fish");
  const isMeat = tags ? has("meat") : MEAT.test(h) || PORK.test(h);
  const isPork = tags ? has("pork") : PORK.test(h);
  const isDairy = tags ? has("dairy") : al.includes("en:milk") || /dairies|cheeses|yogurt|milks/.test(h);
  const isEgg = tags ? has("egg") : al.includes("en:eggs") || /(^|\s|:)eggs/.test(h);
  const nonVegan = (p.analysis || []).includes("en:non-vegan");
  switch (d.type) {
    case "vegan":
      if (isMeat) return "meat";
      if (isFish) return "fish";
      if (isDairy) return "dairy";
      if (isEgg) return "egg";
      if (nonVegan) return "animal";
      break;
    case "veg":
      if (isMeat) return "meat";
      if (isFish) return "fish";
      break;
    case "pesc":
      if (isMeat) return "meat";
      break;
    case "nopork":
      if (isPork) return "pork";
      break;
  }
  if (d.seafood && (isSea || (isFish && !(d.tuna && isTuna)))) return "seafood";
  return null;
}
const foodAsProduct = (f) => ({ ...f, foodId: f.id, categories: [], allergens: [], analysis: [], additives: 0 });
export const allowed = (s, f) => !!f && excluded(s, foodAsProduct(f)) == null && prefFood(s, f) !== -1;
const prefP = (s, p) => (p.foodId != null ? s.prefs[p.foodId] ?? 0 : 0);

// MARK: Score

export function grade(v) {
  return v >= 80 ? "A" : v >= 65 ? "B" : v >= 45 ? "C" : v >= 25 ? "D" : "E";
}
export const GRADE_VERDICT = { A: "Excellent pour toi", B: "Bon choix", C: "Correct, avec modération", D: "Pas idéal pour ton objectif", E: "À éviter" };
export const GRADE_COLORS = { A: "#1e8f4e", B: "#7ac143", C: "#f5b400", D: "#f07c22", E: "#e63c2f" };

export function score(s, p) {
  const ex = excluded(s, p);
  if (ex) return { value: 5, excludedBy: ex, reasons: [{ text: `Exclu par tes réglages : ${DIET_WORDS[ex]}`, bad: true }] };
  const r = rawScore(p);
  if (prefP(s, p) === -1) r.reasons = [{ text: "Tu n'aimes pas cet aliment", bad: true }, ...r.reasons].slice(0, 4);
  return r;
}
export const scoreFood = (s, f) => score(s, foodAsProduct(f));

function rawScore(p) {
  const n = p.n, kcal = Math.max(n.kcal, 1);
  const reasons = [];
  let s = 50;
  const pShare = (n.p * 4) / kcal;
  s += Math.min(30, pShare * 75);
  if (pShare >= 0.3) reasons.push({ text: `Riche en protéines (${int(rnd(Math.min(100, pShare * 100)))} % des calories)` });
  else if (pShare < 0.08 && n.kcal > 150 && !["feculents", "graisses", "fruits", "legumes"].includes(p.fam)) {
    s -= 8;
    reasons.push({ text: "Presque pas de protéines pour beaucoup de calories", bad: true });
  }
  const fiber = n.fiber ?? 0;
  if (fiber >= 5) {
    s += 8;
    reasons.push({ text: `Bonne source de fibres (${num(fiber)} g)` });
  } else if (fiber >= 3) s += 4;
  const sugar = n.sugar ?? 0;
  const natural = ["fruits", "laitiers", "legumes"].includes(p.fam) && sugar <= 15;
  if (!natural && sugar > 5) {
    s -= Math.min(28, (sugar - 5) * 1.2);
    reasons.push({ text: `${sugar >= 12 ? "Très sucré" : "Sucré"} (${num(sugar)} g pour 100 g)`, bad: true });
  }
  const sat = n.sat ?? 0, satLimit = p.fam === "graisses" ? 18 : 4;
  if (sat > satLimit) {
    s -= Math.min(15, (sat - satLimit) * 1.2);
    if (sat >= 8 && p.fam !== "graisses") reasons.push({ text: `Riche en graisses saturées (${num(sat)} g)`, bad: true });
  }
  const salt = n.salt ?? 0;
  if (salt > 1.2) {
    s -= Math.min(15, (salt - 1.2) * 6);
    if (salt >= 1.5) reasons.push({ text: `Salé (${num(salt)} g de sel pour 100 g)`, bad: true });
  }
  if (p.nova === 1) {
    s += 12;
    reasons.push({ text: "Aliment brut, pas transformé" });
  } else if (p.nova === 2) s += 6;
  else if (p.nova === 4) {
    s -= 12;
    reasons.push({ text: "Ultra-transformé", bad: true });
  }
  if ((p.additives || 0) >= 4) {
    s -= 5;
    reasons.push({ text: `${p.additives} additifs`, bad: true });
  }
  if (n.kcal >= 400 && pShare < 0.15 && fiber < 5 && p.fam !== "graisses" && p.fam !== "feculents") {
    s -= 10;
    reasons.push({ text: `Très calorique (${int(rnd(n.kcal))} kcal pour 100 g) et peu rassasiant`, bad: true });
  }
  if (p.fam === "graisses") reasons.push({ text: "Très calorique : à doser à la cuillère", bad: true });
  const value = int(Math.max(0, Math.min(100, rnd(s))));
  const sorted = [...reasons.filter((r) => !r.bad), ...reasons.filter((r) => r.bad)];
  return { value, excludedBy: null, reasons: sorted.slice(0, 4) };
}

// MARK: Aisle of a scanned product

export function guessedAisle(p) {
  const h = hay(p), sugar = p.n.sugar ?? 0, n = p.n;
  const m = (re) => re.test(h);
  if (m(/alcoholic|beers|wines|spirits|sodas|soft-drinks|sweetened-beverages|energy-drinks|confectioner|chocolate|candies|biscuits|cookies|cakes|pastries|ice-cream|sweet-snacks|salty-snacks|crisps|desserts|pizzas|bonbon|gâteau|biscuit|chips|soda/)) {
    if (m(/greek|skyr|fromage-blanc|cottage/) && sugar < 6) return "laitiers";
    return "extras";
  }
  if (m(TUNA)) return "viandes";
  if (m(/protein-powder|whey|dietary-supplement|protéine en poudre/)) return "poudre";
  if (m(/(^|\s|:)eggs|œuf|oeuf/)) return "oeufs";
  if (m(/yogurt|yoghurt|skyr|fromages-blancs|fromage blanc|cottage|quark|(^|:)milks|lait /)) return sugar > 9 ? "extras" : "laitiers";
  if (m(/cheeses|fromage|mozzarella|parmesan|emmental|cheddar/)) return "fromages";
  if (m(MEAT) || m(PORK) || m(/tofu|tempeh|seitan/)) return "viandes";
  if (m(/olive-oils|vegetable-oils|(^|:)fats|butters|nuts|peanut|almond|huile|beurre|amande|cacahu|noix|avocado/)) return "graisses";
  if (m(/sauces|condiments|mustards|ketchup|spices|salsa|sauce|moutarde|épice/)) return "sauces";
  if (m(/breakfast-cereals/) && sugar > 12) return "extras";
  if (m(/fruit-juices|nectars|compotes|(^|\s)jus/)) return "extras";
  if (m(/rices|pastas|potatoes|breads|oat|cereals|couscous|semolin|quinoa|legumes|lentil|tortilla|wraps|riz|pâtes|pates|pomme de terre|patate|pain|avoine|semoule|lentille/)) return "feculents";
  if (m(/vegetables|légume|legume/)) return "legumes";
  if (m(/fruits|banane|kiwi/)) return "fruits";
  const kp = n.p * 4, kc = n.c * 4, kf = n.f * 9;
  if (sugar > 15 || (kf > kp && kf > kc && n.p < 10 && n.kcal > 350)) return "extras";
  if (kp >= kc && kp >= kf && n.p >= 15) return "viandes";
  if (kc >= kp && kc >= kf) return "feculents";
  if (kf >= kp && kf >= kc) return "graisses";
  return "extras";
}

// MARK: Weekly quantity

export function aisleBudget(s, fam) {
  const b = BUDGETS[fam];
  return b ? b.budget * scaleFor(b.by, s) : 0;
}
export function weeklyQuantity(s, p, fam, variety) {
  const b = BUDGETS[fam];
  if (!b) return { grams: 0, count: 1, explanation: "" };
  const count = Math.max(1, variety[fam] ?? b.count);
  const budget = aisleBudget(s, fam), share = budget / count;
  if (fam === "extras") {
    const g = p.n.kcal > 0 ? (share / p.n.kcal) * 100 : 0;
    const week = int(rnd(budget / 50)) * 50;
    return { grams: g, count, explanation: `Pas prévu dans ton plan. Si tu en prends, reste sous ${week} kcal pour la semaine, soit environ ${Math.trunc(week / 7)} kcal par jour.` };
  }
  let g, total;
  if (b.by === "grams") {
    g = share;
    total = `${weightText(budget)} de ${AISLES[fam].label.toLowerCase()} par semaine`;
  } else {
    const per = b.by === "p" ? p.n.p : b.by === "c" ? p.n.c : b.by === "f" ? p.n.f : p.n.kcal;
    g = per > 0 ? (share / per) * 100 : share;
    const macro = b.by === "p" ? "protéines" : b.by === "c" ? "glucides" : "lipides";
    total = `${int(rnd(budget))} g de ${macro} par semaine venant de ce rayon`;
  }
  const ex = AISLES[fam].examples;
  const also = ex ? ` (${ex})` : "";
  const explanation = count > 1 ? `Ton plan prévoit ${total}. Je les répartis sur ${count} produits différents${also}, donc celui-ci en couvre 1/${count}.` : `Ton plan prévoit ${total}, couverts entièrement par ce produit.`;
  return { grams: g, count, explanation };
}

// MARK: Portion solver

const KEYS = ["kcal", "p", "c", "f"];
const WEIGHTS = { kcal: 1, p: 2, c: 1, f: 1 };
export function solve(items, target, rounded = false) {
  let goal = { ...target };
  for (const it of items) if (it.fixed != null) goal = sub(goal, mul(macrosOf(it.n), it.fixed / 100));
  const free = items.map((_, i) => i).filter((i) => items[i].fixed == null);
  const scale = {};
  for (const k of KEYS) scale[k] = Math.max(Math.abs(target[k]), k === "kcal" ? 100 : 5);
  const a = free.map((i) => KEYS.map((k) => ((items[i].n[k] / 100) * Math.sqrt(WEIGHTS[k])) / scale[k]));
  const b = KEYS.map((k) => (goal[k] * Math.sqrt(WEIGHTS[k])) / scale[k]);
  const g = free.map(() => 0);
  for (let it = 0; it < 4000; it++) {
    let moved = 0;
    for (let j = 0; j < g.length; j++) {
      let nu = 0, den = 1e-6;
      for (let m = 0; m < 4; m++) {
        let others = 0;
        for (let q = 0; q < g.length; q++) if (q !== j) others += a[q][m] * g[q];
        nu += a[j][m] * (b[m] - others);
        den += a[j][m] * a[j][m];
      }
      const next = Math.min(MAX_GRAMS, Math.max(0, nu / den));
      moved = Math.max(moved, Math.abs(next - g[j]));
      g[j] = next;
    }
    if (moved < 0.01) break;
  }
  const units = free.filter((i) => items[i].unit);
  if (units.length && units.length < free.length && !rounded) {
    const fixedItems = items.map((x) => ({ ...x }));
    free.forEach((i, j) => {
      if (items[i].unit) fixedItems[i].fixed = roundDose(g[j], items[i]);
    });
    return solve(fixedItems, target, true);
  }
  const out = items.map((x) => x.fixed ?? 0);
  free.forEach((i, j) => (out[i] = roundDose(g[j], items[i])));
  return out;
}
export function roundDose(g, it) {
  if (it.unit) return rnd(g / it.unit.step) * it.unit.step;
  return g >= 100 ? rnd(g / 5) * 5 : rnd(g);
}
export const totals = (items, grams) => items.reduce((a, it, i) => add(a, mul(macrosOf(it.n), (grams[i] || 0) / 100)), zero());

// MARK: Day keys

export const offsetDay = (n) => dayKey(addDays(Date.now(), -n));
export function keyDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}
export const keysBetween = (a, b) => Math.round((keyDate(b) - keyDate(a)) / DAY);

// MARK: Weight trend and weekly adjustment

/** One weigh-in per day, the latest of the day. */
export function weightsByDay(entries = S.bodyWeights) {
  const out = {};
  for (const e of entries) {
    const k = dayKey(e.date);
    if (out[k] && out[k][0] > e.date) continue;
    out[k] = [e.date, e.weight];
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v[1]]));
}
export function avgWeights(weights, from, to) {
  const values = [];
  for (let i = from; i <= to; i++) {
    const v = weights[offsetDay(i)];
    if (v != null) values.push(v);
  }
  return { count: values.length, avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
}
export function checkAdjustment(s, weights) {
  const offset = GOAL_OFFSETS[clamp(s.profile.goal, 0, 4)];
  if (s.manual.on || offset === 0) return false;
  const today = dayKey();
  if (s.adj.last && keysBetween(s.adj.last, today) < 7) return false;
  const now = avgWeights(weights, 0, 6), prev = avgWeights(weights, 7, 13);
  if (now.count < 3 || prev.count < 3) return false;
  const change = now.avg - prev.avg, expected = (offset * 7) / 7700;
  s.profile.weight = rnd(now.avg * 10) / 10;
  let step = 0;
  let message = "Tu es dans le bon rythme, on ne touche à rien.";
  if (expected < 0) {
    if (change > expected * 0.3) {
      step = -100;
      message = "Ta moyenne stagne : j'ai baissé tes calories de 100 kcal par jour.";
    } else if (change < expected * 1.6 && change < -0.01 * now.avg) {
      step = 100;
      message = "Tu perds trop vite : j'ai remonté tes calories de 100 kcal par jour pour protéger tes muscles.";
    }
  } else if (change < expected * 0.3) {
    step = 100;
    message = "Ta prise est trop lente : +100 kcal par jour.";
  } else if (change > expected * 2) {
    step = -100;
    message = "Ta prise est trop rapide : −100 kcal par jour.";
  }
  if (step < 0) {
    const c = computedTargets(s);
    if (c.targets.kcal + step < Math.max(c.bmr, s.profile.sex === "f" ? 1200 : 1500)) {
      step = 0;
      message = "Ta moyenne stagne, mais je ne descends pas plus bas en calories : bouge un peu plus (pas, marche inclinée).";
    }
  }
  s.adj.kcal = (s.adj.kcal || 0) + step;
  s.adj.last = today;
  s.adj.message = message;
  return true;
}
/** Runs the weekly calorie check after a weigh-in (mutates the saved settings). */
export function runAdjustment() {
  return checkAdjustment(N().settings, weightsByDay());
}

// MARK: Grocery list matching

const STOP = new Set(["de", "du", "des", "la", "le", "les", "au", "aux", "et", "en", "sans", "nature", "crue", "crues", "cru", "conserve", "seche", "seches", "egoutte", "surgele", "surgeles", "surgelees", "with", "and", "raw", "dry", "canned", "frozen", "plain"]);
export const normalized = (t) => (t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const words = (t) => normalized(t).replace(/\([^)]*\)/g, " ").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
export const rowTitle = (r) => r.ref?.name ?? r.name ?? "";

export function matchRow(s, p, list) {
  if (excluded(s, p) != null) return null;
  const h = " " + normalized(p.name + " " + (p.categories || []).join(" ")).replace(/[^a-z0-9]+/g, " ") + " ";
  let best = null, bestScore = 0;
  list.forEach((row, i) => {
    if (row.done) return;
    const ws = [...new Set(words(rowTitle(row)))];
    const hits = ws.filter((w) => h.includes(" " + w) || h.includes(" " + w.replace(/s$/, ""))).length;
    if (!hits) return;
    const sc = hits + (row.fam === p.fam ? 1.5 : 0);
    if (sc > bestScore && (row.fam === p.fam || hits >= 2)) {
      bestScore = sc;
      best = i;
    }
  });
  return best;
}
export function pricePerKg(row) {
  if (row.ppk != null) return row.ppk;
  const id = row.ref?.foodId;
  if (id) {
    const idx = Number(id.slice(4));
    if (FOOD_PRICE[idx] != null) return FOOD_PRICE[idx];
  }
  return AISLE_PRICE[row.fam] ?? 6;
}
export function need(s, row, variety) {
  if (row.fixedG != null) return row.fixedG;
  if (row.ref) return weeklyQuantity(s, row.ref, row.fam, variety).grams;
  return row.g ?? 0;
}

// MARK: Recipes

export function choices(s, part) {
  const options = part.options.map(food).filter((f) => f && allowed(s, f));
  if (options.length) return options;
  if (part.role === "X") return [];
  const fam = food(part.options[0])?.fam;
  if (!fam) return [];
  const same = ND.foods.filter((f) => f.fam === fam && allowed(s, f) && f.fam !== "extras");
  const liked = same.filter((f) => prefFood(s, f) === 1);
  return liked.length ? liked : same;
}
function pickWeighted(s, list) {
  const w = list.map((f) => (prefFood(s, f) === 1 ? 3 : 1));
  let x = Math.random() * Math.max(w.reduce((a, b) => a + b, 0), 0.0001);
  for (let i = 0; i < list.length; i++) {
    x -= w[i];
    if (x <= 0) return list[i];
  }
  return list[list.length - 1];
}
export function pickParts(s, tpl, keep = []) {
  return tpl.parts.map((part, i) => {
    const ch = choices(s, part);
    if (i < keep.length && keep[i] != null && ch.some((f) => f.id === keep[i])) return keep[i];
    return pickWeighted(s, ch)?.id ?? null;
  });
}
const isValid = (s, tpl) => tpl.parts.every((p) => p.role === "X" || choices(s, p).length);
const likes = (s, tpl) => tpl.parts.filter((p) => p.options.some((id) => food(id) && prefFood(s, food(id)) === 1)).length;
export function pool(s, type, styles) {
  const vegDiet = s.diet.type === "veg" || s.diet.type === "vegan";
  return ND.recipes.filter((r) => r.kinds.includes(type) && isValid(s, r) && (!styles.length || styles.some((x) => r.tags.includes(x))) && (!r.veg || vegDiet || r.parts[0].options.some((id) => food(id) && prefFood(s, food(id)) === 1)));
}
export function build(s, pick, target) {
  const tpl = recipeTpl(pick.tpl);
  if (!tpl) return null;
  const picks = pickParts(s, tpl, pick.picks);
  const products = [], parts = [];
  tpl.parts.forEach((part, i) => {
    const f = food(picks[i]);
    if (!f) return;
    const p = productFromFood(f);
    const solved = ["P", "C", "F"].includes(part.role);
    p.fixed = solved ? null : part.grams ?? (part.role === "V" || part.role === "R" ? 100 : null);
    products.push(p);
    parts.push([i, part.role, f]);
  });
  const grams = solve(products, target);
  const items = parts.map(([part, role, f], j) => ({ part, role, food: f, grams: grams[j] }));
  const tot = items.reduce((a, it) => add(a, mul(macrosOf(it.food.n), it.grams / 100)), zero());
  const names = (role) => {
    const list = items.filter((it) => it.role === role && it.grams > 0).map((it) => shortName(it.food.name).toLowerCase());
    if (!list.length && role === "F") return "une poêle antiadhésive";
    if (!list.length) return "";
    return list.length > 1 ? list.slice(0, -1).join(", ") + " et " + list[list.length - 1] : list[0];
  };
  let steps = tpl.steps;
  for (const role of ["P", "C", "F", "V", "R", "X"]) steps = steps.split(`{${role}}`).join(names(role));
  return { template: tpl, picks, items, totals: tot, steps };
}

// MARK: Store operations

export const todayLog = () => N().logs[dayKey()] || [];
export function eaten(slot = null) {
  return todayLog().filter((e) => slot == null || e.slot === slot).reduce((a, e) => add(a, macrosOf(e)), zero());
}
export function remaining(slotId, s = settings()) {
  const slots = slotTargets(s);
  const slot = slots.find((x) => x.id === slotId) || slots[0];
  if (!slot) return zero();
  return floored(sub(slot.target, eaten(slot.id)));
}
export function addToCart(product) {
  const item = { ...product, id: product.id || uid() };
  if (item.foodId == null) item.fam = guessedAisle(item);
  if (item.fixed == null && item.fam === "legumes") item.fixed = VEG_FIXED;
  N().cart.push(item);
}
export function logMeal(grams, slot) {
  const n = N();
  const day = dayKey();
  const log = [...(n.logs[day] || [])];
  n.cart.forEach((item, i) => {
    const g = grams[i];
    if (!(g > 0)) return;
    const m = mul(macrosOf(item.n), g / 100);
    log.push({ id: uid(), name: item.name, slot, g, kcal: m.kcal, p: m.p, c: m.c, f: m.f });
  });
  n.logs[day] = log;
  n.cart = [];
}
export function pastMeals(days = 60) {
  const n = N();
  const seen = new Map();
  const meals = [];
  for (let i = 0; i <= days; i++) {
    const day = offsetDay(i);
    const entries = n.logs[day];
    if (!entries || !entries.length) continue;
    const slots = [];
    for (const e of entries) if (!slots.includes(e.slot)) slots.push(e.slot);
    for (const slot of slots) {
      const items = entries.filter((e) => e.slot === slot);
      const key = items.map((e) => `${e.name}|${int(rnd(e.g))}`).sort().join(";");
      if (seen.has(key)) meals[seen.get(key)].times++;
      else {
        seen.set(key, meals.length);
        meals.push({ id: `${day}-${slot}`, day, slot, entries: items, times: 1, macros: items.reduce((a, e) => add(a, macrosOf(e)), zero()), title: items.map((e) => e.name).join(", ") });
      }
    }
  }
  return meals;
}
export function repeatMeal(meal, slot) {
  const n = N();
  const day = dayKey();
  n.logs[day] = [...(n.logs[day] || []), ...meal.entries.map((e) => ({ ...e, id: uid(), slot }))];
}
export function addToList(product, aisle) {
  const n = N();
  const ref = { ...product, fixed: null };
  const row = { id: uid(), fam: aisle, ref, got: 0, done: false, fromRecipes: false };
  const i = n.shopList.findIndex((r) => rowTitle(r) === product.name);
  if (i >= 0) n.shopList[i] = row;
  else n.shopList.push(row);
}
export function recipeCounts() {
  const n = N();
  if (n.recipeCounts) return n.recipeCounts;
  const counts = {};
  for (const t of MEAL_TYPE_IDS) {
    const c = n.settings.slots.filter((x) => x.type === t).length;
    counts[t] = t === "meal" ? Math.max(1, c) : c;
  }
  return counts;
}
export function drawRecipes(count, type, avoid = []) {
  const n = N();
  const s = settings();
  const pl = pool(s, type, n.recipeStyles);
  const out = [];
  const used = new Set(avoid);
  const seen = new Set(n.recipeSeen);
  const favIds = new Set(n.favorites.map((f) => f.tpl));
  for (let k = 0; k < count; k++) {
    let cand = pl.filter((r) => !used.has(r.id) && !seen.has(r.id));
    if (!cand.length) {
      for (const r of pl) seen.delete(r.id);
      cand = pl.filter((r) => !used.has(r.id));
    }
    if (!cand.length) cand = pl;
    if (!cand.length) break;
    const w = cand.map((r) => 1 + 0.25 * Math.min(likes(s, r), 3) + (favIds.has(r.id) ? 1 : 0));
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    let pick = cand[0];
    for (let i = 0; i < cand.length; i++) {
      x -= w[i];
      if (x <= 0) {
        pick = cand[i];
        break;
      }
    }
    used.add(pick.id);
    seen.add(pick.id);
    out.push({ id: uid(), tpl: pick.id, picks: pickParts(s, pick), servings: 1 });
  }
  n.recipeSeen = [...seen];
  return out;
}
export function newRecipes() {
  const n = N();
  const counts = recipeCounts();
  n.recipeGroups = MEAL_TYPE_IDS.map((type) => (counts[type] > 0 ? { type, items: drawRecipes(counts[type], type) } : null)).filter(Boolean);
  n.planOverrides = {};
}
export function recipeTotals() {
  const n = N();
  const s = settings();
  const sum = new Map();
  for (const g of n.recipeGroups || []) {
    const target = typeTarget(g.type, s);
    for (const pick of g.items) {
      const b = build(s, pick, target);
      if (!b) continue;
      for (const it of b.items) {
        if (!(it.grams > 0)) continue;
        const x = sum.get(it.food.id) || { food: it.food, grams: 0, recipes: 0 };
        x.grams += it.grams * pick.servings;
        x.recipes += 1;
        sum.set(it.food.id, x);
      }
    }
  }
  return [...sum.values()].sort((a, b) => {
    const x = AISLE_IDS.indexOf(a.food.fam), y = AISLE_IDS.indexOf(b.food.fam);
    return x !== y ? x - y : b.grams - a.grams;
  });
}
export function sendRecipesToList() {
  const n = N();
  const t = recipeTotals();
  const ids = new Set(t.map((x) => x.food.id));
  n.shopList = n.shopList.filter((r) => !(r.fromRecipes || (r.ref?.foodId && ids.has(r.ref.foodId))));
  for (const x of t) n.shopList.push({ id: uid(), fam: x.food.fam, ref: productFromFood(x.food), fixedG: rnd(x.grams), got: 0, done: false, fromRecipes: true });
  return t.length;
}
export const recipeKey = (g, i) => `${g}:${i}`;
export function plan() {
  const n = N();
  const queues = {};
  (n.recipeGroups || []).forEach((g, gi) => {
    const left = g.items.map((it, i) => ({ key: recipeKey(gi, i), n: it.servings }));
    const q = [];
    while (left.some((x) => x.n > 0)) for (const x of left) if (x.n > 0) {
      q.push(x.key);
      x.n--;
    }
    queues[g.type] = [...(queues[g.type] || []), ...q];
  });
  const slots = slotTargets();
  const days = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(Date.now(), d);
    const cells = slots.map((slot) => {
      const id = `${d}-${slot.id}`;
      let auto = "";
      if (queues[slot.type]?.length) auto = queues[slot.type].shift();
      return { id, slot, key: n.planOverrides[id] ?? auto };
    });
    days.push({ offset: d, date, cells });
  }
  return { days, extra: Object.values(queues).reduce((a, q) => a + q.length, 0) };
}
export function dayStats(count, weights) {
  const n = N();
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const day = offsetDay(i);
    const log = n.logs[day] || [];
    out.push({ day, date: keyDate(day), logged: log.length > 0, macros: log.reduce((a, e) => add(a, macrosOf(e)), zero()), weight: weights[day] ?? null });
  }
  return out;
}
export const onTarget = (d, t) => d.logged && d.macros.kcal >= t.kcal * 0.9 && d.macros.kcal <= t.kcal * 1.05 && d.macros.p >= t.p * 0.9;

// MARK: Training days

const cost = (minutes) => Math.min(400, Math.max(100, minutes * 5));
let trainingCache = { key: null, value: null };
export function trainingToday(now = Date.now()) {
  const ws = [...S.workouts].sort((a, b) => b.startedAt - a.startedAt).slice(0, 60);
  const key = dayKey(now) + ws.slice(0, 40).map((w) => `${w.startedAt}-${w.endedAt || 0}`).join(",");
  if (trainingCache.key === key) return trainingCache.value;
  const today = startOfDay(now);
  const since = addDays(today, -28);
  const todays = ws.filter((w) => startOfDay(w.startedAt) === today);
  const recent = ws.filter((w) => w.endedAt != null && w.startedAt >= since && w.startedAt < today);
  const dur = (w) => ((w.endedAt ?? Date.now()) - w.startedAt) / 60000;
  const usual = recent.length ? recent.reduce((a, w) => a + cost(dur(w)), 0) / recent.length : 220;
  let value = null;
  if (todays.length) {
    const done = todays.filter((w) => w.endedAt != null);
    const kcal = done.length ? done.reduce((a, w) => a + cost(dur(w)), 0) : usual;
    value = { kcal: rnd(Math.min(500, kcal) / 10) * 10, trained: true };
  } else {
    const days = new Set(recent.map((w) => startOfDay(w.startedAt))).size;
    const perWeek = Math.min(6, days / 4);
    if (perWeek > 0) {
      const rest = Math.min(250, (usual * perWeek) / (7 - perWeek));
      value = { kcal: -rnd(rest / 10) * 10, trained: false };
    }
  }
  trainingCache = { key, value };
  return value;
}

// MARK: Open Food Facts

const FIELDS = "code,product_name,product_name_fr,brands,nutriments,image_front_small_url,nova_group,additives_n,categories_tags,allergens_tags,ingredients_analysis_tags,product_quantity";
export class LookupError extends Error {}
const ERR = {
  notFound: "Ce produit n'est pas dans Open Food Facts. Choisis un aliment proche dans la liste.",
  offline: "Pas de connexion à Open Food Facts. Vérifie ton réseau et réessaie.",
};
async function fetchJSON(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new LookupError(ERR.offline);
  }
  try {
    return await res.json();
  } catch {
    throw new LookupError(ERR.notFound);
  }
}
const flex = (v) => {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const x = Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : null;
};
function makeOFF(p, code) {
  const nu = p.nutriments || {};
  const name = p.product_name_fr || p.product_name || "";
  let kcal = flex(nu["energy-kcal_100g"]);
  if (kcal == null) {
    const e = flex(nu.energy_100g);
    kcal = e == null ? null : e / 4.184;
  }
  if (kcal == null) return null;
  const n = {
    kcal, p: flex(nu.proteins_100g) ?? 0, c: flex(nu.carbohydrates_100g) ?? 0, f: flex(nu.fat_100g) ?? 0,
    sugar: flex(nu.sugars_100g) ?? 0, sat: flex(nu["saturated-fat_100g"]) ?? 0, salt: flex(nu.salt_100g) ?? 0, fiber: flex(nu.fiber_100g) ?? 0,
  };
  const nova = flex(p.nova_group);
  const prod = {
    id: uid(), foodId: null, code, name: name || "Produit sans nom", brand: (p.brands || "").split(",")[0]?.trim() || "", imageURL: p.image_front_small_url || "",
    fam: "extras", tags: null, nova: nova == null ? null : int(nova), additives: int(flex(p.additives_n) ?? 0), categories: p.categories_tags || [],
    allergens: p.allergens_tags || [], analysis: p.ingredients_analysis_tags || [], packG: flex(p.product_quantity) ?? 0, n, unit: null, fixed: null,
  };
  prod.fam = guessedAisle(prod);
  return prod;
}
export async function offProduct(raw) {
  const code = String(raw).replace(/\D/g, "");
  if (!code) throw new LookupError(ERR.notFound);
  const r = await fetchJSON(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`);
  const name = r?.product?.product_name_fr || r?.product?.product_name || "";
  const prod = r?.status === 1 && r.product ? makeOFF(r.product, code) : null;
  if (!prod) throw new LookupError(name ? `${name} : pas de valeurs nutritionnelles dans Open Food Facts.` : ERR.notFound);
  return prod;
}
export async function offSearch(query) {
  const q = new URLSearchParams({ search_terms: query, search_simple: "1", action: "process", json: "1", page_size: "25", sort_by: "unique_scans_n", lc: "fr", fields: FIELDS });
  const r = await fetchJSON(`https://world.openfoodfacts.org/cgi/search.pl?${q}`);
  return (r?.products || []).map((p) => makeOFF(p, p.code || "")).filter(Boolean);
}

// MARK: Portion import (web Portion's localStorage, or its backup file { app: "portion", all })

const pnum = (v) => {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") return Number(v.replace(",", ".")) || 0;
  return 0;
};
const optNum = (v) => (v == null ? null : pnum(v));

/** all: { key: JSON string }. Returns { state, weights, days }. */
export function readPortion(all) {
  const value = (k) => {
    try {
      return all[k] == null ? undefined : JSON.parse(all[k]);
    } catch {
      return undefined;
    }
  };
  const st = defaultNutrition();
  const s = value("settings");
  if (s && typeof s === "object") st.settings = portionSettings(s);
  for (const key of Object.keys(all)) {
    if (!key.startsWith("log-")) continue;
    const entries = (Array.isArray(value(key)) ? value(key) : []).map((e) => ({ id: uid(), name: e.name ?? "", slot: e.slot ?? "", g: pnum(e.g), kcal: pnum(e.kcal), p: pnum(e.p), c: pnum(e.c), f: pnum(e.f) }));
    if (entries.length) st.logs[key.slice(4)] = entries;
  }
  st.cart = (value("cart") || []).map(portionProduct).filter(Boolean);
  st.shopList = (value("shopList") || []).map(portionRow).filter(Boolean);
  const v = value("variety");
  if (v && typeof v === "object") for (const [k, n] of Object.entries(v)) if (AISLES[k]) st.variety[k] = int(pnum(n));
  const r = value("recipes");
  if (r && Array.isArray(r.groups))
    st.recipeGroups = r.groups.filter((g) => MEAL_TYPES[g.type]).map((g) => ({ type: g.type, items: (g.items || []).map((i) => ({ id: uid(), tpl: i.tpl ?? "", picks: (i.picks || []).map((x) => (typeof x === "string" ? x : null)), servings: Math.max(1, int(pnum(i.n ?? 1))) })) }));
  const c = value("recipeCounts");
  if (c && typeof c === "object") {
    st.recipeCounts = {};
    for (const [k, n] of Object.entries(c)) if (MEAL_TYPES[k]) st.recipeCounts[k] = int(pnum(n));
  }
  st.recipeStyles = Array.isArray(value("recipeStyles")) ? value("recipeStyles").filter((x) => typeof x === "string") : [];
  st.recipeSeen = Array.isArray(value("recSeen")) ? value("recSeen").filter((x) => typeof x === "string") : [];
  st.favorites = (value("recFavs") || []).filter((f) => typeof f.tpl === "string" && MEAL_TYPES[f.type]).map((f) => ({ tpl: f.tpl, picks: (f.picks || []).map((x) => (typeof x === "string" ? x : null)), type: f.type }));
  const po = value("planOver");
  if (po && typeof po === "object") for (const [k, x] of Object.entries(po)) if (typeof x === "string") st.planOverrides[k] = x;
  const period = value("statPeriod");
  if (period !== undefined) st.statPeriod = int(pnum(period)) === 0 ? 7 : int(pnum(period));
  const weights = {};
  const w = value("weights");
  if (w && typeof w === "object") for (const [day, kg] of Object.entries(w)) weights[day] = pnum(kg);
  return { state: st, weights, days: Object.keys(st.logs).length };
}
function portionSettings(s) {
  const out = defaultSettings();
  const p = s.profile;
  if (p) out.profile = { name: p.name ?? "", sex: p.sex === "f" ? "f" : "m", age: pnum(p.age ?? 30), height: pnum(p.height ?? 178), weight: pnum(p.weight ?? 78), act: int(pnum(p.act ?? 1)), goal: int(pnum(p.goal ?? 1)), protKg: pnum(p.protKg ?? 2), fatKg: pnum(p.fatKg ?? 0.8) };
  const m = s.manual;
  if (m) out.manual = { on: m.on === true, kcal: pnum(m.kcal), p: pnum(m.p), c: pnum(m.c), f: pnum(m.f) };
  if (Array.isArray(s.slots)) {
    const parsed = s.slots.filter((x) => typeof x.id === "string").map((x) => ({ id: x.id, type: MEAL_TYPES[x.type] ? x.type : "meal", pk: pnum(x.pk), pp: pnum(x.pp) }));
    if (parsed.length) out.slots = parsed;
  }
  const d = s.diet;
  if (d) out.diet = { type: DIETS[d.type] ? d.type : "omni", seafood: typeof d.seafood === "boolean" ? d.seafood : true, tuna: typeof d.tuna === "boolean" ? d.tuna : true };
  if (s.prefs) for (const [k, v] of Object.entries(s.prefs)) out.prefs[k] = int(pnum(v));
  if (s.adj) out.adj = { kcal: pnum(s.adj.kcal), last: typeof s.adj.last === "string" ? s.adj.last : null };
  out.currency = typeof s.currency === "string" ? s.currency : "€";
  return out;
}
function portionProduct(x) {
  if (!x || !x.n) return null;
  const f = food(x.foodId);
  let p;
  if (f) p = productFromFood(f);
  else {
    const n = x.n;
    p = {
      id: uid(), foodId: null, code: x.code ?? "", name: x.name ?? x.fr ?? "", brand: x.brand ?? "", imageURL: x.img ?? "", tags: null,
      nova: typeof x.nova === "number" ? int(x.nova) : null, additives: int(pnum(x.additives)), categories: x.cats || [], allergens: x.allergens || [], analysis: x.analysis || [],
      packG: pnum(x.packG), n: { kcal: pnum(n.kcal), p: pnum(n.p), c: pnum(n.c), f: pnum(n.f), sugar: optNum(n.sugar), sat: optNum(n.sat), salt: optNum(n.salt), fiber: optNum(n.fiber) }, fixed: null,
    };
    const u = x.unit;
    p.unit = u && (u.k === "egg" || u.k === "tbsp") ? { kind: u.k, grams: pnum(u.g), step: pnum(u.step) } : null;
    p.fam = AISLES[x.fam] ? x.fam : guessedAisle(p);
  }
  p.packG = pnum(x.packG);
  p.fixed = optNum(x.fixed);
  return p;
}
function portionRow(x) {
  if (!x || !AISLES[x.fam]) return null;
  return {
    id: uid(), fam: x.fam, ref: x.ref ? portionProduct(x.ref) : null, name: typeof x.name === "string" ? x.name : null, g: optNum(x.g), fixedG: optNum(x.fixedG),
    got: pnum(x.got), done: x.done === true, fromRecipes: x.fromRec === true, ppk: optNum(x.ppk),
  };
}

/** Portion's data left in this browser: localStorage, or the IndexedDB copy it keeps. */
export async function portionInBrowser() {
  const all = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k !== "_alive") all[k] = localStorage.getItem(k);
    }
  } catch {}
  if (Object.keys(all).some((k) => k === "settings" || k.startsWith("log-"))) return all;
  try {
    const snap = await new Promise((resolve) => {
      const req = indexedDB.open("portion-backup");
      req.onerror = () => resolve(null);
      req.onupgradeneeded = () => {
        req.transaction.abort();
        resolve(null);
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction("kv", "readonly");
          const g = tx.objectStore("kv").get("snap");
          g.onsuccess = () => resolve(g.result);
          g.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    });
    if (snap && snap.all) return snap.all;
  } catch {}
  return null;
}

/** Adds the weigh-ins of days that have none yet (at 8:00). */
export function mergeWeights(weights) {
  const existing = new Set(S.bodyWeights.map((b) => dayKey(b.date)));
  for (const [day, kg] of Object.entries(weights)) {
    if (existing.has(day) || !(kg > 0)) continue;
    const t = keyDate(day) + 8 * 3_600_000;
    S.bodyWeights.push({ id: uid(), date: t, weight: kg });
  }
}

export { commit };
