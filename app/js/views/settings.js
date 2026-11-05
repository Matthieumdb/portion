// Réglages tab (SettingsView.swift, HevyImportView.swift) plus what the web needs: auto-save status and restore points.
import { h, icon, section, cell, pickerCell, toggleCell, toast, confirm, alert, menu, restLabel, num, dateLong, time, fmtDate, plural, dateAbbrev, kgPrecise, choose } from "../ui.js";
import { S, commit, saveStatus } from "../store.js";
import { REST_OPTIONS, PROGRESSION_OPTIONS, BAR_OPTIONS, APPEARANCES, activeWorkout, LIB } from "../model.js";
import { exportBackup, readBackup, applyBackup, restorePoints, restorePoint, snapshotSummary } from "../backup.js";
import { loadSnapshot, requestPersistence } from "../db.js";
import { parseHevy, parseHevyWeights, importHevyWeights, suggestedTarget, targetLabel, importHevyWorkouts, HevyError } from "../hevy.js";
import { barBtn, statTile, primaryButton, kgText } from "./common.js";
import { exerciseList, libraryScreen, exercisePicker } from "./exercises.js";

export const VERSION = "4.5.1";

let persisted = null;
requestPersistence().then((v) => (persisted = v)).catch(() => {});

export function applyAppearance() {
  const mode = S.settings.appearance || "light";
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : "#f2f2f7");
}

function pickFile(accept, onFile) {
  const el = h("input", { type: "file", accept, style: { display: "none" } });
  el.addEventListener("change", () => {
    const f = el.files?.[0];
    el.remove();
    if (f) onFile(f);
  });
  document.body.append(el);
  el.click();
}

export function settingsRoot(ctx) {
  const st = S.settings;
  const set = (k) => (v) => commit(() => (st[k] = v));
  const { lastSavedAt, saveError } = saveStatus();
  const lastExport = S.meta.lastExportAt;
  return {
    title: "Réglages",
    large: true,
    body: [
      section(
        {},
        cell({ label: "Exercices", lead: h("span.lead-icon.accent", icon("list")), value: String(S.exercises.length), chevron: true, onClick: () => ctx.push(exerciseList) }),
        cell({ label: "Bibliothèque d'exercices", lead: h("span.lead-icon.accent", icon("books")), value: String(LIB.all.length), chevron: true, onClick: () => ctx.push(libraryScreen, {}) })
      ),
      section(
        { header: "Affichage", footer: "Le bilan s'affiche dans l'onglet Séance du dimanche après-midi au lundi." },
        pickerCell("Apparence", APPEARANCES, st.appearance || "light", (v) => {
          commit(() => (st.appearance = v));
          applyAppearance();
        }),
        toggleCell("Bilan du dimanche soir", st.weeklyRecap !== false, set("weeklyRecap"))
      ),
      section(
        { header: "Entraînement", footer: "Quand tu réussis toutes les répétitions cibles d'un modèle, la charge augmente d'environ ce pourcentage, arrondi au plus petit saut possible de l'exercice (réglable dans sa fiche)." },
        pickerCell("Temps de repos", REST_OPTIONS.map((s) => [s, restLabel(s)]), st.restDuration, set("restDuration")),
        pickerCell("Progression de charge", PROGRESSION_OPTIONS.map((p) => [p, `+ ${num(p, 1)} %`]), st.progressionPercent, set("progressionPercent")),
        pickerCell("Barre", BAR_OPTIONS.map((w) => [w, w === 0 ? "Sans barre" : kgText(w)]), st.barWeight, set("barWeight"))
      ),
      section(
        {
          header: "Sauvegarde",
          footer:
            persisted === false
              ? "Ajoute l'app à l'écran d'accueil (Partager › Sur l'écran d'accueil) pour que Safari garde tes données. Exporte-les de temps en temps vers Fichiers ou iCloud Drive : le fichier se restaure aussi dans l'app iPhone."
              : "Tes séances, tes pesées et ta nutrition sont uniquement sur cet appareil. Exporte-les de temps en temps vers Fichiers ou iCloud Drive : le fichier se restaure aussi dans l'app iPhone.",
        },
        cell({
          label: saveError ? "Enregistrement impossible" : "Enregistrement automatique",
          sub: saveError ? String(saveError.message || saveError) : lastSavedAt ? `Dernier enregistrement à ${time(lastSavedAt)}` : "Chaque changement est gardé sur cet appareil",
          lead: h("span.lead-icon", { style: { color: saveError ? "var(--red)" : "var(--green)" } }, icon(saveError ? "warning" : "checkCircle")),
        }),
        cell({ label: "Exporter mes données", sub: lastExport ? `Dernier export le ${dateLong(lastExport)}` : "Jamais fait", lead: h("span.lead-icon.accent", icon("share")), action: true, onClick: () => exportBackup().then((ok) => ok && toast("Sauvegarde exportée")) }),
        cell({ label: "Restaurer une sauvegarde", lead: h("span.lead-icon.accent", icon("download")), action: true, onClick: () => pickFile("application/json,.json", restoreFile) }),
        cell({ label: "Points de restauration", lead: h("span.lead-icon.accent", icon("history")), chevron: true, onClick: () => ctx.push(restorePointsView) }),
        toggleCell("Rappel d'export chaque semaine", st.weeklyReminder !== false, set("weeklyReminder"))
      ),
      section(
        { header: "Autres apps", footer: "Récupère tes séances et tes pesées Hevy à partir de leurs exports CSV. Pour Portion, va dans Nutrition › Réglages." },
        cell({ label: "Importer depuis Hevy", lead: h("span.lead-icon.accent", icon("importDoc")), action: true, onClick: () => ctx.present(hevyImport, {}) })
      ),
      section(
        { footer: "Non disponibles sur le web : Apple Watch, widgets, Siri et notifications sur l'écran verrouillé." },
        cell({ label: "Version", value: `${VERSION} (web)` })
      ),
    ],
  };
}

