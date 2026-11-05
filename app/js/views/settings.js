// Réglages tab: backups first, then training and display.
import { h, icon, formatDate, sheet, confirmSheet, toast } from "../ui.js";
import { getState, update, saveStatus, replaceState } from "../store.js";
import { exportBackup, readBackup, applyBackup } from "../backup.js";
import { listSnapshotDays, loadSnapshot, requestPersistence } from "../db.js";
import { REST_OPTIONS, MUSCLE_GROUPS } from "../data.js";
import { restLabel, createExercise } from "./workout.js";

let persisted = null;
requestPersistence().then((v) => (persisted = v));

export function settingsTab() {
  const s = getState();
  const { lastSavedAt, saveError } = saveStatus();
  const lastExport = s.meta.lastExportAt;

  return h(
    "div.page",
    h("header.large-title", h("h1", "Réglages")),

    h("h4.group-title", "Sauvegarde"),
    h(
      "div.group",
      h("div.row",
        h("span.row-icon", { style: { color: saveError ? "var(--red)" : "var(--green)" } }, icon(saveError ? "close" : "check", 20)),
        h("span.row-text.grow",
          h("span", saveError ? "Enregistrement impossible" : "Enregistrement automatique"),
          h("span.caption", saveError ? String(saveError.message || saveError) : lastSavedAt ? `Dernier enregistrement à ${lastSavedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Chaque changement est gardé sur cet appareil"))),
      h("button.row.row-button", { onclick: () => exportBackup().then((ok) => ok && toast("Sauvegarde enregistrée")) },
        h("span.row-icon.accent", icon("upload", 20)),
        h("span.row-text.grow", h("span", "Exporter une sauvegarde"), h("span.caption", lastExport ? `Dernière le ${formatDate(lastExport, { day: "numeric", month: "long" })}` : "Jamais faite"))),
      h("label.row.row-button",
        h("span.row-icon.accent", icon("download", 20)),
        h("span.grow", "Importer une sauvegarde"),
        h("input.sr-only", { type: "file", accept: "application/json,.json", onchange: (e) => importFile(e.target.files[0], e.target) })),
      h("button.row.row-button", { onclick: showSnapshots },
        h("span.row-icon.accent", icon("history", 20)),
        h("span.grow", "Points de restauration"),
        h("span.chevron", icon("chevron", 16))),
      h("label.row",
        h("span.grow", "Rappel chaque semaine"),
        h("input.switch", { type: "checkbox", role: "switch", checked: s.settings.weeklyReminder, onchange: (e) => update((x) => (x.settings.weeklyReminder = e.target.checked)) }))
    ),
    h("p.group-footer", persisted === false
      ? "Ajoute l'app à l'écran d'accueil (Partager > Sur l'écran d'accueil) pour que le navigateur garde tes données. Le fichier exporté se restaure aussi dans l'app iPhone."
      : "Tes données restent sur cet appareil. Le fichier exporté se range dans Fichiers ou iCloud Drive, et se restaure aussi dans l'app iPhone."),

    h("h4.group-title", "Entraînement"),
    h(
      "div.group",
      h("label.row", h("span.grow", "Temps de repos"),
        h("select.select", { onchange: (e) => update((x) => (x.settings.restSeconds = Number(e.target.value))) },
          REST_OPTIONS.map((sec) => h("option", { value: sec, selected: sec === s.settings.restSeconds }, restLabel(sec))))),
      h("button.row.row-button", { onclick: showExercises }, h("span.grow", "Exercices"), h("span.caption", s.exercises.length), h("span.chevron", icon("chevron", 16)))
    ),

    h("h4.group-title", "Affichage"),
    h(
      "div.group",
      h("label.row", h("span.grow", "Apparence"),
        h("select.select", { onchange: (e) => { update((x) => (x.settings.appearance = e.target.value)); applyAppearance(); } },
          [["light", "Clair"], ["dark", "Sombre"], ["system", "Système"]].map(([v, l]) => h("option", { value: v, selected: (s.settings.appearance || "light") === v }, l))))
    ),
    h("p.group-footer", "Musculation web · version 1.0")
  );
}

export function applyAppearance() {
  const mode = getState().settings.appearance || "light";
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : "#f2f2f7");
}

async function importFile(file, input) {
  if (!file) return;
  try {
    const data = await readBackup(file);
    const count = data.workouts.length;
    confirmSheet(
      "Remplacer les données ?",
      `Ce fichier contient ${count} séance${count > 1 ? "s" : ""}${data.exportedAt ? `, sauvegardées le ${formatDate(data.exportedAt, { day: "numeric", month: "long", year: "numeric" })}` : ""}. Tes données actuelles restent dans les points de restauration.`,
      "Remplacer",
      async () => {
        await applyBackup(data);
        toast("Sauvegarde restaurée");
      }
    );
  } catch (e) {
    toast(e.message || "Fichier illisible");
  } finally {
    input.value = "";
  }
}

async function showSnapshots() {
  const days = await listSnapshotDays();
  sheet("Points de restauration", (close) =>
    h(
      "div.stack",
      h("p.footnote", "Une copie complète est gardée chaque jour, sur les 30 derniers jours d'utilisation."),
      h(
        "div.group",
        days.length === 0 && h("p.footnote.pad", "Aucun point pour l'instant."),
        days.map((day) =>
          h("button.row.row-button", {
            onclick: async () => {
              const snap = await loadSnapshot(day);
              if (!snap) return;
              const n = snap.state.workouts?.length || 0;
              confirmSheet(`Revenir au ${formatDate(day.slice(0, 10) + "T12:00:00", { day: "numeric", month: "long" })} ?`, `Les données de ce jour-là (${n} séance${n > 1 ? "s" : ""}) remplacent les actuelles.`, "Restaurer", async () => {
                close();
                await replaceState({ ...snap.state, settings: getState().settings, meta: getState().meta });
                toast("Données restaurées");
              });
            },
          }, snapshotLabel(day), h("span.chevron", icon("chevron", 16)))
        )
      )
    )
  );
}

/** "2026-11-05" is the copy of that day; "2026-11-05 14:03" the data kept before a restore. */
function snapshotLabel(key) {
  const [day, time] = key.split(" ");
  const date = formatDate(day + "T12:00:00");
  return time
    ? h("span.row-text.grow", h("span", date), h("span.caption", `Avant la restauration de ${time}`))
    : h("span.grow", date);
}

function showExercises() {
  sheet("Exercices", (close, rerender) => {
    const list = [...getState().exercises].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return h(
      "div.stack",
      h("button.button", { onclick: () => createExercise("", () => rerender()) }, icon("plus", 18), "Nouvel exercice"),
      h(
        "div.group",
        list.map((e) =>
          h("div.row", h("span.row-text.grow", h("span", e.name), h("span.caption", MUSCLE_GROUPS[e.muscleGroup] || "")),
            h("button.icon-button.danger", {
              "aria-label": `Supprimer ${e.name}`,
              onclick: () => confirmSheet(`Supprimer ${e.name} ?`, "Les séances passées le gardent dans l'historique.", "Supprimer", () => { update((s) => (s.exercises = s.exercises.filter((x) => x.name !== e.name))); rerender(); }),
            }, icon("trash", 18)))
        )
      )
    );
  });
}
