// DOM helpers, icons, formatting and the controls that stand in for SwiftUI's.

/** h("div.card.tight", { onclick }, children…) */
export function h(tag, props, ...children) {
  const [name, ...classes] = tag.split(".");
  const el = document.createElement(name || "div");
  if (classes.length) el.className = classes.join(" ");
  if (props != null && (typeof props !== "object" || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "class") el.className = (el.className + " " + v).trim();
    else if (k === "html") el.innerHTML = v;
    else if (k === "ref") v(el);
    else if (k in el && typeof v !== "string" && k !== "list") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const SVG = "http://www.w3.org/2000/svg";
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children.flat()) if (c != null) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

// MARK: Icons (SF Symbols are not on the web: line icons drawn on a 24 grid)

const P = {
  dumbbell: "M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11",
  fork: "M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4M17 3c-1.7 1-2.5 3-2.5 6s1 4 2.5 4v8",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  chart: "M3 17l6-6 4 4 8-8M15 7h6v6",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.5l2.7 2.7L16 9.8",
  circle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  chevron: "M9 5l7 7-7 7",
  chevronDown: "M6 9l6 6 6-6",
  chevronUpDown: "M8 9l4-4 4 4M8 15l4 4 4-4",
  back: "M15 4l-8 8 8 8",
  left: "M15 5l-7 7 7 7",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  xmark: "M6 6l12 12M18 6 6 18",
  xcircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 9l6 6M15 9l-6 6",
  flame: "M12 22c4 0 7-3 7-7 0-5-4-7-5-11-2 2-3 4-3 6-1-1-2-2-2-4-2 2-4 5-4 9 0 4 3 7 7 7Z",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4",
  heart: "M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9Z",
  sparkles: "M10 3l1.8 4.7L16.5 9.5l-4.7 1.8L10 16l-1.8-4.7L3.5 9.5l4.7-1.8L10 3ZM18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  calendarCheck: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4",
  scale: "M5 20h14l-2-12H7L5 20ZM9 8a3 3 0 0 1 6 0",
  balance: "M12 4v16M7 20h10M5 8h14M5 8l-3 6a3 3 0 0 0 6 0L5 8ZM19 8l-3 6a3 3 0 0 0 6 0l-3-6",
  ruler: "M3 17L17 3l4 4L7 21l-4-4ZM7 13l2 2M10 10l2 2M13 7l2 2",
  photo: "M4 5h16v14H4zM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM7.5 18c.8-2 2.5-3 4.5-3s3.7 1 4.5 3",
  heartText: "M4 4h16v16H4zM12 16s-4-2.4-4.8-5A2.3 2.3 0 0 1 12 9.4 2.3 2.3 0 0 1 16.8 11C16 13.6 12 16 12 16Z",
  books: "M5 4h4v16H5zM10 4h4v16h-4zM15.5 5.2l3.8-1 3.8 15.3-3.8 1z",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  arrowUpCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16V8M8.5 11.5 12 8l3.5 3.5",
  arrowDownCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 8v8M8.5 12.5 12 16l3.5-3.5",
  swap: "M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z",
  note: "M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h6",
  ellipsis: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM7.5 12h.01M12 12h.01M16.5 12h.01",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  timer: "M12 13V9M9 2h6M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 21h4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  barcode: "M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M7 8v8M10 8v8M13 8v8M16 8v8",
  person: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6.5 18.5c1.2-2 3.2-3 5.5-3s4.3 1 5.5 3",
  cart: "M3 4h2l2.5 11h11L21 7H6.2M9 20h.01M17 20h.01",
  cartPlus: "M3 4h2l2.5 11h11L21 7H6.2M9 20h.01M17 20h.01M13 8v4M11 10h4",
  basket: "M3 10h18l-2 10H5L3 10ZM7 10l4-6M17 10l-4-6M9 14v3M15 14v3",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z",
  thumbUp: "M7 11v9H4v-9h3ZM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5a2 2 0 0 1 2 2.3l-1.2 6.5A2.5 2.5 0 0 1 16.8 20H7",
  thumbDown: "M7 13V4H4v9h3ZM7 13l4 8c1.5 0 2.5-1 2.5-2.5V15h5a2 2 0 0 0 2-2.3l-1.2-6.5A2.5 2.5 0 0 0 16.8 4H7",
  leaf: "M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c3-4 6-6 10-8",
  battery: "M3 8h15v8H3zM21 11v2M6 11v2",
  batteryLow: "M3 8h15v8H3zM21 11v2M6 11v2M6 11h2v2H6z",
  bed: "M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6M7 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  drop: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z",
  sunrise: "M12 3v4M5.6 8.6l1.4 1.4M18.4 8.6 17 10M3 16h18M7 16a5 5 0 0 1 10 0M5 20h14",
  carrot: "M14 10 4 20l-1-1L13 9M14 10a3 3 0 0 0-4-4l-1 1 7 7 1-1a3 3 0 0 0-3-3ZM15 4l1 3 3 1M18 3l-1 4",
  pan: "M4 13h12a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM16 13h5M8 9c0-1 1-1.5 1-3M12 9c0-1 1-1.5 1-3",
  checklist: "M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5",
  table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14",
  pie: "M12 3v9h9a9 9 0 1 1-9-9ZM15 3.5A9 9 0 0 1 20.5 9H15V3.5Z",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  upload: "M12 16V5M7 9l5-5 5 5M5 20h14",
  share: "M12 15V3M8 7l4-4 4 4M6 11H5v10h14V11h-1",
  keyboard: "M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8",
  wifiOff: "M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.2-2.4M12 20h.01M16 10.5a10 10 0 0 1 3 2.5M2 9a15 15 0 0 1 5-2.8M11 5.1A15 15 0 0 1 22 9",
  eraser: "M7 21h13M5.5 15.5l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L13 18H8l-2.5-2.5Z",
  percent: "M19 5 5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  seal: "M12 2.5l2.4 1.8 3-.1.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.1L12 21.5l-2.4-1.8-3 .1-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .1L12 2.5ZM8.5 12l2.5 2.5 4.5-5",
  pause: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM10 9v6M14 9v6",
  gauge: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18ZM12 13l4-4M6.5 13h.01M8 8.5h.01M12 6.5h.01M17.5 13h.01",
  chartBar: "M4 20h16M7 16v-5M12 16V6M17 16v-8",
  edit: "M4 20h4L19 9l-4-4L4 16v4Z",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  warning: "M12 3 2 20h20L12 3ZM12 10v4M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01",
  exclamation: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 8v5M12 16h.01",
  wand: "M4 20 15 9M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2ZM19 11l.7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7L19 11Z",
  plates: "M7 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM17 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM7 12h.01M17 12h.01",
  split: "M4 4h16v16H4zM12 4v16",
  stack: "M12 3l9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17l9 5 9-5",
  square: "M4 4h16v16H4z",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5",
  docPlus: "M6 3h9l4 4v14H6zM14 3v5h5M12 11v6M9 14h6",
  importDoc: "M6 3h9l4 4v14H6zM14 3v5h5M12 10v7M9 14l3 3 3-3",
  play: "M8 5.5v13l10-6.5-10-6.5Z",
  bolt: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
  starFill: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z",
  heartFill: "M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9Z",
  moon: "M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10Z",
  figure: "M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 9h10M12 9v6M9 21l3-6 3 6",
  strength: "M12 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4 10h16M4 8v4M20 8v4M9 10l1 4M15 10l-1 4M10 14l-1 7M14 14l1 7",
  rower: "M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 20h14M8 17l3-8 5 3M4 11h6",
  armsOpen: "M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 9l9 1 9-1M12 10v5M9 21l3-6 3 6",
  functional: "M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 21l2-7 2-3 3 2 3-5M10 14l4 3v4",
  run: "M14 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 21l3-6 3 2 2-5 4 2M9 9l3-2 2 3",
  cross: "M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 12l3-3h6l3 3M9 9l-1 6 2 6M15 9l1 6-2 6",
  core: "M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9 9h6v7H9zM9 12.5h6M12 9v7M10 16l-1 5M14 16l1 5",
  mixed: "M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 11l5-2 5 2M12 9v6M9 21l3-6 3 6M5 7l2 4M19 7l-2 4",
  fish: "M3 12c3-4 7-6 11-6 3 0 5 2 7 6-2 4-4 6-7 6-4 0-8-2-11-6ZM3 12l-1-3M3 12l-1 3M16 10h.01",
  egg: "M12 3c3.5 0 6 5.5 6 10a6 6 0 0 1-12 0c0-4.5 2.5-10 6-10Z",
  cup: "M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V8ZM17 10h2a2 2 0 0 1 0 4h-2M7 3v2M11 3v2",
  cheese: "M3 18 21 9v9H3ZM3 18V13l18-4M8 15h.01M14 14h.01",
  bag: "M5 8h14l-1 12H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2",
  apple: "M12 7c-1-2-4-2-5.5 0-2 3-1 9 2 12 1 1 2.5 1 3.5 0 1 1 2.5 1 3.5 0 3-3 4-9 2-12-1.5-2-4.5-2-5.5 0ZM12 7c0-2 1-3.5 3-4",
  cake: "M4 21h16M5 21v-8h14v8M5 16c2 1 3-1 5 0s3 1 5 0 3-1 4 0M12 13V9M12 6v.01",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z",
};

const FILLED = new Set(["play", "bolt", "starFill", "heartFill"]);

export function icon(name, size) {
  const svg = s("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", class: "icon" + (FILLED.has(name) ? " filled" : "") });
  if (size) {
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.style.width = size + "px";
    svg.style.height = size + "px";
  }
  svg.append(s("path", { d: P[name] || P.circle }));
  return svg;
}

