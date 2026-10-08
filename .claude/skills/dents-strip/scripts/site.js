#!/usr/bin/env node
/*
 * dents-strip : galerie statique des rendus, pour un hébergement sans serveur (Vercel).
 *
 *   node site.js [dossier rendus] [dossier de sortie]
 *
 * Écrit index.html (la vue d'ensemble, avec la visionneuse et le téléchargement) et copie les
 * images de chaque strip. Pas de commentaires ici : ils ont besoin du serveur local commentaires.js.
 * Aucune dépendance, aucun navigateur : les images viennent de git, telles que strip.js les a rendues.
 */
const fs = require('fs');
const path = require('path');

const RENDUS = path.resolve(process.argv[2] || 'dents-du-cabinet/rendus');
const SORTIE = path.resolve(process.argv[3] || 'site');
if (!fs.existsSync(RENDUS)) { console.error('Dossier introuvable : ' + RENDUS); process.exit(2); }

const strips = fs.readdirSync(RENDUS).sort().map((d) => path.join(RENDUS, d, 'infos.json')).filter((f) => fs.existsSync(f))
  .map((f) => Object.assign(JSON.parse(fs.readFileSync(f, 'utf8')), { video: null }));   // les vidéos ne sont pas dans git
if (!strips.length) { console.error('Aucun strip rendu dans ' + RENDUS); process.exit(1); }

fs.rmSync(SORTIE, { recursive: true, force: true });
let images = 0;
const manquantes = [];
strips.forEach((s) => {
  [s.planche].concat((s.carrousel || []).map((p) => p.image)).filter(Boolean).forEach((f) => {
    const source = path.join(RENDUS, s.id, f), cible = path.join(SORTIE, s.id, f);
    if (!fs.existsSync(source)) { manquantes.push(`${s.id}/${f}`); return; }
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.copyFileSync(source, cible);
    images++;
  });
});
if (manquantes.length) { console.error('Images absentes (relance strip.js) :\n  ' + manquantes.join('\n  ')); process.exit(1); }

// même page que le serveur local, en mode statique : pas de champ de commentaire, pas d'appel au serveur
const page = fs.readFileSync(path.join(__dirname, '../templates/index.html'), 'utf8')
  .replace('__DONNEES__', () => JSON.stringify(strips).replace(/<\/script/gi, '<\\/script'))
  .replace('</head>', '<meta name="robots" content="noindex"><script>window.STATIQUE=true</script><style>label,textarea,.detail,.etat{display:none}</style></head>');
fs.writeFileSync(path.join(SORTIE, 'index.html'), page);
console.log(`${strips.length} strips, ${images} images dans ${path.relative(process.cwd(), SORTIE) || '.'}`);
