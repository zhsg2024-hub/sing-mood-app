const CACHE = "sing-mood-v6";
const ASSETS = [
  "./index.html",
  "./styles.css",
  "./ios.css",
  "./manifest.json",
  "./js/app.js",
  "./js/api-client.js",
  "./js/asr.js",
  "./js/songs.js",
  "./js/matcher.js",
  "./js/lyrics.js",
  "./js/mood.js",
  "./js/share-image.js",
  "./js/ios.js",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
];

const NETWORK_FIRST = /\.(html|js|css)$|\/sing-mood-app\/?$/;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const path = url.pathname;
  const useNetworkFirst =
    e.request.mode === "navigate" ||
    NETWORK_FIRST.test(path) ||
    path.endsWith("/sing-mood-app") ||
    path.endsWith("/sing-mood-app/");

  if (useNetworkFirst) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
    )
  );
});
