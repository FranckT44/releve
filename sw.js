// Fonctionnement hors-ligne : l'appli est gardée en cache sur le téléphone
// v1.46 : la copie du téléphone s'ouvre tout de suite (même avec un réseau faible en unité).
// Une nouvelle version déposée sur GitHub est téléchargée en arrière-plan ; l'appli affiche alors
// « Nouvelle version disponible – Recharger » et ne bascule que sur demande.
const CACHE = "releve-refractaire-v141";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "logo-fta.png", "pdf-lib.min.js", "pdfjs.min.mjs", "pdfjs.worker.min.mjs"];
self.addEventListener("install", e => {
  // cache: "reload" = ignorer le cache HTTP de GitHub (10 min) pour bien prendre la nouvelle version
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
  // pas de skipWaiting ici : la nouvelle version attend que l'utilisateur touche « Recharger »
});
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== "partage-recu").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Cache d'abord (ouverture immédiate) ; réseau seulement pour ce qui n'est pas en cache
// v2.36 : partage Android (« Partager » → 982 Toolbox) : les fichiers reçus sont gardés dans le cache « partage-recu »,
// puis l'appli s'ouvre avec ?partage=1 et les traite (fichier de projet → chargement ; photos → hors constat ou constat en cours)
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method === "POST" && u.origin === location.origin && /\/partage$/.test(u.pathname)) {
    e.respondWith((async () => {
      // v2.37 : tout fichier du formulaire est pris, quel que soit le nom du champ ; diagnostic gardé pour l'appli
      const diag = { champs: [], n: 0, err: "", type: e.request.headers.get("content-type") || "" };
      try {
        const c = await caches.open("partage-recu"); let i = 0;
        const fd = await e.request.formData();
        for (const [k, f] of fd.entries()) {
          diag.champs.push(k + ":" + (typeof f === "string" ? "texte" : ((f && f.type) || "fichier") + " " + ((f && f.size) || 0) + " o"));
          if (!f || typeof f === "string") continue;
          await c.put(new Request(new URL("partage-recu/" + String(i++).padStart(3, "0") + "-" + Date.now(), self.registration.scope).href),
            new Response(f, { headers: { "Content-Type": f.type || "application/octet-stream", "X-Nom": encodeURIComponent(f.name || "partage.jpg"), "X-Date": String(f.lastModified || Date.now()) } }));
          diag.n++;
        }
        await c.put(new Request(new URL("partage-diag", self.registration.scope).href), new Response(JSON.stringify(diag), { headers: { "Content-Type": "application/json" } }));
      } catch (err) {
        diag.err = String((err && err.message) || err);
        try { const c = await caches.open("partage-recu"); await c.put(new Request(new URL("partage-diag", self.registration.scope).href), new Response(JSON.stringify(diag), { headers: { "Content-Type": "application/json" } })); } catch (e2) { }
      }
      return Response.redirect(new URL("index.html?partage=1", self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true }).then(r => r ||
      (e.request.mode === "navigate" ? c.match("index.html") : null)).then(r => r ||
      fetch(e.request).then(rep => { if (rep.ok) c.put(e.request.url.split("?")[0], rep.clone()); return rep; })))
  );
});