// MARK: Formatting (French, like the iPhone set to French)

const nf = {};
export function num(v, max = 1, min = 0) {
  const key = min + "-" + max;
  nf[key] ??= new Intl.NumberFormat("fr-FR", { minimumFractionDigits: min, maximumFractionDigits: max });
  return nf[key].format(Object.is(v, -0) ? 0 : v);
}
/** Swift's rounded(): half away from zero. */
export const rnd = (x) => Math.sign(x) * Math.round(Math.abs(x));
/** Swift's Int(x): towards zero. */
export const int = (x) => Math.trunc(x) || 0;
export const kg = (v) => `${num(v, 1)} kg`;
export const kgPrecise = (v) => `${num(v, 2)} kg`;
export function durationText(ms) {
  const minutes = Math.trunc(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.trunc(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}
export function restLabel(seconds) {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${Math.trunc(seconds / 60)} min ${seconds % 60}`;
}
/** Swift's String.capitalized: every word starts upper case. */
export const capitalized = (t) => t.replace(/(^|[\s\-'’(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
export const capFirst = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
export const plural = (n, word, many = word + "s") => (n > 1 ? many : word);

export function fmtDate(d, opts) {
  return new Date(d).toLocaleDateString("fr-FR", opts);
}
export const dateAbbrev = (d) => fmtDate(d, { day: "numeric", month: "short", year: "numeric" });
export const dateLong = (d) => fmtDate(d, { day: "numeric", month: "long", year: "numeric" });
export const weekdayDayMonth = (d) => fmtDate(d, { weekday: "long", day: "numeric", month: "long" });
export const dayMonth = (d) => fmtDate(d, { day: "numeric", month: "long" });
export const time = (d) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
export const monthYear = (d) => fmtDate(d, { month: "long", year: "numeric" });

/** "il y a 2 jours", "hier", "il y a 3 heures" (Swift's relative named style). */
export function relative(d, now = Date.now()) {
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  const diff = (new Date(d).getTime() - now) / 1000;
  const a = Math.abs(diff);
  if (a < 60) return rtf.format(Math.round(diff), "second");
  if (a < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (a < 7 * 86400) return rtf.format(Math.round(diff / 86400), "day");
  if (a < 30 * 86400) return rtf.format(Math.round(diff / (7 * 86400)), "week");
  if (a < 365 * 86400) return rtf.format(Math.round(diff / (30 * 86400)), "month");
  return rtf.format(Math.round(diff / (365 * 86400)), "year");
}

/** "2026-11-05T14:03" for datetime-local inputs, in local time. */
export function localInput(d, withTime = true) {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  const day = `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  return withTime ? `${day}T${p(x.getHours())}:${p(x.getMinutes())}` : day;
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "x" + Math.random().toString(16).slice(2) + Date.now().toString(16)).toUpperCase();

// MARK: Colors

export const COLORS = {
  red: "var(--red)", orange: "var(--orange)", yellow: "var(--yellow)", green: "var(--green)", mint: "var(--mint)",
  teal: "var(--teal)", cyan: "var(--cyan)", blue: "var(--blue)", indigo: "var(--indigo)", purple: "var(--purple)",
  pink: "var(--pink)", brown: "var(--brown)", gray: "var(--gray)", accent: "var(--accent)",
};
export const gradient = (c) => `linear-gradient(180deg, color-mix(in srgb, ${c} 82%, white), ${c})`;

// MARK: Building blocks

export function cardTitle(title, iconName, tint = "var(--accent)") {
  return h("div.card-title", { style: { color: tint }, role: "heading", "aria-level": "3" }, iconName && icon(iconName), title);
}

export function card(...children) {
  return h("div.card", ...children);
}

export function section({ header, footer, headerClass = "", clear = false, id } = {}, ...cells) {
  return h(
    "div.section",
    id && { id },
    header && (typeof header === "string" ? h("div.section-header" + headerClass, header) : h("div.section-header" + headerClass, header)),
    h("div.list-group" + (clear ? ".clear" : ""), ...cells),
    footer && h("div.section-footer", footer)
  );
}

/** A list row. `onClick` makes it tappable; `chevron` adds the disclosure arrow. */
export function cell({ label, sub, value, lead, trailing, onClick, chevron, cls = "", destructive, action, labelNode, attrs = {} } = {}) {
  const tag = onClick ? "button.cell" : "div.cell";
  return h(
    tag + (cls ? "." + cls : "") + (destructive ? ".destructive" : "") + (action ? ".action" : ""),
    { onclick: onClick, type: onClick ? "button" : null, ...attrs },
    lead,
    labelNode ?? h("div.cell-label", h("span", label), sub && h("span.footnote.secondary", sub)),
    value != null && h("span.cell-value", value),
    trailing,
    chevron && h("span.chev", icon("chevron"))
  );
}

export function chev() {
  return h("span.chev", icon("chevron"));
}

export function iconTile(name, color) {
  return h("span.icon-tile", { style: { background: gradient(color) } }, icon(name));
}

/** iOS segmented control. */
export function segmented(options, value, onChange, { big = false, label } = {}) {
  return h(
    "div.segmented" + (big ? ".big" : ""),
    { role: "radiogroup", "aria-label": label },
    options.map(([v, text]) =>
      h("button" + (v === value ? ".on" : ""), { type: "button", role: "radio", "aria-checked": String(v === value), onclick: () => v !== value && onChange(v) }, text)
    )
  );
}

export function toggle(checked, onChange, label) {
  return h("input.switch", { type: "checkbox", role: "switch", checked, "aria-label": label, onchange: (e) => onChange(e.target.checked) });
}

/** − + stepper. */
export function stepper(value, onChange, { min = -Infinity, max = Infinity, step = 1, label } = {}) {
  return h(
    "div.stepper",
    { role: "group", "aria-label": label },
    h("button", { type: "button", "aria-label": "Moins", disabled: value - step < min - 1e-9, onclick: () => onChange(Math.max(min, +(value - step).toFixed(4))) }, icon("minus")),
    h("span.sep"),
    h("button", { type: "button", "aria-label": "Plus", disabled: value + step > max + 1e-9, onclick: () => onChange(Math.min(max, +(value + step).toFixed(4))) }, icon("plus"))
  );
}

/** Row with a label and a stepper, like Stepper("3 séries", value:…). */
export function stepperCell(label, value, onChange, opts = {}) {
  return h("div.cell", h("span.grow", label), stepper(value, onChange, { ...opts, label }));
}

/** Native <select> shown as the iOS picker row value. */
export function picker(options, value, onChange, { accent = false, label } = {}) {
  const current = options.find(([v]) => String(v) === String(value));
  const sel = h(
    "select",
    { "aria-label": label, onchange: (e) => onChange(options[e.target.selectedIndex][0]) },
    options.map(([v, text]) => h("option", { value: String(v), selected: String(v) === String(value) }, text))
  );
  return h("span.select-wrap" + (accent ? ".accent" : ""), h("span.select-label", current ? current[1] : ""), icon("chevronUpDown"), sel);
}

export function pickerCell(label, options, value, onChange, opts = {}) {
  return h("label.cell", h("span.grow", label), picker(options, value, onChange, { ...opts, label }));
}

export function toggleCell(label, checked, onChange, sub) {
  return h("label.cell", h("div.cell-label", h("span", label), sub && h("span.footnote.secondary", sub)), toggle(checked, onChange, label));
}

/** Text or number field. Number fields accept "82,5". Calls onCommit on change (blur/enter). */
export function input({ value, placeholder, type = "text", decimal = false, onInput, onCommit, cls = "field", align, attrs = {} }) {
  const isNum = type === "number";
  const el = h("input." + cls.split(" ").join("."), {
    type: isNum ? "text" : type,
    inputmode: isNum ? (decimal ? "decimal" : "numeric") : null,
    value: value == null || (isNum && Number.isNaN(value)) ? "" : isNum ? String(value).replace(".", ",") : value,
    placeholder,
    autocomplete: "off",
    enterkeyhint: "done",
    style: align ? { textAlign: align } : null,
    ...attrs,
  });
  const parse = () => (isNum ? parseNumber(el.value) : el.value);
  if (onInput) el.addEventListener("input", () => onInput(parse()));
  if (onCommit) el.addEventListener("change", () => onCommit(parse()));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && el.tagName === "INPUT") el.blur();
  });
  el.addEventListener("focus", () => isNum && setTimeout(() => el.select?.(), 0));
  return el;
}

