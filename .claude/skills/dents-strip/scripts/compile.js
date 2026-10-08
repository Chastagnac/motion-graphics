/*
 * dents-strip : validation et compilation d'un strip.
 * Entrée : le JSON d'un strip + la bibliothèque (dents.js, catalogue.json).
 * Sortie : { erreurs, avertissements, data } où data ne contient plus que des clés temporelles
 * prêtes à dessiner. Rien n'est inventé : toute valeur absente de catalogue.json est une erreur.
 */
const W = 1080, H = 1920, FPS = 30;
const TOTAL_MIN = 8, TOTAL_MAX = 12;
const FONDS = { strip: '#A8E0D2', vecu: '#FFB3A7', irritant: '#B9C8FF', fiche: '#FFC9E3', quiz: '#FFD84D' };
const ENTREES = ['ressort', 'saut', 'aucune'];
const CLIGNEMENT = { yeux: 'plisses', duree: 0.12 };
const GORGEE = { objet: 'cafe', bras: 'croise', duree: 0.65, inclinaison: 14 };
const VIBRE = { duree: 0.8 };
const DECOR_DEFAUT = 'cabinet';                  // le fond commun à toutes les histoires
const PAROLE = 'ouverte';                       // bouche du catalogue montrée à chaque mot prononcé

// Mots interdits dans tout texte affiché ou publié (titre, répliques, légende).
const INTERDITS = /(?<![\p{L}\p{N}])(logiciels?|applications?|applis?|ia|i\.a\.?|automati\p{L}*)(?![\p{L}\p{N}])/giu;
const TIRETS = /[—―]/;

const sansAccent = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const liste = (a) => a.join(', ');

