/*
 * dents-strip : mise en page des images fixes, au format 4:5 du fil Instagram (1080 x 1350).
 * Une page porte 1 à 6 cases. La planche les porte toutes, le carrousel les répartit page par page.
 * Chaque case reçoit son propre cadrage selon sa forme : mêmes règles que le reel.
 */
const PAGE = { W: 1080, H: 1350, marge: 28, gouttiere: 18, bord: 7, pied: 40 };
const SIGNATURE = 'Les Dents du Cabinet';
const RANGS = { 1: [1], 2: [1, 1], 3: [2, 1], 4: [2, 2], 5: [2, 2, 1], 6: [2, 2, 2] };   // cases par rang
const MAX_CASES = 6, MAX_PAR_PAGE = 4;
const BANDES = { accroche: 196, question: 124, ecart: 18 };   // hauteur des textes hors case, et leur écart aux cases
const PLUS_GRAND = 232;                         // hauteur du plus grand personnage, en unités de la bibliothèque

/* Cadrage d'une case de l x h pixels sur la page. La scène travaille dans un repère plus grand,
   d'au moins 1080 de large, puis elle est réduite : le texte reste net et les règles restent les mêmes. */
function cadrage(l, h) {
  const forme = l / h;
  const W = Math.round(Math.max(1080, 1000 * forme)), H = Math.round(W / forme);
  const SOL_Y = Math.round(H * 0.925);
  const hTexte = Math.round(Math.min(280, Math.max(170, 0.21 * H)));
  const sH = (SOL_Y - (44 + hTexte + 60 + 70)) / PLUS_GRAND;       // ce qui reste sous la bulle et sa queue
  const s = (max) => +Math.min(max, sH).toFixed(2);
  const s2 = s(3.3), s3 = s(2.8);
  const d2 = Math.max(0.17, 0.23 * s2 / 3.3) * 1080 / W, d3 = Math.max(0.24, 0.32 * s3 / 2.8) * 1080 / W;   // écart constant entre voisins
  return {
    W, H, SOL_Y, sol: SOL_Y - Math.round(0.05 * H), echelle: l / W,
    CADRE: { 1: { s: s(3.6), x: [0.5] }, 2: { s: s2, x: [0.5 - d2, 0.5 + d2] }, 3: { s: s3, x: [0.5 - d3, 0.5, 0.5 + d3] } },
    TEXTE: { haut: 40, hauteur: hTexte, ecart: 90, marge: 60, largeur: 960, max: 120, min: 48, cartouche: true, padX: 36, padY: 24, rayon: 10 },
    BULLE: { haut: 40, marge: 36, padX: 46, padY: 30, rayon: 50, queue: 28, ecart: 70, hauteur: hTexte, largeur: 900, largeurMin: 220, max: 140 }
  };
}

/* Une page : les cases d'indices donnés, rangées selon RANGS.
   bandes : textes hors case, l'accroche au-dessus des cases et la question en dessous. */
function page(id, indices, bandes) {
  bandes = bandes || {};
  const rangs = RANGS[indices.length];
  const hTete = bandes.accroche ? BANDES.accroche : 0, hQueue = bandes.question ? BANDES.question : 0;
  const haut = PAGE.marge + (hTete ? hTete + BANDES.ecart : 0);
  const zoneH = PAGE.H - haut - PAGE.pied - 20 - (hQueue ? hQueue + BANDES.ecart : 0), zoneL = PAGE.W - 2 * PAGE.marge;
  const h = Math.floor((zoneH - (rangs.length - 1) * PAGE.gouttiere) / rangs.length);
  const cellules = [];
  let k = 0;
  rangs.forEach((nb, r) => {
    const l = (zoneL - (nb - 1) * PAGE.gouttiere) / nb;
    for (let i = 0; i < nb; i++) {
      cellules.push({ index: indices[k++], x: PAGE.marge + i * (l + PAGE.gouttiere), y: haut + r * (h + PAGE.gouttiere), l, h, cadrage: cadrage(l - 2 * PAGE.bord, h - 2 * PAGE.bord) });
    }
  });
  const p = { id, cellules };
  if (hTete) p.accroche = { texte: bandes.accroche, x: PAGE.marge, y: PAGE.marge, l: zoneL, h: hTete };
  if (hQueue) p.question = { texte: bandes.question, x: PAGE.marge, y: haut + zoneH + BANDES.ecart, l: zoneL, h: hQueue };
  return p;
}

/* groupes : tailles des pages du carrousel, par exemple [1, 2, 1].
   textes : { accroche, legende }. L'accroche coiffe la première image du carrousel, la légende
   ferme la dernière. La planche, elle, ne porte que ses cases. */
function miseEnPage(nbCases, groupes, textes) {
  textes = textes || {};
  const pages = [];
  const tous = Array.from({ length: nbCases }, (_, i) => i);
  if (nbCases <= MAX_CASES) pages.push(page('planche', tous));
  let debut = 0;
  groupes.forEach((taille, i) => {
    pages.push(page('c' + (i + 1), tous.slice(debut, debut + taille), {
      accroche: i === 0 ? textes.accroche : '', question: i === groupes.length - 1 ? textes.legende : ''
    }));
    debut += taille;
  });
  return Object.assign({ pages, signature: SIGNATURE, piedY: PAGE.H - PAGE.pied - 14 }, PAGE);
}

module.exports = { miseEnPage, MAX_CASES, MAX_PAR_PAGE };