export function parseNumber(text) {
  const t = String(text ?? "").replace(/\s/g, "").replace(",", ".");
  if (t === "" || t === "-") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** Row "Âge ........ 30 ans" with an editable value. */
export function numberCell(label, value, onCommit, { unit, digits = 1, placeholder } = {}) {
  return h(
    "label.cell",
    h("span.grow", label),
    input({ type: "number", decimal: digits > 0, value: value == null ? "" : rnd(value * 10 ** digits) / 10 ** digits, placeholder: placeholder ?? label, cls: "field right", attrs: { style: "max-width: 110px" }, onCommit: (v) => v != null && onCommit(v) }),
    unit && h("span.secondary", unit)
  );
}

export function textCell(value, placeholder, onCommit, { multiline = false, attrs = {} } = {}) {
  if (multiline) {
    const ta = h("textarea.field", { placeholder, rows: 2, ...attrs }, value || "");
    const grow = () => {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    };
    ta.addEventListener("input", grow);
    ta.addEventListener("change", () => onCommit(ta.value));
    requestAnimationFrame(grow);
    return h("div.cell", ta);
  }
  return h("label.cell", input({ value, placeholder, onCommit, attrs }));
}

export function searchField(value, placeholder, onInput, { autofocus = false } = {}) {
  const el = h("input", { type: "search", value, placeholder, autocomplete: "off", autocorrect: "off", spellcheck: false, enterkeyhint: "search" });
  el.addEventListener("input", () => onInput(el.value));
  el.addEventListener("keydown", (e) => e.key === "Enter" && el.blur());
  if (autofocus) setTimeout(() => el.focus(), 350);
  return h("label.search-field", icon("search"), el);
}

/** Activity-style ring that can go past 100 %. */
export function ring(progress, tint, { size = 70, width = 9, center } = {}) {
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(progress || 0, 1));
  const svg = s(
    "svg",
    { viewBox: `0 0 ${size} ${size}` },
    s("circle", { cx: size / 2, cy: size / 2, r, stroke: tint, "stroke-opacity": 0.18, "stroke-width": width }),
    s("circle", { cx: size / 2, cy: size / 2, r, stroke: tint, "stroke-width": width, "stroke-dasharray": c, "stroke-dashoffset": c * (1 - p) })
  );
  if (progress > 1) {
    svg.append(s("circle", { cx: size / 2, cy: size / 2, r, stroke: tint, "stroke-width": width, "stroke-dasharray": c, "stroke-dashoffset": c * (1 - Math.min(progress - 1, 1)), style: "filter: drop-shadow(0 0 2px rgba(0,0,0,.35))" }));
  }
  return h("div.ring", { style: { width: size + "px", height: size + "px" } }, svg, center && h("div.ring-center", center));
}

