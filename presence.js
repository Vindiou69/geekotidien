// Compteur « en ligne » : nombre de visiteurs qui ont le site ouvert en ce moment.
// Utilise le canal « présence » de Supabase : aucun cookie, aucune donnée personnelle.
// Actif seulement si config.js est rempli.
(function () {
  var C = window.GEEKO_CONFIG || {};
  if (!C.supabaseUrl || !C.supabaseKey) return;
  var zone = document.getElementById("en-ligne");
  if (!zone) return;

  // Total des visites : +1 à l'ouverture d'une session de navigation (un rechargement ne recompte pas).
  var zoneVisites = document.getElementById("visites");
  var entetes = { "apikey": C.supabaseKey, "Authorization": "Bearer " + C.supabaseKey, "Content-Type": "application/json" };
  function afficherVisites(n) {
    if (!zoneVisites) return;
    zoneVisites.textContent = Number(n).toLocaleString("fr-FR") + " visites depuis le lancement";
    zoneVisites.hidden = false;
  }
  function lireVisites() {
    fetch(C.supabaseUrl + "/rest/v1/compteur?nom=eq.visites&select=total", { headers: entetes })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (l) { if (l[0]) afficherVisites(l[0].total); })
      .catch(function () {});
  }
  var dejaCompte = false;
  try { dejaCompte = sessionStorage.getItem("visite-comptee") === "1"; } catch (e) {}
  if (dejaCompte) {
    lireVisites();
  } else {
    fetch(C.supabaseUrl + "/rest/v1/rpc/enregistrer_visite", { method: "POST", headers: entetes })
      .then(function (r) { if (!r.ok) throw new Error("erreur"); return r.json(); })
      .then(function (n) {
        afficherVisites(n);
        try { sessionStorage.setItem("visite-comptee", "1"); } catch (e) {}
      })
      .catch(lireVisites);
  }

  function afficher(n) {
    zone.textContent = "● " + n + (n > 1 ? " personnes" : " personne") + " en ligne";
    zone.hidden = false;
  }

  var s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.min.js";
  s.onload = function () {
    try {
      var client = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
      var salon = client.channel("visiteurs", {
        config: { presence: { key: Math.random().toString(36).slice(2) } }
      });
      salon.on("presence", { event: "sync" }, function () {
        afficher(Object.keys(salon.presenceState()).length);
      });
      salon.subscribe(function (etat) {
        if (etat === "SUBSCRIBED") salon.track({ en_ligne: true });
      });
    } catch (e) { zone.hidden = true; }
  };
  s.onerror = function () { zone.hidden = true; };
  document.head.appendChild(s);
})();
