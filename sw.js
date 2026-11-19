// Fonctionnement hors-ligne : l'appli est gardée en cache sur le téléphone
// v1.46 : la copie du téléphone s'ouvre tout de suite (même avec un réseau faible en unité).
// Une nouvelle version déposée sur GitHub est téléchargée en arrière-plan ; l'appli affiche alors
// « Nouvelle version disponible – Recharger » et ne bascule que sur demande.
const CACHE = "releve-refractaire-v174";
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
    const copie = e.request.clone();   // v2.38 : copie gardée pour une 2e méthode de lecture si formData() échoue (Samsung Internet)
    e.respondWith((async () => {
      const diag = { champs: [], n: 0, err: "", err2: "", methode: "", type: e.request.headers.get("content-type") || "" };
      const c = await caches.open("partage-recu"); let i = 0;
      const garder = async (f, nom, type, date) => {
        await c.put(new Request(new URL("partage-recu/" + String(i++).padStart(3, "0") + "-" + Date.now(), self.registration.scope).href),
          new Response(f, { headers: { "Content-Type": type || "application/octet-stream", "X-Nom": encodeURIComponent(nom || "partage.jpg"), "X-Date": String(date || Date.now()) } }));
        diag.n++;
      };
      try {
        const fd = await e.request.formData(); diag.methode = "formData";
        for (const [k, f] of fd.entries()) {
          diag.champs.push(k + ":" + (typeof f === "string" ? "texte" : ((f && f.type) || "fichier") + " " + ((f && f.size) || 0) + " o"));
          if (f && typeof f !== "string") await garder(f, f.name, f.type, f.lastModified);
        }
      } catch (err) {
        diag.err = String((err && err.message) || err);
        // 2e méthode : lire le corps brut et découper le multipart à la main
        try {
          const buf = new Uint8Array(await copie.arrayBuffer()); diag.methode = "brut " + buf.length + " o";
          const m = /boundary=("?)([^";]+)\1/i.exec(diag.type); if (!m) throw new Error("pas de boundary");
          const sep = new TextEncoder().encode("--" + m[2]); const td = new TextDecoder("utf-8");
          // v2.39 : recherche rapide (indexOf natif sur le 1er octet) : gros fichiers (navettes de centaines de Mo)
          const cherche = (h, a, d) => { let x = h.indexOf(a[0], d); while (x >= 0 && x <= h.length - a.length) { let y = 1; while (y < a.length && h[x + y] === a[y]) y++; if (y === a.length) return x; x = h.indexOf(a[0], x + 1); } return -1; };
          let p = cherche(buf, sep, 0);
          while (p >= 0) {
            const debut = p + sep.length; if (buf[debut] === 45 && buf[debut + 1] === 45) break;
            const fin = cherche(buf, sep, debut); if (fin < 0) break;
            const part = buf.subarray(debut + 2, fin - 2);
            const hEnd = cherche(part, new Uint8Array([13, 10, 13, 10]), 0);
            if (hEnd > 0) {
              const tete = td.decode(part.subarray(0, hEnd)); const corps = part.subarray(hEnd + 4);
              const nomC = (/name="([^"]*)"/i.exec(tete) || [])[1] || "?"; const fic = (/filename="([^"]*)"/i.exec(tete) || [])[1];
              const typ = (/content-type:\s*([^\r\n]+)/i.exec(tete) || [])[1] || "";
              diag.champs.push(nomC + ":" + (fic != null ? (typ || "fichier") + " " + corps.length + " o" : "texte"));
              if (fic != null && corps.length) await garder(new Blob([corps], { type: typ }), fic, typ, Date.now());
            }
            p = fin;
          }
        } catch (err2) { diag.err2 = String((err2 && err2.message) || err2); }
      }
      try { await c.put(new Request(new URL("partage-diag", self.registration.scope).href), new Response(JSON.stringify(diag), { headers: { "Content-Type": "application/json" } })); } catch (e3) { }
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
