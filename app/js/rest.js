// Rest timer between sets: a bar above the tab bar, a sound and a vibration at the end.
import { h } from "./ui.js";
import { getState, update } from "./store.js";

let timer;
let audio;

function bar() {
  return document.querySelector(".rest-bar");
}

function unlockAudio() {
  // iOS only plays sound from a context created during a tap
  if (!audio) {
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  }
  audio?.resume?.();
}

function beep() {
  if (!audio) return;
  const t = audio.currentTime;
  [0, 0.22].forEach((offset) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.3, t + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.18);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.2);
  });
  navigator.vibrate?.([200, 100, 200]);
}

function render() {
  const a = getState().active;
  const end = a?.restEnd ? new Date(a.restEnd).getTime() : 0;
  const left = Math.max(0, Math.round((end - Date.now()) / 1000));
  let el = bar();
  if (!a || !end || left <= 0) {
    el?.remove();
    return left <= 0 && end;
  }
  const total = a.restTotal || 90;
  const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  if (!el) {
    el = h(
      "div.rest-bar",
      { role: "timer", "aria-label": "Repos" },
      h("div.rest-progress"),
      h("span.rest-label", "Repos"),
      h("span.rest-time"),
      h("button.rest-btn", { "aria-label": "Retirer 15 secondes", onclick: () => adjust(-15) }, "−15"),
      h("button.rest-btn", { "aria-label": "Ajouter 30 secondes", onclick: () => adjust(30) }, "+30"),
      h("button.rest-btn.skip", { onclick: () => rest.stop() }, "Passer")
    );
    document.body.append(el);
  }
  el.querySelector(".rest-time").textContent = text;
  el.querySelector(".rest-progress").style.transform = `scaleX(${left / total})`;
  return false;
}

function adjust(seconds) {
  update((s) => {
    if (!s.active?.restEnd) return;
    const end = Math.max(Date.now(), new Date(s.active.restEnd).getTime()) + seconds * 1000;
    s.active.restEnd = new Date(end).toISOString();
    s.active.restTotal = Math.max(15, (s.active.restTotal || 90) + seconds);
  }, { silent: true });
  render();
}

function loop() {
  clearInterval(timer);
  timer = setInterval(() => {
    const finished = render();
    if (finished) {
      clearInterval(timer);
      update((s) => s.active && (s.active.restEnd = null), { silent: true });
      beep();
    }
  }, 250);
  render();
}

export const rest = {
  start(seconds) {
    unlockAudio();
    update((s) => {
      s.active.restEnd = new Date(Date.now() + seconds * 1000).toISOString();
      s.active.restTotal = seconds;
    }, { silent: true });
    loop();
  },
  stop() {
    clearInterval(timer);
    if (getState().active) update((s) => (s.active.restEnd = null), { silent: true });
    bar()?.remove();
  },
  /** Picks up a rest still running after the app was reopened. */
  resume() {
    if (getState().active?.restEnd) loop();
  },
};
