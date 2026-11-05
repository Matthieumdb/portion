// Navigation in the style of iOS: a stack per tab with large titles, a floating tab bar,
// and sheets with their own stack. A screen is (ctx) => ({ title, large, subtitle, left, right, body, bottom }).
import { h, icon, append } from "./ui.js";

const TABS = [];
const stacks = {};
let current = null;
const sheets = []; // [{ stack: [entry], el, opts }]
let root, page, tabBar;
let pending = false;
let freshEntry = null;
const tickers = new Set();

export function defineTabs(list) {
  TABS.push(...list);
  for (const t of list) stacks[t.id] = [{ screen: t.screen, props: {}, local: {}, scroll: 0 }];
  current = list[0].id;
}
export const currentTab = () => current;

export function mount(el) {
  root = el;
  page = h("div", { id: "page" });
  tabBar = h("nav.tab-bar", { role: "tablist" });
  root.replaceChildren(page, tabBar);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("focusout", () => {
    if (!pending) return;
    setTimeout(() => {
      if (pending) render();
    }, 0);
  });
  setInterval(() => tickers.forEach((t) => t()), 1000);
  render();
}

function onScroll() {
  const bar = page.querySelector(".nav-bar");
  if (bar) bar.classList.toggle("scrolled", window.scrollY > (bar.classList.contains("large") ? 44 : 4));
}

const editing = () => {
  const a = document.activeElement;
  return a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && !["checkbox", "radio", "button", "file"].includes(a.type)));
};

/** Redraws the visible screen and the open sheets (later, while a field is being edited). */
export function refresh() {
  if (editing()) {
    pending = true;
    return;
  }
  if (pending) return;
  pending = true;
  requestAnimationFrame(render);
}

/** Registers a function called every second while the screen is shown (timers). */
export function tick(fn) {
  tickers.add(fn);
  return fn;
}

function ctxFor(stack, entry, sheet) {
  const ctx = {
    props: entry.props,
    local: entry.local,
    isSheet: !!sheet,
    depth: stack.indexOf(entry),
    push(screen, props = {}) {
      entry.scroll = sheet ? sheet.scrollEl?.scrollTop || 0 : window.scrollY;
      const e = { screen, props, local: {}, scroll: 0 };
      stack.push(e);
      freshEntry = e;
      render();
      if (!sheet) window.scrollTo(0, 0);
      else if (sheet.scrollEl) sheet.scrollEl.scrollTop = 0;
    },
    pop() {
      if (stack.length > 1) {
        stack.pop();
        const top = stack[stack.length - 1];
        render();
        if (!sheet) window.scrollTo(0, top.scroll);
        else if (sheet.scrollEl) sheet.scrollEl.scrollTop = top.scroll;
      } else if (sheet) closeSheet(sheet);
    },
    popToRoot() {
      stack.splice(1);
      render();
    },
    present: (screen, props, opts) => present(screen, props, opts),
    close() {
      if (sheet) closeSheet(sheet);
    },
    refresh,
  };
  return ctx;
}

function navBar(v, ctx, stack, isSheet) {
  const back = !isSheet && stack.length > 1;
  const prevTitle = back ? stack[stack.length - 2].lastTitle : null;
  const left = v.left ?? (back ? h("button.back-button", { type: "button", onclick: () => ctx.pop(), "aria-label": "Retour" }, icon("back", 24), h("span", v.backLabel ?? (prevTitle && prevTitle.length < 14 ? prevTitle : "Retour"))) : null);
  if (isSheet) {
    const bar = h("div.sheet-header", h("div.nav-left", left ?? (stack.length > 1 ? h("button.back-button", { type: "button", onclick: () => ctx.pop() }, icon("back", 24), h("span", "Retour")) : null)), h("h2", v.title || ""), h("div.nav-right", v.right));
    return bar;
  }
  return h("header.nav-bar" + (v.large ? ".large" : ""), h("div.nav-left", left), h("div.nav-title", v.title || ""), h("div.nav-right", v.right));
}

function build(stack, sheet) {
  const entry = stack[stack.length - 1];
  const ctx = ctxFor(stack, entry, sheet);
  let v;
  try {
    v = entry.screen(ctx) || {};
  } catch (e) {
    console.error(e);
    v = { title: "Erreur", body: h("div.card", h("p", "Un problème est survenu sur cet écran."), h("p.footnote.secondary", String(e?.message || e))) };
  }
  entry.lastTitle = v.title;
  return { v, ctx, entry };
}

