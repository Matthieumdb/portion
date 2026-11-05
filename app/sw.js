// Offline: the app files are cached, and refreshed in the background when online.
const CACHE = "musculation-v2";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/backup.js",
  "js/db.js",
  "js/hevy.js",
  "js/insights.js",
  "js/model.js",
  "js/nav.js",
  "js/nutrition.js",
  "js/store.js",
  "js/ui.js",
  "js/views/common.js",
  "js/views/exercises.js",
  "js/views/history.js",
  "js/views/nutrition.js",
  "js/views/progress.js",
  "js/views/settings.js",
  "js/views/workout.js",
  "data/exercise-library.json",
  "data/nutrition-data.json",
  "vendor/html5-qrcode.LICENSE",
  "vendor/html5-qrcode.min.js",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "img/exercises/exo_Barbell_Bench_Press_-_Medium_Grip_0.jpg",
  "img/exercises/exo_Barbell_Bench_Press_-_Medium_Grip_1.jpg",
  "img/exercises/exo_Barbell_Curl_0.jpg",
  "img/exercises/exo_Barbell_Curl_1.jpg",
  "img/exercises/exo_Barbell_Deadlift_0.jpg",
  "img/exercises/exo_Barbell_Deadlift_1.jpg",
  "img/exercises/exo_Barbell_Hip_Thrust_0.jpg",
  "img/exercises/exo_Barbell_Hip_Thrust_1.jpg",
  "img/exercises/exo_Barbell_Squat_0.jpg",
  "img/exercises/exo_Barbell_Squat_1.jpg",
  "img/exercises/exo_Bent_Over_Barbell_Row_0.jpg",
  "img/exercises/exo_Bent_Over_Barbell_Row_1.jpg",
  "img/exercises/exo_Butterfly_0.jpg",
  "img/exercises/exo_Butterfly_1.jpg",
  "img/exercises/exo_Cable_Crunch_0.jpg",
  "img/exercises/exo_Cable_Crunch_1.jpg",
  "img/exercises/exo_Cable_Rope_Overhead_Triceps_Extension_0.jpg",
  "img/exercises/exo_Cable_Rope_Overhead_Triceps_Extension_1.jpg",
  "img/exercises/exo_Crunches_0.jpg",
  "img/exercises/exo_Crunches_1.jpg",
  "img/exercises/exo_Dips_-_Chest_Version_0.jpg",
  "img/exercises/exo_Dips_-_Chest_Version_1.jpg",
  "img/exercises/exo_Dumbbell_Incline_Row_0.jpg",
  "img/exercises/exo_Dumbbell_Incline_Row_1.jpg",
  "img/exercises/exo_Dumbbell_Lunges_0.jpg",
  "img/exercises/exo_Dumbbell_Lunges_1.jpg",
  "img/exercises/exo_Dumbbell_Shoulder_Press_0.jpg",
  "img/exercises/exo_Dumbbell_Shoulder_Press_1.jpg",
  "img/exercises/exo_EZ-Bar_Curl_0.jpg",
  "img/exercises/exo_EZ-Bar_Curl_1.jpg",
  "img/exercises/exo_EZ-Bar_Skullcrusher_0.jpg",
  "img/exercises/exo_EZ-Bar_Skullcrusher_1.jpg",
  "img/exercises/exo_Face_Pull_0.jpg",
  "img/exercises/exo_Face_Pull_1.jpg",
  "img/exercises/exo_Flat_Bench_Cable_Flyes_0.jpg",
  "img/exercises/exo_Flat_Bench_Cable_Flyes_1.jpg",
  "img/exercises/exo_Hammer_Curls_0.jpg",
  "img/exercises/exo_Hammer_Curls_1.jpg",
  "img/exercises/exo_Incline_Dumbbell_Curl_0.jpg",
  "img/exercises/exo_Incline_Dumbbell_Curl_1.jpg",
  "img/exercises/exo_Incline_Dumbbell_Press_0.jpg",
  "img/exercises/exo_Incline_Dumbbell_Press_1.jpg",
  "img/exercises/exo_Leg_Extensions_0.jpg",
  "img/exercises/exo_Leg_Extensions_1.jpg",
  "img/exercises/exo_Leg_Press_0.jpg",
  "img/exercises/exo_Leg_Press_1.jpg",
  "img/exercises/exo_Lying_Leg_Curls_0.jpg",
  "img/exercises/exo_Lying_Leg_Curls_1.jpg",
  "img/exercises/exo_One-Arm_Dumbbell_Row_0.jpg",
  "img/exercises/exo_One-Arm_Dumbbell_Row_1.jpg",
  "img/exercises/exo_Plank_0.jpg",
  "img/exercises/exo_Plank_1.jpg",
  "img/exercises/exo_Pullups_0.jpg",
  "img/exercises/exo_Pullups_1.jpg",
  "img/exercises/exo_Reverse_Machine_Flyes_0.jpg",
  "img/exercises/exo_Reverse_Machine_Flyes_1.jpg",
  "img/exercises/exo_Romanian_Deadlift_0.jpg",
  "img/exercises/exo_Romanian_Deadlift_1.jpg",
  "img/exercises/exo_Seated_Cable_Rows_0.jpg",
  "img/exercises/exo_Seated_Cable_Rows_1.jpg",
  "img/exercises/exo_Seated_Calf_Raise_0.jpg",
  "img/exercises/exo_Seated_Calf_Raise_1.jpg",
  "img/exercises/exo_Seated_Leg_Curl_0.jpg",
  "img/exercises/exo_Seated_Leg_Curl_1.jpg",
  "img/exercises/exo_Side_Lateral_Raise_0.jpg",
  "img/exercises/exo_Side_Lateral_Raise_1.jpg",
  "img/exercises/exo_Smith_Machine_Incline_Bench_Press_0.jpg",
  "img/exercises/exo_Smith_Machine_Incline_Bench_Press_1.jpg",
  "img/exercises/exo_Split_Squat_with_Dumbbells_0.jpg",
  "img/exercises/exo_Split_Squat_with_Dumbbells_1.jpg",
  "img/exercises/exo_Standing_Calf_Raises_0.jpg",
  "img/exercises/exo_Standing_Calf_Raises_1.jpg",
  "img/exercises/exo_Standing_Military_Press_0.jpg",
  "img/exercises/exo_Standing_Military_Press_1.jpg",
  "img/exercises/exo_Straight-Arm_Pulldown_0.jpg",
  "img/exercises/exo_Straight-Arm_Pulldown_1.jpg",
  "img/exercises/exo_Thigh_Adductor_0.jpg",
  "img/exercises/exo_Thigh_Adductor_1.jpg",
  "img/exercises/exo_Triceps_Pushdown_-_Rope_Attachment_0.jpg",
  "img/exercises/exo_Triceps_Pushdown_-_Rope_Attachment_1.jpg",
  "img/exercises/exo_Triceps_Pushdown_0.jpg",
  "img/exercises/exo_Triceps_Pushdown_1.jpg",
  "img/exercises/exo_V-Bar_Pulldown_0.jpg",
  "img/exercises/exo_V-Bar_Pulldown_1.jpg",
  "img/exercises/exo_Wide-Grip_Lat_Pulldown_0.jpg",
  "img/exercises/exo_Wide-Grip_Lat_Pulldown_1.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first for speed, then update the copy for the next launch
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin || !url.pathname.includes("/app/")) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
