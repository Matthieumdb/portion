// Pieces shared by several screens: bar buttons, muscle icons, exercise pictures, tiles.
import { h, icon, gradient, num } from "../ui.js";
import { muscle, libEntry, imageURL, libMuscleGroup } from "../model.js";
import { tick } from "../nav.js";

export function barBtn(label, onClick, { bold = false, iconName, aria, disabled } = {}) {
  return h("button.bar-button" + (bold ? ".bold" : ""), { type: "button", onclick: onClick, "aria-label": aria || (iconName && !label ? label : null), disabled }, iconName && icon(iconName, 22), label);
}
export const okBtn = (ctx, label = "OK", fn) => barBtn(label, () => (fn ? fn() : ctx.close()), { bold: true });
export const cancelBtn = (ctx, label = "Annuler", fn) => barBtn(label, () => (fn ? fn() : ctx.close()));

export function muscleIcon(group, size = 36) {
  const m = muscle(group);
  return h("span.muscle-icon", { style: { width: size + "px", height: size + "px", borderRadius: size * 0.28 + "px", background: gradient(m.color) }, "aria-hidden": "true" }, icon(m.icon));
}

/** First frame of a library exercise, as a small rounded thumbnail. */
export function thumb(entry, size = 44) {
  const box = h("span.thumb", { style: { width: size * 1.4 + "px", height: size + "px", borderRadius: size * 0.22 + "px" } });
  const img = h("img", { src: imageURL(entry.id, 1), alt: "", loading: "lazy", decoding: "async" });
  img.addEventListener("error", () => {
    const m = muscle(libMuscleGroup(entry));
    img.replaceWith(h("span", { style: { color: m.color, display: "inline-flex" } }, icon(m.icon, size * 0.45)));
  });
  box.append(img);
  return box;
}

export function exerciseIcon(ex, size = 32) {
  const e = ex && libEntry(ex);
  return e ? thumb(e, size) : muscleIcon(ex?.muscleGroup || "fullBody", size);
}

/** Start and end positions of the exercise in a loop. */
export function exerciseAnimation(entry) {
  const box = h("div.anim");
  const imgs = [0, 1].map((f) => h("img", { src: imageURL(entry.id, f), alt: f === 0 ? `Exécution : ${entry.nameFR}` : "", style: { opacity: f === 0 ? 1 : 0 } }));
  let failed = 0;
  imgs.forEach((img) =>
    img.addEventListener("error", () => {
      img.remove();
      if (++failed === 2) box.replaceChildren(h("div.vstack.center", { style: { alignItems: "center", gap: "6px" } }, icon("wifiOff", 26), h("span.caption", "Illustration indisponible hors connexion")));
    })
  );
  box.append(...imgs);
  let i = 0;
  tick(() => {
    if (!box.isConnected || failed) return;
    i = 1 - i;
    imgs[0].style.opacity = i === 0 ? 1 : 0;
    imgs[1].style.opacity = i === 1 ? 1 : 0;
  });
  return box;
}

export function statTile(value, label, iconName, tint) {
  return h("div.stat-tile", h("span", { style: { color: tint } }, icon(iconName)), h("span.display", { style: { fontSize: "22px" } }, value), h("span.caption.secondary.clamp2", label));
}

export function statItem(value, label, tint) {
  return h("div.stat-item", h("span.display", { style: { fontSize: "24px", color: tint } }, value), h("span.caption.secondary.ellipsis", label));
}

export function primaryButton(label, onClick, iconName, { disabled = false } = {}) {
  return h("button.btn.primary", { type: "button", onclick: onClick, disabled }, iconName && icon(iconName), label);
}

export function advice({ iconName, tint, title, message, action, onAction }) {
  return h(
    "div.advice",
    { style: { background: `color-mix(in srgb, ${tint} 10%, transparent)` } },
    h("span", { style: { color: tint } }, icon(iconName)),
    h("div.grow.vstack.gap2", h("span.subheadline.semibold", title), h("span.footnote.secondary", message)),
    action && h("button.chip.small", { type: "button", onclick: onAction, style: { color: tint, background: `color-mix(in srgb, ${tint} 16%, transparent)`, fontWeight: 600 } }, action)
  );
}

export const kgText = (v) => `${num(v, 1)} kg`;