export function progressBar(progress, tint, height = 6) {
  const p = Math.max(0, Math.min(progress || 0, 1));
  return h("div.bar", { style: { height: height + "px", background: `color-mix(in srgb, ${tint} 18%, transparent)` } }, h("i", { style: { width: p * 100 + "%", background: tint } }));
}

export function emptyState(iconName, title, message) {
  return h("div.empty", icon(iconName), h("h3", title), message && h("p.subheadline", message));
}

export function inlineError(text) {
  return h("div.inline-error", icon("warning"), h("span", text));
}

export function disclosure(openSet, key, summary, content) {
  const d = h("details.disclosure", { open: openSet.has(key) }, h("summary", summary, h("span.disc-chev", icon("chevron"))), content);
  d.addEventListener("toggle", () => (d.open ? openSet.add(key) : openSet.delete(key)));
  return d;
}

// MARK: Feedback

let toastTimer;
export function toast(text, { high = false } = {}) {
  document.querySelector(".toast")?.remove();
  const raised = high || (!!document.querySelector("#page .bottom-inset") && !document.querySelector(".backdrop"));
  const el = h("div.toast" + (raised ? ".high" : ""), { role: "status" }, icon("checkCircle"), h("span", text));
  document.body.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 350);
  }, 2400);
}

export function haptic(pattern = 10) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

