#!/usr/bin/env node
/*
 * dents-strip : des histoires écrites en texte + leur mise en scène -> un JSON de strip par histoire.
 *
 *   node histoire.js <histoires.md> <mise-en-scene.txt> [--sortie <dossier>]
 *
 * L'écriture et la mise en scène restent deux fichiers séparés :
 *   - histoires.md      le texte seul (pages, répliques, narration), voir dents-du-cabinet/histoires/
 *   - mise-en-scene.txt qui est dans chaque case et dans quelle pose, voir dents-du-cabinet/mises-en-scene/
 * Les JSON produits se rendent ensuite avec strip.js. Ne les corrige pas à la main : corrige la
 * source et relance.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const iSortie = args.indexOf('--sortie');
const optSortie = iSortie < 0 ? null : args.splice(iSortie, 2)[1];
const [fHistoires, fScene] = args;
if (!fHistoires || !fScene) { console.error('Usage : node histoire.js <histoires.md> <mise-en-scene.txt> [--sortie <dossier>]'); process.exit(2); }

const erreurs = [];
const err = (ou, quoi) => erreurs.push(`${ou} : ${quoi}`);
const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (s) => sansAccent(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const DECORS = { cabinet: 'cabinet', accueil: 'accueil', soiree: 'soiree', reunion: 'reunion', sol: 'sol', aucun: 'aucun' };

// ---------- 1. le texte ----------
function lireHistoires(texte) {
  const corps = texte.split(/^---\s*$/m).slice(1).join('\n');
  const histoires = [];
  let h = null;
  corps.split(/\r?\n/).forEach((brute) => {
    const l = brute.trim();
    let m;
    if ((m = /^##\s+(\S+)\s+·\s+(.+)$/.exec(l))) {
      h = { code: m[1], titre: m[2].trim(), serie: null, decor: null, legende: '', pages: [] };
      histoires.push(h);
    } else if (!h || !l) {
      return;
    } else if (h.serie == null && (m = /^(.+?)\s+·\s+(.+?)\s+·\s+légende\s*:\s*(.+)$/.exec(l))) {
      h.serie = sansAccent(m[1]).toUpperCase();
      h.decor = DECORS[sansAccent(m[2].split(',')[0]).toLowerCase().trim()];
      if (!h.decor) err(h.code, `lieu « ${m[2]} » inconnu (${Object.keys(DECORS).join(', ')})`);
      h.legende = m[3].trim();
    } else if ((m = /^L['’]accroche\s*:\s*(.+)$/.exec(l))) {
      h.accroche = m[1].trim();
    } else if (/^\*\*Page\s+\d+\*\*$/.test(l)) {
      h.pages.push([]);
    } else if ((m = /^-\s+\(narration\)\s+(.+)$/.exec(l))) {
      if (!h.pages.length) err(h.code, 'une case arrive avant la première page'); else h.pages[h.pages.length - 1].push({ texte: m[1] });
    } else if ((m = /^-\s+([A-ZÀ-Ý]+)\s+:\s+(.+)$/.exec(l))) {
      if (!h.pages.length) err(h.code, 'une case arrive avant la première page'); else h.pages[h.pages.length - 1].push({ voix: sansAccent(m[1]).toLowerCase(), texte: m[2] });
    } else if (l.startsWith('- ')) {
      err(h.code, `ligne de case illisible : « ${l} »`);
    }
  });
  return histoires;
}

// ---------- 2. la mise en scène ----------
// Une ligne par case :  N: personnage [expression] [options] | personnage ... ; decor=accueil places=2
// Options d'un personnage : g:<bras gauche> d:<bras droit> pg:<objet gauche> pd:<objet droit> (« - » = rien)
//                           j:<jambes> p:<place> calme (bras baissés, debout, mains vides)
// Ce qui n'est pas écrit garde la pose par défaut du personnage dans dents.js.
// « decor= » vaut pour cette case et les suivantes, jusqu'au prochain « decor= ».
// « plan=drame » : gros plan sur celui qui parle (ou le premier personnage), décor dans le noir, texte en bandeau.
function lirePerso(ou, morceau) {
  const [dent, ...jetons] = morceau.trim().split(/\s+/);
  const p = { dent };
  const brasPose = {};
  jetons.forEach((j) => {
    const m = /^(g|d|pg|pd|j|p):(.+)$/.exec(j);
    if (j === 'calme') Object.assign(p, { brasG: 'bas', brasD: 'bas', jambes: 'debout', propG: null, propD: null });
    else if (!m) p.expression = j;
    else if (m[1] === 'g') { p.brasG = m[2]; brasPose.G = true; }
    else if (m[1] === 'd') { p.brasD = m[2]; brasPose.D = true; }
    else if (m[1] === 'pg') { p.propG = m[2] === '-' ? null : m[2]; brasPose.pG = true; }
    else if (m[1] === 'pd') { p.propD = m[2] === '-' ? null : m[2]; brasPose.pD = true; }
    else if (m[1] === 'j') p.jambes = m[2];
    else if (m[1] === 'p') p.place = parseInt(m[2], 10);
  });
  // un objet demandé sans pose de bras se tient ; un bras qui change de pose sans objet lâche le sien
  ['G', 'D'].forEach((c) => {
    if (brasPose['p' + c] && p['prop' + c] && !brasPose[c]) p['bras' + c] = 'tient';
    if (brasPose[c] && !brasPose['p' + c] && p['bras' + c] !== 'tient') p['prop' + c] = null;
  });
  if (!dent) err(ou, 'personnage sans nom');
  return p;
}

function lireScenes(texte) {
  const scenes = {};
  let code = null;
  texte.split(/\r?\n/).forEach((brute, n) => {
    const l = brute.trim();
    let m;
    if (!l || l.startsWith('//')) return;
    if ((m = /^#\s+(\S+)/.exec(l))) { code = m[1]; scenes[code] = {}; return; }
    if (!(m = /^(\d+)\s*:\s*(.+)$/.exec(l)) || !code) { err(`mise en scène, ligne ${n + 1}`, `illisible : « ${l} »`); return; }
    const [persos, options = ''] = m[2].split(';');
    const c = { personnages: persos.split('|').map((x) => lirePerso(`${code} case ${m[1]}`, x)) };
    options.trim().split(/\s+/).filter(Boolean).forEach((o) => {
      const [k, v] = o.split('=');
      if (k === 'decor') c.decor = v; else if (k === 'places') c.places = parseInt(v, 10); else if (k === 'plan') c.plan = v; else err(`${code} case ${m[1]}`, `option inconnue « ${o} »`);
    });
    scenes[code][m[1]] = c;
  });
  return scenes;
}

// ---------- 3. assemblage ----------
const histoires = lireHistoires(fs.readFileSync(fHistoires, 'utf8'));
const scenes = lireScenes(fs.readFileSync(fScene, 'utf8'));
if (!histoires.length) err(fHistoires, 'aucune histoire trouvée (titres « ## CODE · Titre » après la ligne ---)');

const strips = histoires.map((h) => {
  const scene = scenes[h.code];
  if (!scene) { err(h.code, `pas de mise en scène dans ${path.basename(fScene)}`); return null; }
  if (!h.serie) err(h.code, 'ligne « série · lieu · légende : … » manquante');
  const cases = h.pages.flat();
  if (Object.keys(scene).length !== cases.length) err(h.code, `${cases.length} cases dans le texte, ${Object.keys(scene).length} dans la mise en scène`);
  let decor = h.decor;
  const slides = cases.map((c, i) => {
    const s = scene[i + 1];
    if (!s) { err(h.code, `case ${i + 1} sans mise en scène`); return null; }
    if (s.decor) decor = s.decor;
    if (c.voix && !s.personnages.some((p) => p.dent === c.voix)) err(h.code, `case ${i + 1} : ${c.voix} parle mais n'est pas dans la case`);
    const slide = { texte: c.texte };
    if (c.voix) slide.voix = c.voix;
    if (decor !== h.decor) slide.decor = decor;
    if (s.places) slide.places = s.places;
    if (s.plan) slide.plan = s.plan;
    slide.personnages = s.personnages;
    return slide;
  });
  const strip = { id: `${h.code}-${slug(h.titre)}`, serie: h.serie, titre: h.titre };
  if (h.accroche) strip.accroche = h.accroche;
  return Object.assign(strip, { decor: h.decor, carrousel: h.pages.map((p) => p.length), slides, legende: h.legende });
});

if (erreurs.length) { erreurs.forEach((e) => console.error('ERREUR, ' + e)); console.error('\nRien n\'a été écrit.'); process.exit(1); }

const sortie = path.resolve(optSortie || path.join(path.dirname(path.resolve(fHistoires)), '..', 'series', path.basename(fHistoires, '.md')));
fs.mkdirSync(sortie, { recursive: true });
strips.forEach((s) => {
  fs.writeFileSync(path.join(sortie, s.id + '.json'), JSON.stringify(s, null, 2) + '\n');
  console.log(`${s.id} : ${s.slides.length} cases, ${s.carrousel.length} pages`);
});
console.log(`\n${strips.length} strip(s) dans ${path.relative(process.cwd(), sortie)}`);
