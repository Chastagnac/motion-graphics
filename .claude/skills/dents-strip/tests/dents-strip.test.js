/*
 * dents-strip : tests. Sans navigateur, quelques secondes.
 *
 *   node --test .claude/skills/dents-strip/tests/dents-strip.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SKILL = path.resolve(__dirname, '..');
const BIB = path.resolve(SKILL, '../../../dents-du-cabinet');
const { compiler } = require(path.join(SKILL, 'scripts/compile.js'));
const { miseEnPage } = require(path.join(SKILL, 'scripts/planche.js'));
const D = require(path.join(BIB, 'dents.js'));
const Decors = require(path.join(BIB, 'decors.js'));
const cat = JSON.parse(fs.readFileSync(path.join(BIB, 'catalogue.json'), 'utf8'));

const compile = (strip, opts) => compiler(strip, D, cat, Object.assign({ decors: Decors.liste() }, opts));
const base = (surcharge) => Object.assign({
  id: 'T1-essai', serie: 'IRRITANT', titre: 'Essai',
  slides: [
    { texte: 'Cabinet dentaire, bonjour.', voix: 'incisive', personnages: [{ dent: 'incisive', expression: 'content' }] },
    { texte: 'La deuxième ligne sonne.', personnages: [{ dent: 'incisive', expression: 'choque' }, { dent: 'lait', expression: 'neutre' }] }
  ],
  legende: 'Et chez vous ?'
}, surcharge);

test('un strip valide se compile, une case par image par défaut', () => {
  const r = compile(base());
  assert.deepStrictEqual(r.erreurs, []);
  assert.strictEqual(r.data.cases.length, 2);
  assert.deepStrictEqual(r.data.carrousel, [1, 1]);
  assert.strictEqual(r.data.cases[0].voix, 0);
  assert.strictEqual(r.data.legende, 'Et chez vous ?');
});

test('les mots interdits et le tiret cadratin sont refusés partout, accroche comprise', () => {
  const cas = [
    ['titre', { titre: 'Le logiciel' }],
    ['accroche', { accroche: "Une IA à l'accueil." }],
    ['legende', { legende: 'Tout est automatique ?' }],
    ['legende', { legende: 'Un tiret — ici.' }]
  ];
  cas.forEach(([ou, surcharge]) => {
    const r = compile(base(surcharge));
    assert.ok(r.erreurs.some((e) => e.startsWith(ou)), `${ou} aurait dû être refusé : ${JSON.stringify(r.erreurs)}`);
    assert.strictEqual(r.data, null);
  });
  const texte = base();
  texte.slides[0].texte = "L'application sonne.";
  assert.ok(compile(texte).erreurs.some((e) => e.includes('mot interdit')));
});

test('un mot qui contient « ia » sans l’être passe', () => {
  assert.deepStrictEqual(compile(base({ titre: 'Le diagnostic familial' })).erreurs, []);
});

test('une pièce absente du catalogue est une erreur, jamais inventée', () => {
  const s = base();
  s.slides[0].personnages[0].expression = 'hilare';
  const r = compile(s);
  assert.ok(r.erreurs.some((e) => e.includes('hilare') && e.includes("n'existe pas dans catalogue.json")));
  const t = base();
  t.slides[0].personnages[0].dent = 'premolaire';
  assert.ok(compile(t).erreurs.length > 0);
});

test('la voix doit être dans la case et le décor doit exister', () => {
  const s = base();
  s.slides[0].voix = 'molaire';
  assert.ok(compile(s).erreurs.some((e) => e.includes('voix')));
  assert.ok(compile(base({ decor: 'plage' })).erreurs.some((e) => e.includes('decor')));
});

test('le découpage du carrousel doit couvrir toutes les cases', () => {
  assert.ok(compile(base({ carrousel: [1] })).erreurs.some((e) => e.startsWith('carrousel')));
  assert.ok(compile(base({ carrousel: [5] })).erreurs.some((e) => e.startsWith('carrousel')));
  assert.deepStrictEqual(compile(base({ carrousel: [2] })).erreurs, []);
});

test('la durée totale n’est exigée que pour une vidéo', () => {
  assert.deepStrictEqual(compile(base()).erreurs, []);
  assert.ok(compile(base(), { video: true }).erreurs.some((e) => e.startsWith('durée totale')));
});

test('mise en page : accroche sur la première image, légende sur la dernière, rien sur la planche', () => {
  const P = miseEnPage(4, [1, 2, 1], { accroche: 'Accroche', legende: 'Question ?' });
  const [planche, c1, c2, c3] = P.pages;
  assert.strictEqual(planche.id, 'planche');
  assert.ok(!planche.accroche && !planche.question);
  assert.strictEqual(c1.accroche.texte, 'Accroche');
  assert.ok(!c1.question && !c2.accroche && !c2.question && !c3.accroche);
  assert.strictEqual(c3.question.texte, 'Question ?');
  // les cases laissent la place aux bandes et tout tient dans la page
  assert.ok(c1.cellules[0].y >= c1.accroche.y + c1.accroche.h);
  const bas = Math.max(...c3.cellules.map((c) => c.y + c.h));
  assert.ok(c3.question.y >= bas && c3.question.y + c3.question.h <= P.piedY);
  // sans texte, la mise en page d'avant est inchangée
  const nue = miseEnPage(4, [1, 2, 1]);
  assert.deepStrictEqual(nue.pages[2].cellules, c2.cellules);
  assert.strictEqual(nue.pages[1].cellules[0].y, P.marge);
});

test('au-delà de 6 cases il n’y a plus de planche unique', () => {
  assert.ok(miseEnPage(7, [4, 3]).pages.every((p) => p.id !== 'planche'));
});

test('décor de l’accueil : l’étagère et l’horloge s’effacent derrière une tête', () => {
  const o = { W: 1080, H: 1334, sol: 1167, u: 3.3, fond: '#B9C8FF' };
  const libre = Decors.rendre('accueil', o);
  const grand = Decors.rendre('accueil', Object.assign({ tetes: [{ x: 540, h: 216 }] }, o));
  const petit = Decors.rendre('accueil', Object.assign({ tetes: [{ x: 540, h: 132 }] }, o));
  assert.ok(grand.length < libre.length, 'un grand personnage au centre doit masquer l’étagère');
  assert.strictEqual(petit, libre, 'un petit personnage passe sous l’étagère, rien ne bouge');
});

test('histoire.js : texte + mise en scène -> JSON, avec accroche et découpage', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'dents-strip-'));
  const md = path.join(dossier, 'essai.md'), txt = path.join(dossier, 'essai.txt'), sortie = path.join(dossier, 'series');
  fs.writeFileSync(md, [
    '# Essai', '', '---', '',
    '## T01 · Trois lignes',
    'irritant · accueil · légende : Et chez vous ?',
    'Le message : une seule personne.',
    "L'accroche : 8h04. Trois demandes.",
    '', '**Page 1**', '- INCISIVE : Cabinet dentaire, bonjour.',
    '', '**Page 2**', '- (narration) La deuxième ligne sonne.', '- LAIT : Bonjour !', ''
  ].join('\n'));
  fs.writeFileSync(txt, ['# T01', '1: incisive content pg:telephone', '2: incisive choque', '3: incisive neutre | lait content calme'].join('\n'));
  const run = () => spawnSync(process.execPath, [path.join(SKILL, 'scripts/histoire.js'), md, txt, '--sortie', sortie], { encoding: 'utf8' });
  let r = run();
  assert.strictEqual(r.status, 0, r.stderr);
  const s = JSON.parse(fs.readFileSync(path.join(sortie, 'T01-trois-lignes.json'), 'utf8'));
  assert.strictEqual(s.accroche, '8h04. Trois demandes.');
  assert.strictEqual(s.legende, 'Et chez vous ?');
  assert.deepStrictEqual(s.carrousel, [1, 2]);
  assert.strictEqual(s.slides[0].voix, 'incisive');
  assert.deepStrictEqual(s.slides[0].personnages[0], { dent: 'incisive', expression: 'content', propG: 'telephone', brasG: 'tient' });
  assert.ok(!('voix' in s.slides[1]));
  assert.deepStrictEqual(compile(s).erreurs, []);

  // une case de moins dans la mise en scène : rien n'est écrit
  fs.writeFileSync(txt, ['# T01', '1: incisive content', '2: incisive choque'].join('\n'));
  fs.rmSync(sortie, { recursive: true });
  r = run();
  assert.strictEqual(r.status, 1);
  assert.ok(!fs.existsSync(sortie));
  fs.rmSync(dossier, { recursive: true, force: true });
});

test('tous les strips du dépôt se compilent sans erreur', () => {
  const series = path.join(BIB, 'series');
  const fichiers = fs.readdirSync(series).flatMap((d) => fs.readdirSync(path.join(series, d)).filter((f) => f.endsWith('.json')).map((f) => path.join(series, d, f)));
  assert.ok(fichiers.length > 0);
  fichiers.forEach((f) => {
    const r = compile(JSON.parse(fs.readFileSync(f, 'utf8')));
    assert.deepStrictEqual(r.erreurs, [], path.basename(f));
  });
});

test('les JSON des séries sont à jour avec histoires/ et mises-en-scene/', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'dents-strip-'));
  fs.readdirSync(path.join(BIB, 'histoires')).filter((f) => f.endsWith('.md')).forEach((f) => {
    const nom = path.basename(f, '.md');
    const sortie = path.join(dossier, nom);
    const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts/histoire.js'), path.join(BIB, 'histoires', f), path.join(BIB, 'mises-en-scene', nom + '.txt'), '--sortie', sortie], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    fs.readdirSync(sortie).forEach((j) => {
      assert.strictEqual(fs.readFileSync(path.join(BIB, 'series', nom, j), 'utf8').replace(/\r\n/g, '\n'), fs.readFileSync(path.join(sortie, j), 'utf8'),
        `${nom}/${j} : relance histoire.js, le JSON ne correspond plus à sa source`);
    });
  });
  fs.rmSync(dossier, { recursive: true, force: true });
});

test('aucun personnage existant n’a changé (dents-du-cabinet/verifier.js)', () => {
  const r = spawnSync(process.execPath, [path.join(BIB, 'verifier.js')], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
});