/** Action sheet, for Menu, contextMenu and confirmationDialog.
 *  items: [{ label, icon, destructive, checked, sub, disabled, onClick }] or null for a gap. */
export function menu(items, { title, message, cancel = "Annuler" } = {}) {
  const close = () => {
    bd.classList.remove("open");
    setTimeout(() => bd.remove(), 300);
  };
  const groups = [[]];
  for (const it of items) {
    if (!it) groups.push([]);
    else groups[groups.length - 1].push(it);
  }
  const bd = h(
    "div.menu-backdrop",
    { onclick: (e) => e.target === bd && close() },
    h(
      "div.menu",
      { role: "dialog", "aria-label": title || "Options" },
      (groups.some((g) => g.length) ? groups.filter((g) => g.length) : [[]]).map((g, gi) =>
        h(
          "div.menu-group",
          gi === 0 && (title || message) && h("div.menu-head", title && h("b", title), message),
          g.map((it) =>
            h(
              "button.menu-item" + (it.destructive ? ".destructive" : "") + (it.checked ? ".checked" : ""),
              { type: "button", disabled: it.disabled, onclick: () => { close(); setTimeout(() => it.onClick?.(), 10); } },
              it.icon && icon(it.icon),
              h("span.grow", it.label, it.sub && h("span.menu-sub", it.sub)),
              it.checked && h("span.check", icon("check"))
            )
          )
        )
      ),
      h("button.menu-item.menu-cancel", { type: "button", onclick: close }, cancel)
    )
  );
  document.body.append(bd);
  requestAnimationFrame(() => requestAnimationFrame(() => bd.classList.add("open")));
  return close;
}