/* Découpe la réplique en mots affichables : « et » restent collés au mot voisin. */
function mots(texte) {
  const brut = String(texte).replace(/'/g, '’').trim().split(/\s+/).filter(Boolean);
  const out = [];
  let prefixe = '';
  brut.forEach((m) => {
    if (/^[«(]+$/.test(m)) { prefixe += m + ' '; return; }
    if (/^[»)!?;:.,…]+$/.test(m) && out.length) { out[out.length - 1] += ' ' + m; return; }
    out.push(prefixe + m); prefixe = '';
  });
  if (prefixe && out.length) out[out.length - 1] += ' ' + prefixe.trim();
  return out;
}

/* « sourcil:leve à 1.2s », « prop:cafe:gorgee à 2s », « effet:choc à 0.4s pendant 1s » */
function lireAnimation(s) {
  const m = /^\s*(\S.*?)\s+[àa]\s+(\d+(?:[.,]\d+)?)\s*s(?:\s+pendant\s+(\d+(?:[.,]\d+)?)\s*s)?\s*$/i.exec(String(s));
  if (!m) return null;
  const num = (x) => (x == null ? null : parseFloat(x.replace(',', '.')));
  return { parts: m[1].split(':').map((x) => x.trim()), t: num(m[2]), pendant: num(m[3]) };
}

function compiler(strip, D, cat, opts) {
  opts = opts || {};
  const decors = opts.decors || ['aucun'];
  const erreurs = [], avertissements = [];
  const err = (ou, msg) => erreurs.push(`${ou} : ${msg}`);
  const avert = (ou, msg) => avertissements.push(`${ou} : ${msg}`);
  const absent = (ou, champ, v, permis) => err(ou, `${champ} « ${v} » n'existe pas dans catalogue.json (valeurs : ${liste(permis)})`);

  const personnagesConnus = cat.dents.concat(cat.humains);
  const CHAMPS = {
    expression: cat.expressions, sourcils: cat.sourcils, yeux: cat.yeux, bouche: cat.bouches,
    brasG: cat.bras, brasD: cat.bras, propG: cat.objets, propD: cat.objets, jambes: cat.jambes, masque: cat.masques
  };
  const NULL_PERMIS = ['propG', 'propD', 'masque', 'brasG', 'brasD'];

  // --- textes ---
  const verifierTexte = (ou, t) => {
    if (t == null) return;
    const trouve = String(t).match(INTERDITS);
    if (trouve) err(ou, `mot interdit (${liste([...new Set(trouve.map((x) => x.toLowerCase()))])})`);
    if (TIRETS.test(t)) err(ou, 'tiret cadratin interdit dans les textes affichés');
  };
  verifierTexte('titre', strip.titre);
  verifierTexte('accroche', strip.accroche);
  verifierTexte('legende', strip.legende);

  // --- série et fond ---
  const serie = sansAccent(strip.serie || '');
  if (!FONDS[serie]) err('serie', `« ${strip.serie} » inconnue (séries : ${liste(Object.keys(FONDS))})`);
  if (!strip.id || !/^[\w.-]+$/.test(strip.id)) err('id', 'identifiant manquant ou invalide (lettres, chiffres, tirets)');
  if (!Array.isArray(strip.slides) || !strip.slides.length) { err('slides', 'aucune case'); return { erreurs, avertissements, data: null }; }

  const verifierPose = (ou, pose) => {
    Object.keys(CHAMPS).forEach((k) => {
      if (!(k in pose)) return;
      const v = pose[k];
      if (v === null && NULL_PERMIS.includes(k)) return;
      if (!CHAMPS[k].includes(v)) absent(ou, k, v, CHAMPS[k]);
    });
    if ('effets' in pose) {
      if (!Array.isArray(pose.effets)) err(ou, 'effets doit être une liste');
      else pose.effets.forEach((e) => { if (!cat.effets.includes(e)) absent(ou, 'effet', e, cat.effets); });
    }
  };
  const CLES = ['dent', 'effets', 'depart', 'entree', 'animations', 'place'].concat(Object.keys(CHAMPS));

  let t0 = 0, precedents = [];
  const cases = strip.slides.map((slide, i) => {
    const ouCase = `case ${i + 1}`;
    Object.keys(slide).forEach((k) => { if (!['texte', 'duree', 'personnages', 'voix', 'places', 'decor', 'plan'].includes(k)) err(ouCase, `champ inconnu « ${k} »`); });
    const decor = slide.decor || strip.decor || DECOR_DEFAUT;
    if (!decors.includes(decor)) err(ouCase, `decor « ${decor} » n'existe pas dans decors.js (valeurs : ${liste(decors)})`);
    if (slide.plan != null && slide.plan !== 'drame') err(ouCase, `plan « ${slide.plan} » inconnu (valeur possible : drame)`);
    verifierTexte(`${ouCase}, texte`, slide.texte);
    // durée du plan vidéo : celle du JSON, sinon calculée sur la longueur de la réplique
    const duree = slide.duree;
    if (duree != null && (typeof duree !== 'number' || !(duree >= 1 && duree <= 6))) err(ouCase, `duree hors bornes (1 à 6 s), reçu : ${JSON.stringify(duree)}`);
    const d = typeof duree === 'number' ? duree : Math.min(3.2, Math.max(1.8, +(1.5 + 0.2 * mots(slide.texte || '').length + (i ? 0 : 0.3)).toFixed(1)));

    // qui parle (bulle) et où se tient chacun
    const distribution = slide.personnages || [];
    const noms = distribution.map((p) => p.dent);
    if (noms.length < 1 || noms.length > 3) err(ouCase, 'il faut 1 à 3 personnages');
    let voix = null;
    if (slide.voix != null) {
      voix = noms.indexOf(slide.voix);
      if (voix < 0) { err(ouCase, `voix « ${slide.voix} » : ce personnage n'est pas dans la case (${liste(noms)})`); voix = null; }
    }
    const places = slide.places == null ? Math.max(1, noms.length, ...distribution.map((p) => (Number.isInteger(p.place) ? p.place : 0))) : slide.places;
    if (![1, 2, 3].includes(places) || places < noms.length) err(ouCase, `places doit valoir 1, 2 ou 3 et suffire pour ${noms.length} personnage(s)`);
    const prises = new Set();
    const placeDe = distribution.map((p) => {
      if (p.place == null) return null;
      if (!Number.isInteger(p.place) || p.place < 1 || p.place > places) { err(ouCase, `place ${JSON.stringify(p.place)} invalide pour ${p.dent} (1 à ${places})`); return null; }
      if (prises.has(p.place)) err(ouCase, `place ${p.place} occupée deux fois`);
      prises.add(p.place);
      return p.place - 1;
    });
    placeDe.forEach((v, j) => { if (v != null) return; let k = 1; while (prises.has(k)) k++; prises.add(k); placeDe[j] = k - 1; });
    let entrants = 0;

    const persos = distribution.map((perso, j) => {
      const ou = `${ouCase}, personnage ${j + 1}${perso.dent ? ' (' + perso.dent + ')' : ''}`;
      const n0 = erreurs.length;
      if (!personnagesConnus.includes(perso.dent)) { absent(ou, 'dent', perso.dent, personnagesConnus); return null; }
      Object.keys(perso).forEach((k) => { if (!CLES.includes(k)) err(ou, `champ inconnu « ${k} »`); });
      verifierPose(ou, perso);
      const depart = perso.depart || {};
      Object.keys(depart).forEach((k) => { if (!(k in CHAMPS) && k !== 'effets') err(`${ou}, depart`, `champ inconnu « ${k} »`); });
      verifierPose(`${ou}, depart`, depart);
      if (perso.entree != null && !ENTREES.includes(perso.entree)) err(ou, `entree « ${perso.entree} » inconnue (${liste(ENTREES)})`);
      if (erreurs.length > n0) return null;

      // pose de départ = pose clé (comme renderTooth la résout) + surcharges « depart »
      const cle = Object.assign({ jambes: 'debout' }, D.BODIES[perso.dent].defaut, perso);
      const debut = Object.assign({}, cle, depart);
      const visage = (p) => {
        const ex = D.EXPRESSIONS[p.expression] || {};
        return { sourcils: p.sourcils || ex.sourcils || 'neutre', yeux: p.yeux || ex.yeux || 'points', bouche: p.bouche || ex.bouche || 'neutre', effets: ex.effets || [] };
      };
      const v0 = visage(debut);
      const cur = { sourcils: v0.sourcils, yeux: v0.yeux, bouche: v0.bouche, brasG: debut.brasG || null, brasD: debut.brasD || null, jambes: debut.jambes };
      const pose = Object.assign({ propG: debut.propG || null, propD: debut.propD || null, masque: debut.masque || null }, cur);
      const ch = { sourcils: [], yeux: [], bouche: [], brasG: [], brasD: [], jambes: [] };
      const fx = {}, vib = { G: [], D: [] }, incl = { G: [], D: [] }, sursauts = [];
      const fixes = debut.effets || [];
      let exEffets = v0.effets.slice();
      const effet = (nom, t, on) => { (fx[nom] = fx[nom] || []).push([t, on ? 1 : 0]); };
      [...new Set(fixes.concat(exEffets))].forEach((e) => effet(e, 0, true));
      const coteDe = (objet) => (pose.propD === objet && cur.brasD ? 'D' : pose.propG === objet && cur.brasG ? 'G' : null);

      // file d'événements : les « pendant » y ajoutent leur retour à l'état précédent
      const file = [];
      (perso.animations || []).forEach((src) => {
        const a = lireAnimation(src);
        if (!a) { err(ou, `animation illisible « ${src} » (format : « cible:valeur à 1.2s », option « pendant 0.5s »)`); return; }
        if (a.t >= d) { err(ou, `animation « ${src} » après la fin de la case (${d} s)`); return; }
        file.push(Object.assign(a, { src }));
      });
      const regle = (canal, v, t, pendant) => {
        const avant = cur[canal];
        cur[canal] = v; ch[canal].push([t, v]);
        if (pendant) file.push({ interne: 'regle', canal, v: avant, t: t + pendant });
      };
      while (file.length) {
        file.sort((a, b) => a.t - b.t);
        const a = file.shift();
        if (a.interne === 'regle') { regle(a.canal, a.v, a.t); continue; }
        if (a.interne === 'effet') { effet(a.nom, a.t, a.on); continue; }
        if (a.interne === 'exEffets') { exEffets = a.v; continue; }
        const [cible, val, variante] = a.parts;
        const ouA = `${ou}, « ${a.src} »`;
        const canal = { sourcil: 'sourcils', sourcils: 'sourcils', yeux: 'yeux', bouche: 'bouche', brasG: 'brasG', brasD: 'brasD', jambes: 'jambes' }[cible];
        if (canal) {
          if (!CHAMPS[canal].includes(val)) { absent(ouA, canal, val, CHAMPS[canal]); continue; }
          if ((canal === 'brasG' || canal === 'brasD') && !cur[canal]) { err(ouA, 'ce bras est absent de la pose'); continue; }
          regle(canal, val, a.t, a.pendant);
        } else if (cible === 'expression') {
          if (!cat.expressions.includes(val)) { absent(ouA, 'expression', val, cat.expressions); continue; }
          const v = visage({ expression: val });
          const anciens = exEffets.slice();
          ['sourcils', 'yeux', 'bouche'].forEach((c) => regle(c, v[c], a.t, a.pendant));
          anciens.filter((e) => !v.effets.includes(e) && !fixes.includes(e)).forEach((e) => effet(e, a.t, false));
          v.effets.forEach((e) => effet(e, a.t, true));
          exEffets = v.effets.slice();
          if (a.pendant) {
            v.effets.filter((e) => !anciens.includes(e) && !fixes.includes(e)).forEach((e) => file.push({ interne: 'effet', nom: e, on: false, t: a.t + a.pendant }));
            anciens.forEach((e) => file.push({ interne: 'effet', nom: e, on: true, t: a.t + a.pendant }));
            file.push({ interne: 'exEffets', v: anciens, t: a.t + a.pendant });
          }
        } else if (cible === 'clignement') {
          if (cur.yeux === CLIGNEMENT.yeux) avert(ouA, `les yeux sont déjà « ${CLIGNEMENT.yeux} », le clignement ne se verra pas`);
          regle('yeux', CLIGNEMENT.yeux, a.t, a.pendant || CLIGNEMENT.duree);
        } else if (cible === 'effet') {
          if (!cat.effets.includes(val)) { absent(ouA, 'effet', val, cat.effets); continue; }
          effet(val, a.t, true);
          if (a.pendant) file.push({ interne: 'effet', nom: val, on: false, t: a.t + a.pendant });
        } else if (cible === 'sursaut') {
          sursauts.push(a.t);
        } else if (cible === 'prop') {
          if (!cat.objets.includes(val)) { absent(ouA, 'objet', val, cat.objets); continue; }
          const cote = coteDe(val);
          if (!cote) { err(ouA, `le personnage ne tient pas « ${val} » dans cette case`); continue; }
          if (variante === 'gorgee') {
            if (val !== GORGEE.objet) { err(ouA, `gorgee n'existe que pour « ${GORGEE.objet} »`); continue; }
            if (D.BODIES[perso.dent].type === 'humain') { err(ouA, `aucune pose de bras du catalogue n'amène la tasse à la bouche d'un dentiste. Pour lever la tasse : « bras${cote}:salut »`); continue; }
            const p = a.pendant || GORGEE.duree;
            regle('bras' + cote, GORGEE.bras, a.t, p);
            incl[cote].push([a.t, (cote === 'D' ? -1 : 1) * GORGEE.inclinaison], [a.t + p, 0]);
          } else if (variante === 'vibre') {
            vib[cote].push([a.t, a.pendant || VIBRE.duree]);
          } else err(ouA, `micro animation d'objet « ${variante} » inconnue (gorgee, vibre)`);
        } else {
          err(ouA, `cible « ${cible} » inconnue (sourcil, yeux, bouche, expression, clignement, brasG, brasD, jambes, effet, sursaut, prop)`);
        }
      }
      // nouveau venu : ressort. Déjà là : petit saut, réservé à celui qui parle quand il y a une bulle.
      const entree = perso.entree || (!precedents.includes(perso.dent) ? 'ressort' : voix == null || voix === j ? 'saut' : 'aucune');
      const retard = entree === 'ressort' ? +(0.12 * entrants++).toFixed(2) : 0;
      return { dent: perso.dent, place: placeDe[j], pose, ch, fx, vib, incl, sursauts, entree, retard };
    });

    // texte mot par mot
    const liste_mots = mots(slide.texte || '');
    const parleur = voix != null ? persos[voix] : null;
    const debutTexte = parleur ? (parleur.entree === 'ressort' ? 0.42 + parleur.retard : 0.16) : persos.some((p) => p && p.entree === 'ressort') ? 0.35 : 0.12;
    const pas = Math.min(0.22, Math.max(0.07, (d * 0.5 - debutTexte) / Math.max(1, liste_mots.length - 1)));
    const texte = liste_mots.map((m, k) => ({ m, t: +(debutTexte + k * pas).toFixed(3) }));
    if (texte.length && texte[texte.length - 1].t > d - 0.7) avert(ouCase, 'réplique longue pour cette durée, le dernier mot reste moins de 0,7 s à l\'écran');

    // celui qui parle ouvre la bouche à chaque mot : remplacement du calque bouche, comme toute expression
    if (parleur && parleur.pose.masque !== 'haut') {
      const base = parleur.ch.bouche.slice();
      const boucheA = (t) => base.reduce((v, k) => (t >= k[0] ? k[1] : v), parleur.pose.bouche);
      const ouvert = Math.min(0.1, pas * 0.5);
      const fenetres = texte.filter((w) => boucheA(w.t) !== PAROLE).map((w) => [w.t, +(w.t + ouvert).toFixed(3)]);
      parleur.ch.bouche = base.filter((k) => !fenetres.some(([a, b]) => k[0] >= a && k[0] < b))
        .concat(fenetres.flatMap(([a, b]) => [[a, PAROLE], [b, boucheA(b)]]))
        .sort((x, y) => x[0] - y[0]);
    }

    const c = { index: i + 1, t0: +t0.toFixed(3), duree: d, texteBrut: slide.texte || '', texte, persos, places, voix, decor, plan: slide.plan || null, tBulle: +Math.max(0, debutTexte - 0.12).toFixed(3) };
    t0 += d;
    precedents = (slide.personnages || []).map((p) => p.dent);
    return c;
  });

  const total = +t0.toFixed(3);
  if (opts.video && (total < TOTAL_MIN || total > TOTAL_MAX)) err('durée totale', `${total} s, attendu entre ${TOTAL_MIN} et ${TOTAL_MAX} s pour une vidéo`);

  // carrousel : nombre de cases par image, 1 à 4. Sans indication, une case par image.
  let carrousel = strip.carrousel;
  if (carrousel == null) carrousel = cases.map(() => 1);
  else if (!Array.isArray(carrousel) || carrousel.some((v) => !Number.isInteger(v) || v < 1 || v > 4)) err('carrousel', 'liste de nombres de cases par image, chacun entre 1 et 4, par exemple [1, 2, 1]');
  else if (carrousel.reduce((a, b) => a + b, 0) !== cases.length) err('carrousel', `la somme (${carrousel.reduce((a, b) => a + b, 0)}) doit égaler le nombre de cases (${cases.length})`);

  if (erreurs.length) return { erreurs, avertissements, data: null };
  return { erreurs, avertissements, data: { id: strip.id, titre: strip.titre || '', accroche: strip.accroche || '', legende: strip.legende || '', serie, fond: FONDS[serie], W, H, fps: FPS, T: total, carrousel, cases } };
}

module.exports = { compiler, lireAnimation, mots, FONDS, W, H, FPS };
