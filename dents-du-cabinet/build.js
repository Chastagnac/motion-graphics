const fs = require('fs');
const path = require('path');
const D = require('./dents.js');
const out = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); };
const OUT = process.argv[2] || './dist';
const cat = D.catalogue();

// 1. Poses par défaut et toutes les expressions de chaque dent
cat.dents.concat(cat.humains).forEach((d) => {
  out(`${OUT}/svg/${d}/${d}-defaut.svg`, D.renderTooth({ dent: d }));
  cat.expressions.forEach((e) => out(`${OUT}/svg/${d}/${d}-${e}.svg`, D.renderTooth({ dent: d, expression: e })));
});
out(`${OUT}/catalogue.json`, JSON.stringify(cat, null, 2));

// 2. Exemple de données de carrousel
const exemple = {
  id: 'S1-lundi', serie: 'STRIP', titre: 'Lundi 8h01',
  slides: [
    { texte: "L'incisive pose son café.", personnages: [{ dent: 'incisive', expression: 'content', brasD: 'tient', propD: 'cafe' }] },
    { texte: 'Le téléphone sonne.', personnages: [{ dent: 'incisive', expression: 'regard_camera', brasD: 'tient', propD: 'cafe' }] },
    { texte: 'Elle décroche. La deuxième ligne sonne.', personnages: [{ dent: 'incisive', expression: 'panique', brasG: 'tient', propG: 'telephone', brasD: 'tient', propD: 'cafe' }] },
    { texte: '« Lundi, 8h01. »', personnages: [{ dent: 'incisive', expression: 'blase', brasD: 'tient', propD: 'cafe' }] }
  ],
  legende: "Combien d'appels avant 9h chez vous ?"
};
out(`${OUT}/exemple-carrousel.json`, JSON.stringify(exemple, null, 2));

// 3. Planche de contrôle
const cell = (svg, label, w = 150) =>
  `<div class="cell"><div style="width:${w}px">${svg}</div><div class="lab">${label}</div></div>`;
const sec = (titre, inner) => `<section><h2>${titre}</h2><div class="grid">${inner}</div></section>`;
let html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:10mm}
body{font-family:'DejaVu Sans',sans-serif;color:#141413;margin:0}
h1{font-size:22pt;margin:0 0 4pt}
.sub{font-size:11pt;margin:0 0 10pt}
h2{font-size:13pt;background:#FFD84D;padding:4pt 8pt;margin:12pt 0 6pt}
section{break-inside:avoid}
.grid{display:flex;flex-wrap:wrap;gap:6pt}
.cell{display:flex;flex-direction:column;align-items:center}
.lab{font-size:9pt;margin-top:2pt;text-align:center}
.pb{break-before:page}
code{font-size:9pt}
</style></head><body>`;
html += `<h1>Les Dents du Cabinet · bibliothèque de pièces</h1><p class="sub">Chaque personnage, dent ou dentiste, est assemblé à partir de calques : corps, sourcils, yeux, bouche, bras, objets, jambes, effets, masque.</p>`;
html += sec('Le casting en pose par défaut', cat.dents.map((d) => cell(D.renderTooth({ dent: d }), `${D.BODIES[d].nom}<br>${D.BODIES[d].role}`, 120)).join(''));
html += sec('Les 10 expressions (sur la molaire)', cat.expressions.map((e) => cell(D.renderTooth({ dent: 'molaire', expression: e, brasG: 'bas', brasD: 'bas' }), e, 92)).join(''));
html += `<div class="pb"></div>`;
html += sec('Les 8 poses de bras (sur la canine)', cat.bras.map((b) => cell(D.renderTooth({ dent: 'canine', expression: 'neutre', brasG: b, brasD: b, propD: null }), b, 110)).join(''));
html += sec('Les 7 objets tenus (sur l\'incisive)', cat.objets.map((o) => cell(D.renderTooth({ dent: 'incisive', expression: 'neutre', brasG: 'bas', brasD: 'tient', propD: o }), o, 110)).join(''));
html += sec('Jambes et effets (sur la dent de lait et la sagesse)',
  cat.jambes.map((j) => cell(D.renderTooth({ dent: 'lait', expression: 'neutre', brasG: 'bas', brasD: 'bas', jambes: j }), 'jambes : ' + j, 100)).join('') +
  ['choc', 'zzz'].map((e) => cell(D.renderTooth({ dent: 'sagesse', expression: e === 'zzz' ? 'blase' : 'choque', effets: [e] }), 'effet : ' + e, 100)).join(''));
html += `<div class="pb"></div>`;
html += sec('Les dentistes en pose par défaut', cat.humains.map((d) => cell(D.renderTooth({ dent: d }), `${D.BODIES[d].nom}<br>${D.BODIES[d].role}`, 130)).join('') +
  ['menton', 'haut'].map((m) => cell(D.renderTooth({ dent: 'docteur', expression: m === 'haut' ? 'juge' : 'content', masque: m, propD: null, brasD: 'bas' }), 'masque : ' + m, 130)).join(''));
html += sec('Les dentistes dans chaque expression', cat.humains.map((d) => cat.expressions.map((e) => cell(D.renderTooth({ dent: d, expression: e }), `${d} · ${e}`, 64)).join('')).join(''));
html += sec('Scène : dentistes et dents ensemble',
  cell(D.renderTooth({ dent: 'lait', expression: 'panique' }) , 'La dent de lait : « Ça va faire mal ? »', 140) +
  cell(D.renderTooth({ dent: 'docteure', expression: 'juge', masque: 'haut', brasD: 'tient', propD: 'miroir' }), 'La docteure lève un sourcil.', 140) +
  cell(D.renderTooth({ dent: 'canine', expression: 'regard_camera' }), 'La canine regarde la caméra.', 140) +
  cell(D.renderTooth({ dent: 'collaborateur', expression: 'choque', brasG: 'leve', brasD: 'leve', propG: null }), 'Le collaborateur, lui, panique.', 140));
html += `<div class="pb"></div>`;
html += sec('Chaque dent dans chaque expression', cat.dents.map((d) => cat.expressions.map((e) => cell(D.renderTooth({ dent: d, expression: e }), `${d} · ${e}`, 64)).join('')).join(''));
html += sec('Exemple : le strip « Lundi 8h01 » piloté par les données', exemple.slides.map((s, i) => cell(D.renderTooth(s.personnages[0]), `${i + 1}. ${s.texte}`, 150)).join(''));
html += `</body></html>`;
out(`${OUT}/planche.html`, html);
console.log('ok', fs.readdirSync(`${OUT}/svg`).length, 'dents');
