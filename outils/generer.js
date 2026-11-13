// Génère, à partir des éditions du site :
//   - feed.xml            : flux RSS (une entrée par news) ;
//   - n/AAAA-MM-JJ-N.html : une page par news, avec aperçu pour les réseaux, qui redirige vers la news.
// Usage : node outils/generer.js   (depuis le dossier du site, après chaque nouvelle édition)
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const BASE = "https://geekotidien.fr";
const racine = path.join(__dirname, "..");
const TITRE_SITE = "Geekotidien";
const DESCRIPTION_SITE = "Les news tech et geek du jour, sélectionnées chaque matin.";

// Charge data/index.js et les éditions dans un même bac à sable (aucune dépendance externe).
const fenetre = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(racine, "data/index.js"), "utf8"), fenetre);
const index = fenetre.window.EDITION_INDEX || [];
const editions = index.map(function (e) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(racine, "data/editions", e.date + ".js"), "utf8"), ctx);
  return ctx.window.EDITIONS[e.date];
});

function echapper(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// 08:00 à Paris = 07:00 UTC en hiver, 06:00 UTC en été : on prend 07:00 UTC par simplicité.
function dateRss(iso) {
  return new Date(iso + "T07:00:00Z").toUTCString();
}
function urlNews(date, num) {
  return BASE + "/n/" + date + "-" + num + ".html";
}

// 1. Pages par news
const dossierN = path.join(racine, "n");
fs.mkdirSync(dossierN, { recursive: true });
const attendues = new Set();
editions.forEach(function (ed) {
  (ed.news || []).forEach(function (n, i) {
    const num = i + 1;
    const nom = ed.date + "-" + num + ".html";
    attendues.add(nom);
    const titre = (n.titre || "News") + " · " + TITRE_SITE;
    const desc = n.sous_titre || DESCRIPTION_SITE;
    const image = n.photo ? BASE + "/" + n.photo : BASE + "/" + ed.cover;
    const cible = "../#" + ed.date + "/" + num;
    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${echapper(titre)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${echapper(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${TITRE_SITE}">
<meta property="og:title" content="${echapper(n.titre || "News")}">
<meta property="og:description" content="${echapper(desc)}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${urlNews(ed.date, num)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${echapper(n.titre || "News")}">
<meta name="twitter:description" content="${echapper(desc)}">
<meta name="twitter:image" content="${image}">
<link rel="canonical" href="${urlNews(ed.date, num)}">
<meta http-equiv="refresh" content="0; url=${cible}">
<script>location.replace(${JSON.stringify(cible)});</script>
</head>
<body>
<p>Ouverture de la news… <a href="${cible}">Cliquer ici si rien ne se passe.</a></p>
</body>
</html>
`;
    fs.writeFileSync(path.join(dossierN, nom), html, "utf8");
  });
});
// Supprime les pages de news qui ne correspondent plus à une édition conservée.
fs.readdirSync(dossierN).forEach(function (f) {
  if (f.endsWith(".html") && !attendues.has(f)) fs.unlinkSync(path.join(dossierN, f));
});

// 2. Flux RSS
const items = [];
editions.forEach(function (ed) {
  (ed.news || []).forEach(function (n, i) {
    const num = i + 1;
    items.push(`    <item>
      <title>${echapper(n.titre || "News")}</title>
      <link>${urlNews(ed.date, num)}</link>
      <guid isPermaLink="true">${urlNews(ed.date, num)}</guid>
      <pubDate>${dateRss(ed.date)}</pubDate>
      <description>${echapper(n.sous_titre || "")}</description>
    </item>`);
  });
});
const flux = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${TITRE_SITE}</title>
    <link>${BASE}/</link>
    <description>${echapper(DESCRIPTION_SITE)}</description>
    <language>fr-FR</language>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${BASE}/feed.xml" rel="self" type="application/rss+xml"/>
${items.join("\n")}
  </channel>
</rss>
`;
fs.writeFileSync(path.join(racine, "feed.xml"), flux, "utf8");
// Plan du site : accueil, mentions légales et une page par news (n/).
const pagesNews = fs.readdirSync(path.join(racine, "n")).filter((f) => f.endsWith(".html")).sort();
const adresses = [BASE + "/", BASE + "/mentions-legales.html"].concat(pagesNews.map((f) => BASE + "/n/" + f));
const plan = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${adresses.map((u) => "  <url><loc>" + u + "</loc></url>").join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(racine, "sitemap.xml"), plan, "utf8");
console.log("OK : " + editions.length + " édition(s), " + attendues.size + " news, feed.xml et n/ générés.");
