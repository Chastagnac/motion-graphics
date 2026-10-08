#!/usr/bin/env node
/*
 * dents-strip : des JSON de strip -> planche de BD, carrousel, page de relecture, et vidéo sur demande.
 *
 *   node strip.js <strip.json | dossier> [...] [--video] [--clore-commentaires]
 *                 [--bibliotheque <dossier de dents.js>] [--moteur <dossier engine>] [--playwright <node_modules>]
 *
 * Un dossier vaut tous ses .json. Sans --video, seules les images sont produites (quelques secondes
 * par strip). Tous les fichiers sont validés avant le premier rendu : une seule erreur arrête tout.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');
const { compiler, FPS } = require('./compile.js');
const { miseEnPage } = require('./planche.js');

const SKILL = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (nom) => { const i = args.indexOf(nom); return i < 0 ? null : args.splice(i, 2)[1]; };
const drapeau = (nom) => { const i = args.indexOf(nom); if (i < 0) return false; args.splice(i, 1); return true; };
const optBib = opt('--bibliotheque'), optMoteur = opt('--moteur'), optPw = opt('--playwright');
const video = drapeau('--video'), clore = drapeau('--clore-commentaires');
drapeau('--images'); drapeau('--sans-rendu');                    // anciens noms du mode par défaut
const fichiers = args.flatMap((a) => (fs.existsSync(a) && fs.statSync(a).isDirectory()
  ? fs.readdirSync(a).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(a, f)) : [a]));
if (!fichiers.length) { console.error('Usage : node strip.js <strip.json | dossier> [...] [--video] [--clore-commentaires]'); process.exit(2); }

const premier = (candidats, test, quoi) => {
  const ok = candidats.filter(Boolean).map((c) => path.resolve(c)).find((c) => fs.existsSync(path.join(c, test)));
  if (!ok) { console.error(`Introuvable : ${quoi}. Cherché dans :\n  ${candidats.filter(Boolean).join('\n  ')}`); process.exit(2); }
  return ok;
};
const racines = [process.cwd(), path.resolve(SKILL, '../../..')];
const MOTEUR = premier([optMoteur, process.env.DENTS_MOTEUR,
  ...racines.flatMap((r) => [path.join(r, 'skills/motion-broll/engine'), path.join(r, 'motion-graphics/skills/motion-broll/engine')]),
  path.join(SKILL, '../motion-broll/engine')], 'motion.js', 'le moteur motion.js (option --moteur)');
const PW = premier([optPw, ...racines.flatMap((r) => [path.join(r, 'motion/node_modules'), path.join(r, 'node_modules')])],
  'playwright/package.json', 'playwright (npm install playwright dans ./motion, voir SKILL.md)');

const lire = (f) => fs.readFileSync(f, 'utf8');
const html = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inline = (js) => js.replace(/<\/script/gi, '<\\/script');

// ---------- 1. validation de tous les strips ----------
const strips = fichiers.map((f) => {
  const fichier = path.resolve(f);
  const bib = premier([optBib, path.dirname(fichier), ...racines.map((r) => path.join(r, 'dents-du-cabinet'))], 'dents.js', 'la bibliothèque dents.js (option --bibliotheque)');
  const D = require(path.join(bib, 'dents.js'));
  const aDecors = fs.existsSync(path.join(bib, 'decors.js'));
  const cat = JSON.parse(lire(path.join(bib, 'catalogue.json')));
  const source = JSON.parse(lire(fichier));
  const r = compiler(source, D, cat, { video, decors: aDecors ? require(path.join(bib, 'decors.js')).liste() : ['aucun'] });
  r.avertissements.forEach((a) => console.warn(`[${path.basename(f)}] attention, ${a}`));
  r.erreurs.forEach((e) => console.error(`[${path.basename(f)}] ERREUR, ${e}`));
  return { fichier, bib, aDecors, source, data: r.data, erreurs: r.erreurs };
});
if (strips.some((s) => s.erreurs.length)) { console.error('\nRendu annulé : corrige les JSON ci-dessus.'); process.exit(1); }
const doublon = strips.map((s) => s.data.id).find((id, i, t) => t.indexOf(id) !== i);
if (doublon) { console.error(`Rendu annulé : deux strips portent l'identifiant « ${doublon} ».`); process.exit(1); }

// ---------- 2. images, page animée, vidéo sur demande, page de relecture ----------
(async () => {
  const { chromium } = createRequire(path.join(PW, 'x.js'))('playwright');
  const css = lire(path.join(SKILL, 'runtime/strip.css')).replace('__GEIST__', fs.readFileSync(path.join(MOTEUR, 'fonts/Geist-Variable.woff2')).toString('base64'));
  const navigateur = await chromium.launch();

  for (const s of strips) {
    const { data, source } = s;
    const dossier = path.join(s.bib, 'rendus', data.id);
    fs.mkdirSync(path.join(dossier, 'apercus'), { recursive: true });
    const pageHtml = path.join(dossier, data.id + '.html'), mp4 = path.join(dossier, data.id + '.mp4');
    const pannes = [];
    const moteurs = `<script>${inline(lire(path.join(MOTEUR, 'motion.js')))}</script><script>${inline(lire(path.join(s.bib, 'dents.js')))}</script>` +
      (s.aDecors ? `<script>${inline(lire(path.join(s.bib, 'decors.js')))}</script>` : '');
    const tete = (classe) => `<!doctype html><html lang="fr"${classe}><head><meta charset="utf-8"><title>${html(data.titre)}</title><style>${css}</style></head>`;

    // --- images fixes : la planche (toutes les cases) et les pages du carrousel ---
    const P = miseEnPage(data.cases.length, data.carrousel, { accroche: data.accroche, legende: data.legende });
    const plancheHtml = path.join(dossier, data.id + '-planche.html');
    fs.writeFileSync(plancheHtml, tete(' class="bd"') + `<body class="bd">` + moteurs +
      `<script>window.STRIP=${inline(JSON.stringify(data))};window.PLANCHE=${inline(JSON.stringify(P))};</script>` +
      `<script>${inline(lire(path.join(SKILL, 'runtime/scene.js')))}</script><script>${inline(lire(path.join(SKILL, 'runtime/planche.js')))}</script></body></html>`);
    const pg = await navigateur.newPage({ viewport: { width: P.W, height: P.H }, deviceScaleFactor: 2 });
    pg.on('pageerror', (e) => pannes.push(e.message));
    await pg.goto(pathToFileURL(plancheHtml).href);
    await pg.evaluate(() => window.pret);
    if (pannes.length) { console.error(`[${data.id}] ERREUR dans la planche : ${pannes[0]}`); process.exit(1); }
    const images = { planche: null, carrousel: [] };
    fs.rmSync(path.join(dossier, 'carrousel'), { recursive: true, force: true });
    fs.mkdirSync(path.join(dossier, 'carrousel'));
    for (const p of P.pages) {
      const nom = p.id === 'planche' ? data.id + '-planche.png' : `carrousel/${data.id}-${p.id.slice(1)}.png`;
      await pg.locator('#page-' + p.id).screenshot({ path: path.join(dossier, nom) });
      if (p.id === 'planche') images.planche = nom;
      else images.carrousel.push({ image: nom, cases: p.cellules.map((c) => c.index + 1) });
    }
    await pg.close();

    // --- page animée, et vidéo si demandée ---
    fs.writeFileSync(pageHtml, tete('') + `<body><div id="wrap"><div id="stage"></div></div>` + moteurs +
      `<script>window.STRIP=${inline(JSON.stringify(data))};</script><script>${inline(lire(path.join(SKILL, 'runtime/scene.js')))}</script></body></html>`);
    for (const f of fs.readdirSync(path.join(dossier, 'apercus'))) fs.unlinkSync(path.join(dossier, 'apercus', f));
    if (video) {
      // images de contrôle : fin de chaque plan, plus le milieu de chaque micro animation
      const page = await navigateur.newPage({ viewport: { width: data.W, height: data.H } });
      page.on('pageerror', (e) => pannes.push(e.message));
      await page.goto(pathToFileURL(pageHtml).href + '?render');
      await page.evaluate(() => document.fonts.ready);
      if (pannes.length) { console.error(`[${data.id}] ERREUR dans la page : ${pannes[0]}`); process.exit(1); }
      for (const c of data.cases) {
        const instants = new Set([c.duree - 0.05]);
        source.slides[c.index - 1].personnages.forEach((p) => (p.animations || []).forEach((a) => {
          const m = /[àa]\s+(\d+(?:[.,]\d+)?)\s*s/i.exec(a); if (m) instants.add(Math.min(c.duree - 0.05, parseFloat(m[1].replace(',', '.')) + 0.25));
        }));
        for (const u of [...instants].sort((a, b) => a - b)) {
          await page.evaluate((t) => window.seek(t), c.t0 + u);
          await page.screenshot({ path: path.join(dossier, 'apercus', u === c.duree - 0.05 ? `case${c.index}.png` : `case${c.index}-${u.toFixed(2)}s.png`) });
        }
      }
      await page.close();
      const r = spawnSync(process.execPath, [path.join(MOTEUR, 'render.js'), pageHtml, mp4, String(FPS)],
        { stdio: 'inherit', env: Object.assign({}, process.env, { NODE_PATH: PW }) });
      if (r.status !== 0 || !fs.existsSync(mp4)) { console.error(`[${data.id}] ERREUR : le rendu a échoué`); process.exit(1); }
    }
    // une vidéo rendue avant cette passe ne correspond plus aux images : on ne la propose pas
    const perimee = !video && fs.existsSync(mp4);

    // commentaires traités : on archive pour repartir d'une page vierge
    const com = path.join(dossier, 'commentaires.json');
    if (clore && fs.existsSync(com)) {
      fs.mkdirSync(path.join(dossier, 'historique'), { recursive: true });
      fs.renameSync(com, path.join(dossier, 'historique', `commentaires-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
    }

    const vue = {
      id: data.id, titre: data.titre, serie: data.serie, fond: data.fond, T: data.T, version: Date.now(),
      video: video ? data.id + '.mp4' : null, planche: images.planche, carrousel: images.carrousel,
      accroche: source.accroche || '', legende: source.legende || '', description: source.description || '', source: path.relative(dossier, s.fichier).replace(/\\/g, '/'),
      cases: data.cases.map((c) => {
        const sl = source.slides[c.index - 1];
        return {
          index: c.index, t0: c.t0, duree: c.duree, texte: c.texteBrut, voix: sl.voix || null, decor: c.decor,
          persos: sl.personnages.map((p) => ({ dent: p.dent, expression: p.expression || null, animations: p.animations || [] }))
        };
      })
    };
    fs.writeFileSync(path.join(dossier, 'infos.json'), JSON.stringify(vue, null, 2));
    fs.writeFileSync(path.join(dossier, 'viewer.html'), lire(path.join(SKILL, 'templates/viewer.html')).replace('__DONNEES__', () => inline(JSON.stringify(vue))));
    console.log(`[${data.id}] ${data.cases.length} cases · planche${images.planche ? '' : ' absente (plus de 6 cases)'} · carrousel de ${images.carrousel.length} image(s)` +
      (video ? ' · vidéo ' + data.T + ' s' : perimee ? ' · ancienne vidéo non à jour, relance avec --video' : ''));
  }
  await navigateur.close();
})().catch((e) => { console.error(e); process.exit(1); });
