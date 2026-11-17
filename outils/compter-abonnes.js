#!/usr/bin/env node
// Écrit le nombre d'abonnés de la liste Mailjet dans data/abonnes.json.
// Seul le total est enregistré : aucune adresse n'est écrite dans le site.
// Authentification : MAILJET_API_KEY et MAILJET_API_SECRET (secrets GitHub Actions).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const idListe = process.env.MAILJET_LIST_ID;
if (!idListe) { console.error('Variable MAILJET_LIST_ID manquante'); process.exit(1); }
if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_API_SECRET) {
  console.error('Secrets Mailjet manquants'); process.exit(1);
}

const resultat = spawnSync('curl', [
  '-sS', '-u', `${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`,
  '-w', '\n%{http_code}',
  `https://api.mailjet.com/v3/REST/contactslist/${encodeURIComponent(idListe)}`
], { encoding: 'utf8' });
if (resultat.status !== 0) { console.error(resultat.stderr.trim()); process.exit(1); }

const sortie = resultat.stdout;
const cut = sortie.lastIndexOf('\n');
const code = Number(sortie.slice(cut + 1));
if (code < 200 || code >= 300) { console.error(`Mailjet ${code} : ${sortie.slice(0, cut)}`); process.exit(1); }

const donnees = JSON.parse(sortie.slice(0, cut));
const liste = donnees.Data && donnees.Data[0];
if (!liste || typeof liste.SubscriberCount !== 'number') {
  console.error('Nombre d\'abonnés introuvable dans la réponse Mailjet'); process.exit(1);
}

const fichier = path.join(__dirname, '..', 'data', 'abonnes.json');
fs.writeFileSync(fichier, JSON.stringify({ total: liste.SubscriberCount }, null, 2) + '\n');
console.log(`Abonnés : ${liste.SubscriberCount}`);
