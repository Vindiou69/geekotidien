// Site Geekotidien : accueil (dernière édition), archives (un an), recherche par mot-clé.
(function () {
  var liste = document.getElementById("liste");
  var dlg = document.getElementById("detail");
  var dlgContenu = document.getElementById("detail-contenu");
  var dlgFermer = document.getElementById("detail-fermer");
  var champ = document.getElementById("recherche");
  var index = (window.EDITION_INDEX || []).slice();
  var chargees = {};

  function el(tag, texte, classe) {
    var e = document.createElement(tag);
    e.textContent = texte;
    if (classe) e.className = classe;
    return e;
  }
  function normaliser(s) {
    return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  function dateFr(iso) {
    var d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }

  // Adresse publique du site (sert aux liens partagés) : à adapter si le domaine change.
  var BASE = "https://geekotidien.fr";

  // Numérote les news d'une édition (1 à 5) pour les liens directs #AAAA-MM-JJ/n.
  function preparer(date, ed) {
    (ed.news || []).forEach(function (n, i) { n.__date = date; n.__num = i + 1; });
    return ed;
  }

  // Charge un fichier d'édition à la demande (fonctionne aussi en ouvrant index.html directement).
  function charger(date) {
    if (chargees[date]) return chargees[date];
    chargees[date] = new Promise(function (ok, ko) {
      if (window.EDITIONS && window.EDITIONS[date]) return ok(preparer(date, window.EDITIONS[date]));
      var s = document.createElement("script");
      s.src = "data/editions/" + date + ".js";
      s.onload = function () { window.EDITIONS && window.EDITIONS[date] ? ok(preparer(date, window.EDITIONS[date])) : ko(new Error(date)); };
      s.onerror = function () { ko(new Error(date)); };
      document.body.appendChild(s);
    });
    return chargees[date];
  }

  function ouvrir(n) {
    dlgContenu.textContent = "";
    if (n.photo) {
      var grand = document.createElement("img");
      grand.src = n.photo;
      grand.alt = "";
      grand.className = "detail-img";
      dlgContenu.appendChild(grand);
    }
    var corps = document.createElement("div");
    corps.className = "detail-corps";
    corps.appendChild(el("h2", n.titre || "Sans titre", "detail-titre"));
    if (n.sous_titre) corps.appendChild(el("p", n.sous_titre, "detail-sous"));
    // Info moins vérifiée : signalée au lecteur (verifiee: false dans l'édition).
    if (n.verifiee === true) corps.appendChild(el("p", "Information vérifiée : confirmée par une source officielle.", "verif-ok"));
    if (n.verifiee === false) corps.appendChild(el("p", "Information moins vérifiée : elle repose sur une source de presse, pas sur une source officielle confirmée.", "alerte-verif"));
    (n.article || []).forEach(function (p) { corps.appendChild(el("p", p, "detail-texte")); });
    if (n.le_plus) corps.appendChild(el("p", "Le + : " + n.le_plus, "news-plus"));
    if (n.sources && n.sources.length) {
      var srcs = document.createElement("div");
      srcs.className = "detail-sources";
      srcs.appendChild(el("p", "Sources", "detail-src-titre"));
      n.sources.forEach(function (s) {
        var a = document.createElement("a");
        a.href = s.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = s.nom;
        var p = document.createElement("p"); p.appendChild(a); srcs.appendChild(p);
      });
      corps.appendChild(srcs);
    }
    // Lien partagé : une page par news, avec aperçu (titre, visuel) pour Facebook, TikTok, WhatsApp…
    var lien = BASE + "/n/" + n.__date + "-" + n.__num + ".html";
    var zoneLien = document.createElement("div");
    zoneLien.className = "partage";
    var bouton = el("button", "Copier le lien (Instagram, TikTok)", "partage-bouton");
    bouton.type = "button";
    bouton.addEventListener("click", function () {
      var ok = function () { bouton.textContent = "Lien copié"; };
      var ko = function () { bouton.textContent = lien; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lien).then(ok, ko);
      else ko();
    });
    zoneLien.appendChild(bouton);
    // Partage direct : Facebook et LinkedIn ont un lien de partage web. Instagram et TikTok n'en ont pas : utiliser « Copier le lien ».
    [["Partager sur Facebook", "https://www.facebook.com/sharer/sharer.php?u="],
     ["Partager sur LinkedIn", "https://www.linkedin.com/sharing/share-offsite/?url="]].forEach(function (r) {
      var a = document.createElement("a");
      a.href = r[1] + encodeURIComponent(lien); a.target = "_blank"; a.rel = "noopener noreferrer";
      a.className = "partage-bouton"; a.textContent = r[0];
      zoneLien.appendChild(a);
    });
    corps.appendChild(zoneLien);

    dlgContenu.appendChild(corps);
    // Adresse de la news dans la barre du navigateur, et titre de l'onglet.
    try { history.replaceState(null, "", "#" + n.__date + "/" + n.__num); } catch (e) {}
    document.title = (n.titre || "News") + " · Geekotidien";
    dlg.showModal();
  }

  function grille(news) {
    var g = document.createElement("div");
    g.className = "grille";
    news.forEach(function (n, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "vignette";
      b.style.setProperty("--i", i);
      if (n.photo) {
        var img = document.createElement("img");
        img.src = n.photo; img.alt = ""; img.loading = "lazy";
        b.appendChild(img);
      }
      var txt = document.createElement("div");
      txt.className = "vignette-txt";
      txt.appendChild(el("span", n.titre || "Sans titre", "vignette-titre"));
      if (n.verifiee === false) txt.appendChild(el("span", "À vérifier", "vignette-alerte"));
      else if (n.verifiee === true) txt.appendChild(el("span", "Vérifié", "vignette-verifie"));
      b.appendChild(txt);
      b.addEventListener("click", function () { ouvrir(n); });
      g.appendChild(b);
    });
    return g;
  }

  function vider() { liste.textContent = ""; }
  function message(texte) { vider(); liste.appendChild(el("p", texte, "empty")); }
  // Message de chargement : une barre de lumière qui balaie la ligne.
  function chargement(texte) { vider(); liste.appendChild(el("p", texte, "empty loader")); }
  function setOnglet(id) {
    ["onglet-jour", "onglet-archives"].forEach(function (x) {
      document.getElementById(x).classList.toggle("on", x === id);
    });
  }

  // Affiche une édition complète (couverture + grille) ; titre de date en tête.
  function afficherEdition(date) {
    chargement("Chargement de l'édition…");
    charger(date).then(function (ed) {
      vider();
      var h = el("h2", "Édition du " + dateFr(date), "edition-titre");
      liste.appendChild(h);
      if (ed.cover) {
        var c = document.createElement("img");
        c.src = ed.cover; c.alt = "Couverture de l'édition du " + dateFr(date); c.className = "cover-img";
        liste.appendChild(c);
      }
      liste.appendChild(grille(ed.news || []));
    }).catch(function () {
      message("Cette édition n'existe pas ou n'est pas encore publiée.");
      var retour = document.createElement("p");
      retour.className = "empty";
      var a = document.createElement("a");
      a.href = "./"; a.textContent = "Revenir à la dernière édition";
      retour.appendChild(a);
      liste.appendChild(retour);
    });
  }

  // Page archives : une carte par édition, dans la limite d'un an.
  function afficherArchives() {
    vider();
    liste.appendChild(el("h2", "Archives", "edition-titre"));
    liste.appendChild(el("p", "Les éditions sont conservées pendant un an.", "lede"));
    index.forEach(function (e, i) {
      var a = document.createElement("a");
      a.className = "archive-item";
      a.style.setProperty("--i", i);
      a.href = "#" + e.date;
      a.appendChild(el("span", dateFr(e.date), "archive-date"));
      a.appendChild(el("span", (e.titres || []).join(" · "), "archive-titres"));
      liste.appendChild(a);
    });
  }

  // Recherche dans toutes les éditions (chargées à la demande).
  var recherche_id = 0;
  function rechercher(terme) {
    var id = ++recherche_id;
    var t = normaliser(terme.trim());
    if (!t) { route(); return; }
    setOnglet(null);
    chargement("Recherche en cours…");
    Promise.all(index.map(function (e) {
      return charger(e.date).then(function (ed) {
        return (ed.news || []).filter(function (n) {
          var texte = normaliser([n.titre, n.sous_titre, (n.article || []).join(" ")].join(" "));
          return texte.indexOf(t) !== -1;
        }).map(function (n) { return { date: e.date, news: n }; });
      }).catch(function () { return []; });
    })).then(function (res) {
      if (id !== recherche_id) return;
      var trouves = [].concat.apply([], res);
      vider();
      liste.appendChild(el("p", trouves.length + " résultat(s) pour « " + terme.trim() + " »", "lede"));
      if (!trouves.length) { liste.appendChild(el("p", "Aucune news ne contient ce mot.", "empty")); return; }
      trouves.forEach(function (r, i) {
        var ligne = document.createElement("div");
        ligne.className = "resultat";
        ligne.style.setProperty("--i", i);
        ligne.appendChild(el("span", dateFr(r.date), "archive-date"));
        ligne.appendChild(grille([r.news]));
        liste.appendChild(ligne);
      });
    });
  }

  function route() {
    var h = decodeURIComponent(location.hash.replace("#", ""));
    if (h === "archives") { setOnglet("onglet-archives"); afficherArchives(); return; }
    setOnglet("onglet-jour");
    // Lien direct vers une news : #AAAA-MM-JJ/n ouvre l'édition puis la news.
    var direct = /^(\d{4}-\d{2}-\d{2})\/(\d+)$/.exec(h);
    if (direct) {
      afficherEdition(direct[1]);
      charger(direct[1]).then(function (ed) {
        var n = (ed.news || [])[+direct[2] - 1];
        if (n) ouvrir(n);
      }).catch(function () {});
      return;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(h)) { afficherEdition(h); return; }
    if (index.length) afficherEdition(index[0].date);
    else message("Pas de news pour le moment.");
  }

  dlgFermer.addEventListener("click", function () { dlg.close(); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  // À la fermeture, on revient à l'édition et au titre du site.
  dlg.addEventListener("close", function () {
    var m = /^#(\d{4}-\d{2}-\d{2})\//.exec(location.hash);
    if (m) { try { history.replaceState(null, "", "#" + m[1]); } catch (e) {} }
    document.title = "Geekotidien";
  });
  champ.addEventListener("input", function () { rechercher(champ.value); });
  // Bouton « Copier l'adresse » du bloc contact.
  var copierContact = document.getElementById("copier-contact");
  if (copierContact) copierContact.addEventListener("click", function () {
    var adresse = "contact@geekotidien.fr";
    var ok = function () { copierContact.textContent = "Adresse copiée"; };
    var ko = function () { copierContact.textContent = adresse; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(adresse).then(ok, ko);
    else ko();
  });
  window.addEventListener("hashchange", function () { champ.value = ""; route(); });
  route();
})();
