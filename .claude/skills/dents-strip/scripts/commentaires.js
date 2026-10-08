#!/usr/bin/env node
/*
 * dents-strip : petit serveur local pour relire les rendus et enregistrer les commentaires.
 *   node commentaires.js <dossier rendus> [port]
 * Sert le dossier en lecture seule, écrit <id>/commentaires.json à chaque modification dans viewer.html,
 * et tient publications.json (à côté du dossier des rendus) : quels strips sont déjà publiés, et quand.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(process.argv[2] || 'dents-du-cabinet/rendus');
const PORT = +process.argv[3] || 4173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
if (!fs.existsSync(RACINE)) { console.error('Dossier introuvable : ' + RACINE); process.exit(2); }

const PUBLICATIONS = path.join(RACINE, '..', 'publications.json');
const publies = () => { try { return JSON.parse(fs.readFileSync(PUBLICATIONS, 'utf8')); } catch (e) { return {}; } };

const fin = (res, code, corps, type) => { res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(corps); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const api = /^\/api\/commentaires\/([\w.-]+)$/.exec(url.pathname);
  if (api) {
    const dossier = path.join(RACINE, api[1]), fichier = path.join(dossier, 'commentaires.json');
    if (api[1].startsWith('.') || !fs.existsSync(dossier)) return fin(res, 404, 'strip inconnu');
    if (req.method === 'GET') return fs.existsSync(fichier) ? fin(res, 200, fs.readFileSync(fichier), TYPES['.json']) : fin(res, 404, 'aucun commentaire');
    if (req.method === 'PUT') {
      let corps = '';
      req.on('data', (d) => { corps += d; if (corps.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try { JSON.parse(corps); } catch (e) { return fin(res, 400, 'JSON invalide'); }
        fs.writeFileSync(fichier, corps);
        fin(res, 200, 'ok');
      });
      return;
    }
    return fin(res, 405, 'méthode refusée');
  }
  if (url.pathname === '/api/publications') {
    if (req.method === 'GET') return fin(res, 200, JSON.stringify(publies()), TYPES['.json']);
    if (req.method !== 'PUT') return fin(res, 405, 'méthode refusée');
    let corps = '';
    req.on('data', (d) => { corps += d; if (corps.length > 1e4) req.destroy(); });
    req.on('end', () => {
      let m;
      try { m = JSON.parse(corps); } catch (e) { return fin(res, 400, 'JSON invalide'); }
      if (!/^[\w.-]+$/.test(m.id || '') || !fs.existsSync(path.join(RACINE, m.id, 'infos.json'))) return fin(res, 404, 'strip inconnu');
      if (m.date != null && !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) return fin(res, 400, 'date attendue : AAAA-MM-JJ');
      const p = publies();
      if (m.date) p[m.id] = m.date; else delete p[m.id];
      const trie = Object.fromEntries(Object.keys(p).sort().map((k) => [k, p[k]]));
      fs.writeFileSync(PUBLICATIONS, JSON.stringify(trie, null, 2) + '\n');
      fin(res, 200, JSON.stringify(trie), TYPES['.json']);
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return fin(res, 405, 'méthode refusée');

  if (url.pathname === '/') {
    // vue d'ensemble : tous les strips rendus, avec un commentaire général par strip
    const strips = fs.readdirSync(RACINE).sort().map((d) => path.join(RACINE, d, 'infos.json')).filter((f) => fs.existsSync(f)).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
    const page = fs.readFileSync(path.join(__dirname, '../templates/index.html'), 'utf8');
    return fin(res, 200, page.replace('__DONNEES__', () => JSON.stringify(strips).replace(/<\/script/gi, '<\\/script'))
      .replace('__PUBLICATIONS__', () => JSON.stringify(publies()).replace(/</g, '\\u003c')), TYPES['.html']);
  }
  const fichier = path.join(RACINE, decodeURIComponent(url.pathname));
  if (!fichier.startsWith(RACINE + path.sep) || !fs.existsSync(fichier) || !fs.statSync(fichier).isFile()) return fin(res, 404, 'introuvable');
  const taille = fs.statSync(fichier).size, type = TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream';
  const plage = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (plage && (plage[1] || plage[2])) {               // les vidéos se lisent par morceaux
    const a = plage[1] ? +plage[1] : Math.max(0, taille - +plage[2]);
    const b = plage[1] && plage[2] ? Math.min(+plage[2], taille - 1) : taille - 1;
    if (a > b || a >= taille) { res.writeHead(416, { 'Content-Range': `bytes */${taille}` }); return res.end(); }
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${taille}`, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    return fs.createReadStream(fichier, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': taille, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(fichier).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Relecture : http://localhost:${PORT}/  (dossier ${RACINE})`));
