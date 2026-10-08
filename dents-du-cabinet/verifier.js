#!/usr/bin/env node
/*
 * Les Dents du Cabinet : garde-fou de la règle « on ne modifie jamais un personnage existant ».
 * Redessine chaque personnage dans chaque expression et compare au dessin de référence de svg/.
 *
 *   node verifier.js            compare, sort en erreur si un dessin existant a changé
 *   node verifier.js --accepter après un changement voulu : enregistre les dessins actuels comme référence
 */
const fs = require('fs');
const path = require('path');
const D = require('./dents.js');

const REF = path.join(__dirname, 'svg');
const accepter = process.argv.includes('--accepter');
const cat = D.catalogue();

const attendus = {};
cat.dents.concat(cat.humains).forEach((d) => {
  attendus[`${d}/${d}-defaut.svg`] = D.renderTooth({ dent: d });
  cat.expressions.forEach((e) => { attendus[`${d}/${d}-${e}.svg`] = D.renderTooth({ dent: d, expression: e }); });
});

const changes = [], nouveaux = [];
Object.keys(attendus).forEach((f) => {
  const ref = path.join(REF, f);
  if (!fs.existsSync(ref)) nouveaux.push(f);
  else if (fs.readFileSync(ref, 'utf8') !== attendus[f]) changes.push(f);
});

if (accepter) {
  changes.concat(nouveaux).forEach((f) => {
    fs.mkdirSync(path.dirname(path.join(REF, f)), { recursive: true });
    fs.writeFileSync(path.join(REF, f), attendus[f]);
  });
  console.log(`Référence mise à jour : ${changes.length} dessin(s) remplacé(s), ${nouveaux.length} ajouté(s).`);
  process.exit(0);
}

nouveaux.forEach((f) => console.log(`nouveau, sans référence : ${f}`));
changes.forEach((f) => console.error(`MODIFIÉ : ${f}`));
if (changes.length) {
  console.error(`\n${changes.length} dessin(s) existant(s) ont changé. Si c'est voulu : node verifier.js --accepter`);
  process.exit(1);
}
console.log(`${Object.keys(attendus).length - nouveaux.length} dessins identiques à la référence` + (nouveaux.length ? `, ${nouveaux.length} nouveau(x) à accepter` : '') + '.');
