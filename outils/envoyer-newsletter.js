#!/usr/bin/env node
// Envoie la newsletter Geekotidien d'une édition via l'API Mailjet.
//
// Usage :
//   node outils/envoyer-newsletter.js 2026-11-17 --test contact@exemple.fr
//       → envoi d'essai à UNE seule adresse (aucun abonné n'est touché).
//   CONFIRMER=oui MAILJET_LIST_ID=12345 node outils/envoyer-newsletter.js 2026-11-17 --liste
//       → envoi réel à la liste « Geekotidien ». Refusé sans CONFIRMER=oui.
//
// Authentification : le proxy de l'environnement ajoute la clé Mailjet (secret réseau
// lié à api.mailjet.com). Aucune clé n'est écrite dans ce fichier.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RACINE = path.join(__dirname, '..');
const API = 'https://api.mailjet.com';
const EXPEDITEUR = { Email: 'newsletter@geekotidien.fr', Name: 'Geekotidien' };
const SITE = 'https://geekotidien.fr';

function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chargerEdition(date) {
  const fichier = path.join(RACINE, 'data', 'editions', `${date}.js`);
  if (!fs.existsSync(fichier)) throw new Error(`Édition introuvable : ${fichier}`);
  const fenetre = {};
  vm.runInNewContext(fs.readFileSync(fichier, 'utf8'), { window: fenetre });
  const edition = fenetre.EDITIONS && fenetre.EDITIONS[date];
  if (!edition) throw new Error(`Édition ${date} absente du fichier`);
  return edition;
}

function dateFr(date) {
  const [a, m, j] = date.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  });
}

function construireMail(edition) {
  const titreDate = dateFr(edition.date);
  const blocs = edition.news.map((n, i) => {
    const premier = (n.article && n.article[0]) || '';
    const source = (n.sources && n.sources[0]) || null;
    const alerte = n.verifiee === false
      ? '<span style="color:#9a5b00;font-size:12px;">À vérifier</span>'
      : '';
    return `
      <tr><td style="padding:18px 0;border-top:1px solid #d8d6cc;font-family:Arial,Helvetica,sans-serif;color:#15181b;">
        <div style="font-size:12px;color:#5b646d;">N°${i + 1} ${alerte}</div>
        <h2 style="font-size:18px;margin:6px 0;color:#15181b;">${echapper(n.titre)}</h2>
        <p style="font-size:14px;color:#5b646d;margin:0 0 8px;">${echapper(n.sous_titre || '')}</p>
        <p style="font-size:15px;line-height:1.5;margin:0 0 10px;color:#15181b;">${echapper(premier)}</p>
        ${source ? `<p style="font-size:13px;margin:0 0 10px;"><a href="${echapper(source.url)}" style="color:#18795a;">Source : ${echapper(source.nom)}</a></p>` : ''}
        <p style="margin:0;"><a href="${SITE}" style="color:#18795a;font-weight:bold;font-size:14px;">Lire sur geekotidien.fr</a></p>
      </td></tr>`;
  }).join('');

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f3ee;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f3ee;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;padding:24px;">
        <tr><td align="center" style="padding-bottom:12px;">
          <img src="${SITE}/geekotidien-logo.png" width="96" height="96" alt="Geekotidien" style="border-radius:50%;">
        </td></tr>
        <tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;color:#15181b;">
          <h1 style="font-size:22px;margin:0 0 4px;color:#18795a;">Geekotidien</h1>
          <p style="font-size:14px;color:#5b646d;margin:0 0 16px;">${echapper(titreDate)}</p>
        </td></tr>
        ${blocs}
        <tr><td style="padding-top:18px;border-top:1px solid #d8d6cc;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5b646d;line-height:1.5;">
          <p style="margin:0 0 8px;">Vous recevez ce mail car vous vous êtes inscrit à la newsletter Geekotidien.</p>
          <p style="margin:0 0 8px;"><a href="[[UNSUB_LINK_EN]]" style="color:#18795a;">Se désabonner</a> · <a href="${SITE}/mentions-legales.html" style="color:#18795a;">Mentions légales</a> · <a href="mailto:contact@geekotidien.fr" style="color:#18795a;">contact@geekotidien.fr</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const texte = [
    `Geekotidien : ${titreDate}`,
    '',
    ...edition.news.map((n, i) => {
      const premier = (n.article && n.article[0]) || '';
      const alerte = n.verifiee === false ? ' (à vérifier)' : '';
      return `${i + 1}. ${n.titre}${alerte}\n${n.sous_titre || ''}\n${premier}\nLire sur ${SITE}\n`;
    }),
    'Se désabonner : [[UNSUB_LINK_EN]]',
    `Mentions légales : ${SITE}/mentions-legales.html`
  ].join('\n');

  return { sujet: `Geekotidien : édition du ${titreDate}`, html, texte };
}

