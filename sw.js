// Fonctionnement hors-ligne : l'appli est gardée en cache sur le téléphone
// v1.46 : la copie du téléphone s'ouvre tout de suite (même avec un réseau faible en unité).
// Une nouvelle version déposée sur GitHub est téléchargée en arrière-plan ; l'appli affiche alors
// « Nouvelle version disponible – Recharger » et ne bascule que sur demande.
const CACHE = "releve-refractaire-v50";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => {
  // cache: "reload" = ignorer le cache HTTP de GitHub (10 min) pour bien prendre la nouvelle version
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
  // pas de skipWaiting ici : la nouvelle version attend que l'utilisateur touche « Recharger »
});
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Cache d'abord (ouverture immédiate) ; réseau seulement pour ce qui n'est pas en cache
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true }).then(r => r ||
      (e.request.mode === "navigate" ? c.match("index.html") : null)).then(r => r ||
      fetch(e.request).then(rep => { if (rep.ok) c.put(e.request.url.split("?")[0], rep.clone()); return rep; })))
  );
});
