// Compteur « en ligne » : nombre de visiteurs qui ont le site ouvert en ce moment.
// Utilise le canal « présence » de Supabase : aucun cookie, aucune donnée personnelle.
// Actif seulement si config.js est rempli.
(function () {
  var C = window.GEEKO_CONFIG || {};
  if (!C.supabaseUrl || !C.supabaseKey) return;
  var zone = document.getElementById("en-ligne");
  if (!zone) return;

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