async function restoreFile(file) {
  let data;
  try {
    data = await readBackup(file);
  } catch (e) {
    return alert(e.message || "Fichier de sauvegarde illisible.");
  }
  const when = data.exportedAt ? `du ${dateLong(data.exportedAt)} à ${time(data.exportedAt)} ` : "";
  confirm("Remplacer toutes les données ?", `La sauvegarde ${when}contient ${data.workouts.length} ${plural(data.workouts.length, "séance")}. Les données actuelles restent dans les points de restauration.`, "Remplacer", async () => {
    if (activeWorkout()) return alert("Termine ou abandonne la séance en cours avant de restaurer.");
    try {
      await applyBackup(data);
      alert("Sauvegarde restaurée.");
    } catch {
      alert("La restauration a échoué.");
    }
  });
}

// MARK: Restore points

function restorePointsView(ctx) {
  if (!ctx.local.loaded) {
    ctx.local.loaded = true;
    restorePoints().then((days) => {
      ctx.local.days = days;
      ctx.refresh();
    });
  }
  const days = ctx.local.days;
  const label = (key) => {
    const [day, t] = key.split(" ");
    const [y, m, d] = day.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return { label: dateLong(date), sub: t ? `Copie gardée avant la restauration de ${t}` : null };
  };
  const open = async (key) => {
    const snap = await loadSnapshot(key);
    if (!snap) return;
    const c = snapshotSummary(snap.state);
    const { label: l } = label(key);
    confirm(`Revenir au ${l} ?`, `Ce jour-là : ${c.workouts} ${plural(c.workouts, "séance")}, ${c.weights} ${plural(c.weights, "pesée")}, ${c.days} ${plural(c.days, "jour")} de nutrition. Les données actuelles sont gardées dans un nouveau point.`, "Restaurer", async () => {
      try {
        await restorePoint(key);
        toast("Données restaurées");
        ctx.local.loaded = false;
      } catch (e) {
        alert(e.message || "La restauration a échoué.");
      }
    }, { destructive: false });
  };
  return {
    title: "Points de restauration",
    body: section(
      { footer: "Une copie complète est gardée chaque jour, sur les 30 derniers jours d'utilisation, plus une copie avant chaque restauration." },
      days == null ? h("div.cell.secondary", "Chargement…") : days.length ? days.map((k) => cell({ ...label(k), chevron: true, onClick: () => open(k) })) : h("div.cell.secondary", "Aucun point pour l'instant.")
    ),
  };
}

// MARK: Hevy import

