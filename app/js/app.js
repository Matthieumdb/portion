// Entry point: loads the data, then the five tabs of the iPhone app (ContentView.swift).
import { h, icon, card, toast } from "./ui.js";
import { S, initStore, subscribe, commit, flush } from "./store.js";
import { backupIsDue, exportBackup } from "./backup.js";
import { loadLibrary, seedIfNeeded, activeWorkout } from "./model.js";
import { loadNutritionData, N } from "./nutrition.js";
import { defineTabs, mount, refresh } from "./nav.js";
import { workoutRoot, provide } from "./views/workout.js";
import { historyRoot, workoutDetail } from "./views/history.js";
import { progressRoot, recapView } from "./views/progress.js";
import { nutritionRoot } from "./views/nutrition.js";
import { settingsRoot, applyAppearance } from "./views/settings.js";

provide({ workoutDetail, recapView });

let reminderHidden = false;
function reminderCard() {
  return card(
    h(
      "div.hstack",
      { style: { gap: "12px", alignItems: "flex-start" } },
      h("span.accent", icon("upload", 26)),
      h("div.grow.vstack", { style: { gap: "4px" } }, h("span.headline", "Sauvegarde de la semaine"), h("span.footnote.secondary", "Tes données sont sur cet appareil. Exporte une copie vers Fichiers ou iCloud Drive, au cas où."))
    ),
    h(
      "div.btn-row",
      { style: { marginTop: "12px" } },
      h("button.btn.plain.small", { type: "button", onclick: () => { reminderHidden = true; refresh(); } }, "Plus tard"),
      h("button.btn.primary.small", { type: "button", style: { flex: 1 }, onclick: () => exportBackup().then((ok) => ok && toast("Sauvegarde exportée")) }, "Exporter")
    )
  );
}

function workoutTab(ctx) {
  const v = workoutRoot(ctx);
  if (!activeWorkout() && !reminderHidden && backupIsDue()) v.body = [reminderCard(), ...[v.body].flat()];
  return v;
}

async function boot() {
  await initStore();
  try {
    await Promise.all([loadLibrary(), loadNutritionData()]);
  } catch (e) {
    console.error(e);
  }
  commit(() => {
    seedIfNeeded();
    N();
  });
  applyAppearance();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyAppearance);
  defineTabs([
    { id: "workout", label: "Séance", icon: "dumbbell", screen: workoutTab, live: () => !!activeWorkout() },
    { id: "nutrition", label: "Nutrition", icon: "fork", screen: nutritionRoot },
    { id: "history", label: "Historique", icon: "history", screen: historyRoot },
    { id: "progress", label: "Progrès", icon: "chart", screen: progressRoot },
    { id: "settings", label: "Réglages", icon: "gear", screen: settingsRoot },
  ]);
  const root = h("div", { id: "app" });
  document.body.replaceChildren(root);
  mount(root);
  subscribe(() => refresh());
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  window.addEventListener("beforeunload", () => flush());
}

boot().catch((e) => {
  console.error(e);
  document.body.replaceChildren(h("div.card", { style: { margin: "40px 16px" } }, h("p", "L'app n'a pas pu démarrer."), h("p.footnote.secondary", String(e?.message || e))));
});
