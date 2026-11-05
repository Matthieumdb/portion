// Small DOM helpers.

/** h("div.card", { onclick }, children…) */
export function h(tag, props, ...children) {
  const [name, ...classes] = tag.split(".");
  const el = document.createElement(name || "div");
  if (classes.length) el.className = classes.join(" ");
  if (props && (typeof props !== "object" || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "class") el.className += " " + v;
    else if (k in el && k !== "list" && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** SF Symbols are not available on the web: a small set of line icons instead. */
const ICONS = {
  dumbbell: "M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  chart: "M4 19h16M7 16V10M12 16V6M17 16v-4",
  fork: "M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4M17 3c-1.7 1-2.5 3-2.5 6s1 4 2.5 4v8",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  plus: "M12 5v14M5 12h14",
  play: "M8 5.5v13l10-6.5-10-6.5Z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  chevron: "M9 6l6 6-6 6",
  back: "M15 6l-6 6 6 6",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  close: "M6 6l12 12M18 6 6 18",
  bolt: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
  cloud: "M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18Z",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  upload: "M12 16V5M7 9l5-5 5 5M5 20h14",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  scale: "M5 20h14l-2-12H7L5 20ZM9 8a3 3 0 0 1 6 0",
  timer: "M12 13V9M9 2h6M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
  edit: "M4 20h4L19 9l-4-4L4 16v4Z",
  flame: "M12 22c4 0 7-3 7-7 0-5-4-7-5-11-2 2-3 4-3 6-1-1-2-2-2-4-2 2-4 5-4 9 0 4 3 7 7 7Z",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4",
};

export function icon(name, size = 22) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", ICONS[name] || "");
  svg.append(path);
  return svg;
}

export const kg = (v) => `${(Math.round(v * 100) / 100).toLocaleString("fr-FR")} kg`;

export function formatDate(d, opts = { weekday: "long", day: "numeric", month: "long" }) {
  const s = new Date(d).toLocaleDateString("fr-FR", opts);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function duration(ms) {
  const min = Math.round(ms / 60000);
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}` : `${min} min`;
}

/** Bottom sheet, like iOS. Returns a function that closes it. */
export function sheet(title, build, { onClose } = {}) {
  const close = () => {
    backdrop.classList.remove("open");
    setTimeout(() => {
      backdrop.remove();
      document.dispatchEvent(new Event("sheetclosed"));
    }, 250);
    onClose?.();
  };
  const body = h("div.sheet-body");
  const panel = h(
    "div.sheet",
    { role: "dialog", "aria-modal": "true", "aria-label": title },
    h("header.sheet-header", h("span"), h("h2", title), h("button.text-button", { onclick: close }, "OK")),
    body
  );
  const backdrop = h("div.backdrop", { onclick: (e) => e.target === backdrop && close() }, panel);
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("open"));
  const render = () => {
    body.replaceChildren(build(close, render));
  };
  render();
  return close;
}

/** Native-looking confirmation, without blocking dialogs. */
export function confirmSheet(title, message, action, onConfirm, { destructive = true } = {}) {
  const close = sheet(title, () =>
    h(
      "div.stack",
      message && h("p.footnote", message),
      h("button.button" + (destructive ? ".destructive" : ".prominent"), { onclick: () => { close(); onConfirm(); } }, action),
      h("button.button", { onclick: () => close() }, "Annuler")
    )
  );
}

let toastTimer;
export function toast(text) {
  document.querySelector(".toast")?.remove();
  const el = h("div.toast", { role: "status" }, text);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

const SVG = "http://www.w3.org/2000/svg";
function s(tag, attrs = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Bars, one per value, with a label under each. */
export function barChart(values, labels, { height = 100, color = "var(--accent)" } = {}) {
  const w = 320;
  const max = Math.max(3, ...values);
  const bw = w / values.length;
  const svg = s("svg", { viewBox: `0 0 ${w} ${height + 18}`, class: "chart", role: "img" });
  values.forEach((v, i) => {
    const bh = (v / max) * height;
    svg.append(s("rect", { x: i * bw + bw * 0.18, y: height - bh, width: bw * 0.64, height: Math.max(bh, v ? 2 : 0), rx: 4, fill: color }));
    if (labels[i]) {
      const t = s("text", { x: i * bw + bw / 2, y: height + 14, "text-anchor": "middle", class: "chart-label" });
      t.textContent = labels[i];
      svg.append(t);
    }
  });
  return svg;
}

/** Line through points [{x: Date, y}], oldest first. */
export function lineChart(points, { height = 160, color = "var(--accent)", format = (v) => v } = {}) {
  const w = 320;
  const pad = 8;
  const svg = s("svg", { viewBox: `0 0 ${w} ${height}`, class: "chart", role: "img" });
  if (points.length === 0) return svg;
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const xs = points.map((p) => +p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  const px = (x) => (x1 === x0 ? w / 2 : pad + ((x - x0) / (x1 - x0)) * (w - pad * 2));
  const py = (y) => pad + (1 - (y - min) / (max - min)) * (height - pad * 2 - 14);
  const d = points.map((p, i) => `${i ? "L" : "M"}${px(+p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  svg.append(s("path", { d, fill: "none", stroke: color, "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }));
  points.forEach((p) => svg.append(s("circle", { cx: px(+p.x), cy: py(p.y), r: 3.5, fill: color })));
  const label = (text, y) => {
    const t = s("text", { x: w - 2, y, "text-anchor": "end", class: "chart-label" });
    t.textContent = text;
    svg.append(t);
  };
  label(format(max), 12);
  label(format(min), height - 2);
  return svg;
}