// Appels via curl : curl respecte le proxy de l'environnement (HTTPS_PROXY),
// contrairement à fetch de Node.js, qui échouait avec « fetch failed ».
function appeler(chemin, corps) {
  const resultat = require('child_process').spawnSync('curl', [
    '-sS', '-X', 'POST', API + chemin,
    '-H', 'Content-Type: application/json',
    '--data-binary', '@-',
    '-w', '\n%{http_code}'
  ], { input: JSON.stringify(corps), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (resultat.error) throw new Error(`curl introuvable ou en échec : ${resultat.error.message}`);
  if (resultat.status !== 0) throw new Error(`curl a échoué (code ${resultat.status}) : ${resultat.stderr.trim()}`);
  const sortie = resultat.stdout;
  const cut = sortie.lastIndexOf('\n');
  const texte = sortie.slice(0, cut);
  const code = Number(sortie.slice(cut + 1));
  if (code < 200 || code >= 300) throw new Error(`Mailjet ${code} sur ${chemin} : ${texte}`);
  return JSON.parse(texte);
}

// Essai : un seul destinataire, via l'API d'envoi transactionnel (v3.1).
function envoyerTest(mail, adresse) {
  const resultat = appeler('/v3.1/send', {
    Messages: [{
      From: EXPEDITEUR,
      To: [{ Email: adresse }],
      Subject: `[TEST] ${mail.sujet}`,
      TextPart: mail.texte,
      HTMLPart: mail.html
    }]
  });
  console.log('Envoi d\'essai demandé :', JSON.stringify(resultat));
}

// Envoi réel : campagne vers la liste « Geekotidien ».
function envoyerListe(mail, idListe) {
  const brouillon = appeler('/v3/REST/campaigndraft', {
    Subject: mail.sujet,
    Title: mail.sujet,
    FromEmail: EXPEDITEUR.Email,
    FromName: EXPEDITEUR.Name,
    Locale: 'fr_FR',
    ContactsListID: Number(idListe)
  });
  const id = brouillon.Data[0].ID;
  appeler(`/v3/REST/campaigndraft/${id}/detailcontent`, {
    'Html-part': mail.html,
    'Text-part': mail.texte
  });
  const envoi = appeler(`/v3/REST/campaigndraft/${id}/send`, {});
  console.log('Campagne envoyée :', JSON.stringify(envoi));
}

function principal() {
  const [date, mode, valeur] = process.argv.slice(2);
  if (!date || !mode) {
    console.error('Usage : node outils/envoyer-newsletter.js AAAA-MM-JJ --test adresse | --liste');
    process.exit(1);
  }
  const edition = chargerEdition(date);
  const mail = construireMail(edition);

  if (mode === '--test') {
    if (!valeur) throw new Error('Indiquer une adresse pour --test');
    envoyerTest(mail, valeur);
    return;
  }
  if (mode === '--liste') {
    if (process.env.CONFIRMER !== 'oui') {
      throw new Error('Envoi à la liste refusé : relancer avec CONFIRMER=oui après validation du test.');
    }
    const idListe = process.env.MAILJET_LIST_ID;
    if (!idListe) throw new Error('Variable MAILJET_LIST_ID manquante');
    envoyerListe(mail, idListe);
    return;
  }
  throw new Error(`Mode inconnu : ${mode}`);
}

try {
  principal();
} catch (erreur) {
  console.error(erreur.message);
  process.exit(1);
}
