// Entry point: tab bar, per-tab navigation and the screen refresh.
import { h, icon } from "./ui.js";
import { initStore, subscribe, getState } from "./store.js";
import { requestPersistence } from "./db.js";
import { workoutTab, tickElapsed } from "./views/workout.js";
import { historyTab } from "./views/history.js";
import { progressTab } from "./views/progress.js";
import { nutritionTab } from "./views/nutrition.js";
import { settingsTab, applyAppearance } from "./views/settings.js";
import { rest } from "./rest.js";

const TABS = [
  { id: "workout", label: "Séance", icon: "dumbbell", view: workoutTab },
  { id: "nutrition", label: "Nutrition", icon: "fork", view: nutritionTab },
  { id: "history", label: "Historique", icon: "clock", view: historyTab },
  { id: "progress", label: "Progrès", icon: "chart", view: progressTab },
  { id: "settings", label: "Réglages", icon: "gear", view: settingsTab },
];

let current = "workout";
try {
  current = sessionStorage.getItem("tab") || "workout";
} catch {}

/** One stack of screens per tab, like UINavigationController. */
const stacks = Object.fromEntries(TABS.map((t) => [t.id, [{}]]));
const scroll = {};

function navFor(tab) {
  const stack = stacks[tab];
  return {
    ...stack[stack.length - 1],
    open(params) {
      scroll[tab + stack.length] = window.scrollY;
      stack.push(params);
      render();
      window.scrollTo(0, 0);
    },
    back() {
      if (stack.length > 1) stack.pop();
      render();
      window.scrollTo(0, scroll[tab + stack.length] || 0);
    },
    goTo(id) {
      select(id);
    },
  };
}

const main = h("main");
const tabBar = h(
  "nav.tab-bar",
  { "aria-label": "Onglets" },
  TABS.map((t) =>
    h("button.tab", { "data-tab": t.id, onclick: () => select(t.id), "aria-label": t.label }, icon(t.icon, 24), h("span", t.label))
  )
);

function select(id) {
  const same = id === current;
  if (same) {
    // Tapping the current tab goes back to its first screen, as on iOS
    stacks[id] = [{}];
  } else {
    scroll[current] = window.scrollY;
  }
  current = id;
  try {
    sessionStorage.setItem("tab", id);
  } catch {}
  render();
  window.scrollTo(0, same ? 0 : scroll[id] || 0);
}

function render() {
  const tab = TABS.find((t) => t.id === current) || TABS[0];
  const y = window.scrollY;
  main.replaceChildren(tab.view(navFor(tab.id)));
  window.scrollTo(0, y);
  tabBar.querySelectorAll(".tab").forEach((b) => {
    const on = b.dataset.tab === tab.id;
    b.classList.toggle("on", on);
    b.setAttribute("aria-current", on ? "page" : "false");
  });
  const active = !!getState().active;
  tabBar.querySelector('[data-tab="workout"]').classList.toggle("live", active);
}

async function boot() {
  await initStore();
  applyAppearance();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyAppearance);
  document.body.replaceChildren(main, tabBar);
  render();
  subscribe(() => {
    // Keep the focus when a sheet or a field is being used
    if (document.querySelector(".backdrop")) return;
    render();
  });
  rest.resume();
  setInterval(tickElapsed, 15000);
  requestPersistence();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Refresh the screen once a sheet closes, so it shows what the sheet changed
document.addEventListener("sheetclosed", () => {
  if (!document.querySelector(".backdrop")) render();
});

boot();