/** Simple alert with an OK button. */
export const alert = (title, message) => menu([], { title, message, cancel: "OK" });

/** Picker as a list of choices with a check on the current one. */
export function choose(title, options, value, onChange) {
  menu(options.map(([v, label, sub]) => ({ label, sub, checked: String(v) === String(value), onClick: () => onChange(v) })), { title });
}

export function confirm(title, message, actionLabel, onConfirm, { destructive = true } = {}) {
  menu([{ label: actionLabel, destructive, onClick: onConfirm }], { title, message });
}

/** Alert with a text field, like .alert { TextField }. */
export function prompt(title, { message, value = "", placeholder = "", numeric = false, decimal = true, action = "OK", onSubmit }) {
  const close = () => {
    bd.classList.remove("open");
    setTimeout(() => bd.remove(), 300);
  };
  const field = h("input", { type: "text", inputmode: numeric ? (decimal ? "decimal" : "numeric") : null, value: value == null ? "" : String(value).replace(numeric ? "." : "\u0000", ","), placeholder, enterkeyhint: "done" });
  const submit = () => {
    close();
    onSubmit(numeric ? parseNumber(field.value) : field.value);
  };
  field.addEventListener("keydown", (e) => e.key === "Enter" && submit());
  const bd = h(
    "div.menu-backdrop",
    { onclick: (e) => e.target === bd && close() },
    h(
      "div.menu",
      { role: "dialog", "aria-label": title },
      h("div.menu-group", h("div.menu-head", h("b", title), message), h("div.menu-field", { style: { paddingTop: "12px" } }, field), h("button.menu-item", { type: "button", onclick: submit, style: { justifyContent: "center", fontWeight: "600" } }, action)),
      h("button.menu-item.menu-cancel", { type: "button", onclick: close }, "Annuler")
    )
  );
  document.body.append(bd);
  requestAnimationFrame(() => requestAnimationFrame(() => bd.classList.add("open")));
  setTimeout(() => {
    field.focus();
    field.select();
  }, 320);
}