function render() {
  pending = false;
  tickers.clear();
  // Remember the focused field to give it the focus back after the redraw
  const a = document.activeElement;
  const fid = a?.dataset?.fid;
  const sel = fid && "selectionStart" in a ? [a.selectionStart, a.selectionEnd] : null;

  // Page
  const stack = stacks[current];
  const { v, ctx, entry } = build(stack, null);
  const screen = h("div.screen" + (v.bottom ? ".has-bottom" : ""));
  screen.append(navBar(v, ctx, stack, false));
  const body = h("div.screen-body" + (v.list ? ".list" : ""));
  if (v.large && v.title) body.append(h("div.title-block", h("h1.large-title", v.title), v.subtitle && h("div.subtitle", v.subtitle)));
  append(body, [v.body]);
  screen.append(body);
  if (entry === freshEntry) screen.classList.add("page-in");
  const nodes = [screen];
  if (v.bottom) nodes.push(h("div.bottom-inset", v.bottom));
  if (v.overlay) nodes.push(v.overlay);
  page.replaceChildren(...nodes);
  onScroll();

  // Tab bar
  tabBar.replaceChildren(
    ...TABS.map((t) =>
      h(
        "button.tab" + (t.id === current ? ".on" : "") + (t.live?.() ? ".live" : ""),
        { type: "button", role: "tab", "aria-selected": String(t.id === current), onclick: () => selectTab(t.id) },
        icon(t.icon),
        h("span", t.label)
      )
    )
  );
  tabBar.style.display = sheets.length ? "none" : "";

  // Sheets
  for (const sh of sheets) renderSheet(sh);
  freshEntry = null;

  if (fid) {
    const el = document.querySelector(`[data-fid="${CSS.escape(fid)}"]`);
    if (el && el !== document.activeElement) {
      el.focus({ preventScroll: true });
      if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch {}
    }
  }
}

export function selectTab(id) {
  if (id === current) {
    // Tapping the current tab goes back to its first screen
    if (stacks[id].length > 1) {
      stacks[id].splice(1);
      render();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  stacks[current][stacks[current].length - 1].scroll = window.scrollY;
  current = id;
  render();
  const top = stacks[id][stacks[id].length - 1];
  window.scrollTo(0, top.scroll || 0);
}

/** Opens a sheet. opts.detent: "large" (default), "medium" or "fit". */
export function present(screen, props = {}, opts = {}) {
  const sh = { stack: [{ screen, props, local: {}, scroll: 0 }], opts };
  const sheet = h("div.sheet" + (opts.detent && opts.detent !== "large" ? "." + opts.detent : ""), { role: "dialog", "aria-modal": "true" });
  const bd = h("div.backdrop", { onclick: (e) => e.target === bd && opts.dismissable !== false && closeSheet(sh) }, sheet);
  sh.el = bd;
  sh.sheet = sheet;
  sheets.push(sh);
  document.body.append(bd);
  document.body.style.overflow = "hidden";
  renderSheet(sh);
  tabBar && (tabBar.style.display = "none");
  requestAnimationFrame(() => requestAnimationFrame(() => bd.classList.add("open")));
  dragToClose(sh);
  return sh;
}

function renderSheet(sh) {
  const { v, ctx } = build(sh.stack, sh);
  const prevScroll = sh.scrollEl?.scrollTop ?? 0;
  const header = navBar(v, ctx, sh.stack, true);
  const scroll = h("div.sheet-scroll" + (v.bottom ? ".has-bottom" : ""));
  if (v.large && v.title) scroll.append(h("div.title-block", h("h1.large-title", v.title), v.subtitle && h("div.subtitle", v.subtitle)));
  append(scroll, [h("div.screen-body" + (v.list ? ".list" : ""), v.body)]);
  const parts = [header];
  if (v.search) parts.push(h("div.sheet-search", v.search));
  parts.push(scroll);
  if (v.bottom) parts.push(h("div.sheet-bottom", v.bottom));
  sh.sheet.replaceChildren(...parts);
  sh.scrollEl = scroll;
  scroll.scrollTop = prevScroll;
  sh.header = header;
}

export function closeSheet(sh = sheets[sheets.length - 1]) {
  if (!sh) return;
  const i = sheets.indexOf(sh);
  if (i < 0) return;
  sheets.splice(i, 1);
  sh.opts.onClose?.();
  sh.el.classList.remove("open");
  setTimeout(() => sh.el.remove(), 380);
  if (!sheets.length) {
    document.body.style.overflow = "";
    if (tabBar) tabBar.style.display = "";
  }
  refresh();
}
export const closeAllSheets = () => [...sheets].reverse().forEach((s) => closeSheet(s));
export const hasSheets = () => sheets.length > 0;

function dragToClose(sh) {
  let y0 = null, dy = 0;
  sh.sheet.addEventListener("touchstart", (e) => {
    const inHeader = e.target.closest(".sheet-header");
    const atTop = sh.scrollEl && sh.scrollEl.scrollTop <= 0 && e.target.closest(".sheet-scroll");
    if (sh.opts.dismissable === false || (!inHeader && !atTop) || e.target.closest("input, textarea, select, button")) return;
    y0 = e.touches[0].clientY;
    dy = 0;
  }, { passive: true });
  sh.sheet.addEventListener("touchmove", (e) => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 0) {
      sh.sheet.style.transition = "none";
      sh.sheet.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });
  sh.sheet.addEventListener("touchend", () => {
    if (y0 == null) return;
    sh.sheet.style.transition = "";
    sh.sheet.style.transform = "";
    if (dy > 120) closeSheet(sh);
    y0 = null;
  });
}

/** Goes to a tab and pushes screens on it (for links between tabs). */
export function openInTab(tab, screen, props) {
  closeAllSheets();
  if (current !== tab) selectTab(tab);
  const stack = stacks[tab];
  stack.splice(1);
  if (screen) {
    const e = { screen, props: props || {}, local: {}, scroll: 0 };
    stack.push(e);
    freshEntry = e;
  }
  render();
  window.scrollTo(0, 0);
}
