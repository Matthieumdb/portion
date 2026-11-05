// Nutrition tab. For now it opens Portion, which runs on the same site and keeps its own data;
// that data is included in the backups made here.
import { h, icon } from "../ui.js";

export function nutritionTab() {
  return h(
    "div.page",
    h("header.large-title", h("h1", "Nutrition")),
    h(
      "section.card",
      h("div.card-title", { style: { color: "var(--orange)" } }, icon("fork", 18), "Portion"),
      h("h3", "Scanne, pèse, mange juste"),
      h("p.footnote", "Ton suivi des repas, les recettes et les courses sont dans Portion. Ses données sont comprises dans tes sauvegardes."),
      h("a.button.prominent", { href: "../" }, "Ouvrir Portion")
    )
  );
}