function hevyImport(ctx) {
  const L = ctx.local;
  const close = barBtn("Fermer", () => ctx.close());
  const load = async (file) => {
    let text;
    try {
      const buf = await file.arrayBuffer();
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        text = new TextDecoder("iso-8859-1").decode(buf);
      }
      const weights = parseHevyWeights(text);
      if (weights) {
        if (!weights.length) throw new HevyError("Aucune donnée trouvée dans ce fichier.");
        L.weights = weights.sort((a, b) => a.date - b.date);
        L.workouts = null;
        return ctx.refresh();
      }
      const parsed = parseHevy(text);
      const seen = new Set();
      const names = parsed.flatMap((w) => w.exercises.map((e) => e.title)).filter((t) => !seen.has(t) && seen.add(t));
      L.titles = names.sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
      L.targets = Object.fromEntries(names.map((t) => [t, suggestedTarget(t)]));
      L.weights = null;
      L.workouts = parsed;
      ctx.refresh();
    } catch (e) {
      alert("Import impossible", e.message || "Fichier illisible.");
    }
  };
  const pick = () => pickFile(".csv,text/csv,text/plain", load);

  if (L.weights) {
    return {
      title: "Importer depuis Hevy",
      left: close,
      body: section(
        { header: `${L.weights.length} pesées trouvées`, footer: "Les jours où tu as déjà une pesée dans l'app sont ignorés." },
        [...L.weights].reverse().map((w) => cell({ label: dateAbbrev(w.date), value: kgPrecise(w.weight) }))
      ),
      bottom: primaryButton(`Importer ${L.weights.length} pesées`, () => {
        let n = 0;
        commit(() => (n = importHevyWeights(L.weights)));
        ctx.close();
        alert("Pesées importées", n === 0 ? "Ces pesées étaient déjà dans l'app." : `${n} pesée${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""} dans Progrès › Poids de corps.`);
      }, "download"),
    };
  }

  if (L.workouts) {
    const fresh = L.workouts.filter((p) => !S.workouts.some((w) => Math.abs(w.startedAt - p.start) < 60_000));
    const sets = L.workouts.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.length, 0), 0);
    const skipped = L.workouts.length - fresh.length;
    const range = `Du ${dateAbbrev(L.workouts[0].start)} au ${dateAbbrev(L.workouts[L.workouts.length - 1].start)}.` + (skipped > 0 ? ` ${skipped} déjà dans l'app, ignorée${skipped > 1 ? "s" : ""}.` : "");
    const iconFor = (t) => (t.kind === "existing" ? "checkCircle" : t.kind === "library" ? "books" : "plus");
    const same = (a, b) => a.kind === b.kind && (a.id ?? a.name) === (b.id ?? b.name);
    const mapping = (title) => {
      const target = L.targets[title] ?? { kind: "new", name: title };
      const open = () => {
        const suggestion = suggestedTarget(title);
        const items = [];
        if (!same(suggestion, target)) items.push({ label: targetLabel(suggestion), icon: "sparkles", onClick: () => { L.targets[title] = suggestion; ctx.refresh(); } });
        items.push({ label: "Choisir un exercice…", icon: "list", onClick: () => ctx.present(exercisePicker, { onPick: (ex) => { L.targets[title] = { kind: "existing", id: ex.id, name: ex.name }; ctx.refresh(); } }) });
        items.push({ label: `Créer « ${title} »`, icon: "plus", onClick: () => { L.targets[title] = { kind: "new", name: title }; ctx.refresh(); } });
        menu(items, { title });
      };
      return h(
        "button.cell",
        { type: "button", onclick: open, style: { display: "block" } },
        h("div.subheadline.secondary", { style: { marginBottom: "6px" } }, title),
        h("div.hstack", { style: { gap: "8px", fontWeight: 500 } }, h("span.accent", icon(iconFor(target), 18)), h("span.grow", targetLabel(target)), h("span.secondary", icon("chevronUpDown", 14)))
      );
    };
    return {
      title: "Importer depuis Hevy",
      left: close,
      body: [
        h("div.grid3", { style: { marginBottom: "6px" } }, statTile(String(L.workouts.length), "Séances", "calendar", "var(--orange)"), statTile(String(L.titles.length), "Exercices", "dumbbell", "var(--blue)"), statTile(String(sets), "Séries", "list", "var(--green)")),
        h("p.footnote.secondary", { style: { margin: "0 16px 22px" } }, range),
        section(
          { header: "Correspondance des exercices", footer: "Relié à un de tes exercices, ton historique Hevy s'ajoute au sien (graphiques, records, charges proposées). « Nouveau » crée l'exercice." },
          L.titles.map(mapping)
        ),
      ],
      bottom: h(
        "div",
        { style: fresh.length ? null : { opacity: 0.5 } },
        primaryButton(fresh.length === 0 ? "Déjà importé" : `Importer ${fresh.length} séance${fresh.length > 1 ? "s" : ""}`, () => {
          let n = 0;
          commit(() => (n = importHevyWorkouts(fresh, L.targets)));
          ctx.close();
          alert("Import terminé", `${n} séance${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""} à ton historique.`);
        }, "download", { disabled: fresh.length === 0 })
      ),
    };
  }

  const step = (n, text) => h("div.hstack", { style: { alignItems: "flex-start", gap: "12px" } }, h("span.caption.bold", { style: { width: "22px", height: "22px", flex: "none", borderRadius: "50%", background: "linear-gradient(180deg, var(--accent-2), var(--accent))", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" } }, String(n)), h("span.callout", text));
  return {
    title: "Importer depuis Hevy",
    left: close,
    body: section(
      {},
      h(
        "div.cell",
        { style: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: "14px", padding: "18px 16px" } },
        h("span.accent", icon("importDoc", 34)),
        h("span.title3.bold", "Récupère tout ton historique Hevy"),
        step(1, "Dans Hevy, ouvre ton profil puis les réglages (roue dentée)."),
        step(2, "Touche « Exporter et importer des données », puis « Exporter les séances »."),
        step(3, "Enregistre le fichier CSV dans Fichiers, puis choisis-le ici."),
        h("span.footnote.secondary", "Tu peux aussi importer l'export des mensurations de Hevy : tes pesées iront dans le suivi du poids de corps."),
        h("span.footnote.secondary", "Tes séances, exercices, charges et répétitions sont importés. Les séries d'échauffement sont ignorées, et une séance déjà présente n'est jamais importée deux fois."),
        primaryButton("Choisir le fichier CSV", pick, "docPlus")
      )
    ),
  };
}