/** Long press (or right click) opens a context menu. */
export function longPress(el, fn) {
  let timer;
  let moved = false;
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    fn();
  });
  el.addEventListener("touchstart", (e) => {
    moved = false;
    const t = e.touches[0];
    const x = t.clientX, y = t.clientY;
    timer = setTimeout(() => {
      if (!moved) {
        haptic(15);
        el.dataset.longpressed = "1";
        fn();
      }
    }, 520);
    el._lpMove = (ev) => {
      const u = ev.touches[0];
      if (Math.abs(u.clientX - x) > 8 || Math.abs(u.clientY - y) > 8) {
        moved = true;
        clearTimeout(timer);
      }
    };
  }, { passive: true });
  el.addEventListener("touchmove", (e) => el._lpMove?.(e), { passive: true });
  el.addEventListener("touchend", () => clearTimeout(timer));
  el.addEventListener("click", (e) => {
    if (el.dataset.longpressed) {
      delete el.dataset.longpressed;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  return el;
}

/** Swipe left to delete (and optionally right for a leading action), as in iOS lists. */
export function swipe(content, { onDelete, deleteLabel = "Supprimer", leading } = {}) {
  const wrap = h("div.swipe");
  const inner = h("div.swipe-content", content);
  const del = onDelete && h("button.swipe-action", { type: "button", onclick: () => onDelete() }, deleteLabel);
  const lead = leading && h("button.swipe-action.left", { type: "button", onclick: () => { reset(); leading.onClick(); } }, leading.label);
  if (lead) wrap.style.background = "var(--teal)";
  wrap.append(...[lead, del].filter(Boolean), inner);
  let x0 = 0, y0 = 0, dx = 0, dragging = false, decided = false, offset = 0;
  const reset = () => {
    offset = 0;
    inner.style.transform = "";
  };
  inner.addEventListener("touchstart", (e) => {
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
    dragging = false;
    decided = false;
  }, { passive: true });
  inner.addEventListener("touchmove", (e) => {
    const x = e.touches[0].clientX - x0, y = e.touches[0].clientY - y0;
    if (!decided) {
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
      decided = true;
      dragging = Math.abs(x) > Math.abs(y);
    }
    if (!dragging) return;
    dx = offset + x;
    if (!lead) dx = Math.min(0, dx);
    if (!del) dx = Math.max(0, dx);
    wrap.style.background = dx > 0 ? "var(--teal)" : "var(--red)";
    inner.classList.add("dragging");
    inner.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  inner.addEventListener("touchend", () => {
    inner.classList.remove("dragging");
    if (!dragging) return;
    if (dx < -200 && del) {
      inner.style.transform = "translateX(-100%)";
      setTimeout(() => onDelete(), 180);
      return;
    }
    offset = dx < -50 ? -96 : dx > 50 ? 96 : 0;
    inner.style.transform = offset ? `translateX(${offset}px)` : "";
  });
  inner.addEventListener("click", (e) => {
    if (offset !== 0) {
      e.preventDefault();
      e.stopPropagation();
      reset();
    }
  }, true);
  return wrap;
}

// MARK: Charts (Swift Charts stand-ins)

const W = 340;

/** Vertical bars with optional labels under them and a dashed target rule. */
export function barChart(values, { height = 150, labels = [], colors, color = "var(--accent)", rule, ruleLabel, max, opacities } = {}) {
  const top = rule != null ? 16 : 6;
  const hMax = max ?? Math.max(1, ...values, rule ?? 0);
  const bottom = labels.some(Boolean) ? 16 : 2;
  const ch = height - top - bottom;
  const bw = W / Math.max(values.length, 1);
  const svg = s("svg", { viewBox: `0 0 ${W} ${height}`, class: "chart", role: "img" });
  [0.5, 1].forEach((f) => svg.append(s("line", { x1: 0, x2: W, y1: top + ch * (1 - f), y2: top + ch * (1 - f), class: "grid" })));
  svg.append(s("line", { x1: 0, x2: W, y1: top + ch, y2: top + ch, class: "grid" }));
  values.forEach((v, i) => {
    const bh = Math.max(0, (v / hMax) * ch);
    svg.append(s("rect", { x: i * bw + bw * 0.15, y: top + ch - bh, width: Math.max(1, bw * 0.7), height: v > 0 ? Math.max(bh, 2) : 0, rx: Math.min(4, bw * 0.25), fill: colors?.[i] ?? color, "fill-opacity": opacities?.[i] ?? 1 }));
    if (labels[i]) svg.append(s("text", { x: i * bw + bw / 2, y: height - 3, "text-anchor": "middle" }, labels[i]));
  });
  if (rule != null) {
    const y = top + ch * (1 - rule / hMax);
    svg.append(s("line", { x1: 0, x2: W, y1: y, y2: y, stroke: "var(--ink)", "stroke-opacity": 0.6, "stroke-width": 1.5, "stroke-dasharray": "4 4" }));
    if (ruleLabel) svg.append(s("text", { x: 2, y: y - 4 }, ruleLabel));
  }
  return svg;
}

/** Line through points [{x: ms, y}], oldest first, with dots and min/max labels. */
export function lineChart(points, { height = 200, color = "var(--accent)", dots = true, format = (v) => num(v, 1), axes = true, width = 3, smooth = true } = {}) {
  const pad = axes ? 30 : 4;
  const svg = s("svg", { viewBox: `0 0 ${W} ${height}`, class: "chart", role: "img" });
  if (!points.length) return svg;
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;
  const xs = points.map((p) => +p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const top = 8, bottom = axes ? 18 : 4;
  const px = (x) => (x1 === x0 ? (W - pad) / 2 : 4 + ((x - x0) / (x1 - x0)) * (W - pad - 8));
  const py = (y) => top + (1 - (y - min) / (max - min)) * (height - top - bottom);
  if (axes) {
    [0, 0.5, 1].forEach((f) => {
      const v = min + (max - min) * f;
      svg.append(s("line", { x1: 0, x2: W - pad, y1: py(v), y2: py(v), class: "grid" }));
      svg.append(s("text", { x: W, y: py(v) + 3, "text-anchor": "end" }, format(v)));
    });
    const fmt = (t) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    svg.append(s("text", { x: 2, y: height - 3 }, fmt(x0)));
    if (x1 !== x0) svg.append(s("text", { x: W - pad, y: height - 3, "text-anchor": "end" }, fmt(x1)));
  }
  const pts = points.map((p) => [px(+p.x), py(p.y)]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [xa, ya] = pts[i - 1], [xb, yb] = pts[i];
    if (smooth) {
      const cx = (xa + xb) / 2;
      d += ` C${cx.toFixed(1)},${ya.toFixed(1)} ${cx.toFixed(1)},${yb.toFixed(1)} ${xb.toFixed(1)},${yb.toFixed(1)}`;
    } else d += ` L${xb.toFixed(1)},${yb.toFixed(1)}`;
  }
  svg.append(s("path", { d, fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round" }));
  if (dots) pts.forEach(([x, y]) => svg.append(s("circle", { cx: x, cy: y, r: 3.5, fill: color })));
  return svg;
}

/** Horizontal bars with a label on the left and the value on the right. */
export function hBarChart(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return h(
    "div.vstack.gap6",
    rows.map((r) =>
      h(
        "div.hstack",
        h("span.footnote", { style: { width: "86px", flex: "none" } }, r.label),
        h("div.grow", h("div", { style: { height: "18px", width: Math.max(3, (r.value / max) * 100) + "%", borderRadius: "5px", background: gradient(r.color) } })),
        h("span.footnote.secondary.mono", { style: { width: "28px", textAlign: "right" } }, r.value)
      )
    )
  );
}
