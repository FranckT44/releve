// Fonctionnement hors-ligne : l'appli est gardée en cache sur le téléphone
const CACHE = "releve-refractaire-v18";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord, sans le cache de 10 min de GitHub (no-cache = toujours vérifier la dernière version) ; copie locale si pas de réseau
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  const frais = new Request(e.request.url, { cache: "no-cache", credentials: "same-origin" });
  e.respondWith(
    fetch(frais).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request.url.split("?")[0], copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
