/*
 * Les Dents du Cabinet : décors. Aucune dépendance, Node et navigateur, comme dents.js.
 *
 * Un décor est un fond ton sur ton : des aplats sans contour, dans des nuances de la couleur de
 * la série, pour que le trait noir des personnages reste seul au premier plan.
 * Decors.rendre(nom, { W, H, sol, u, fond }) renvoie une chaîne SVG de W x H.
 *   sol  : y de la jonction entre le mur et le sol
 *   u    : pixels par unité de personnage (un dentiste mesure 232 unités), les meubles suivent
 *   fond : couleur de la série, en #RRGGBB
 */
(function (root) {
  const ENCRE = '#141413', BLANC = '#FFFFFF';
  const rvb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mel = (a, b, k) => '#' + rvb(a).map((v, i) => Math.round(v + (rvb(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
  const tons = (fond) => ({ sol: mel(fond, ENCRE, 0.1), meuble: mel(fond, ENCRE, 0.16), ombre: mel(fond, ENCRE, 0.25), clair: mel(fond, BLANC, 0.45), lumiere: mel(fond, BLANC, 0.78) });
  const n = (v) => +v.toFixed(1);

  /* Petits outils de dessin : tout est exprimé en unités u au-dessus du sol. */
  function outils(o) {
    const { W, H, sol, u } = o;
    const y = (h) => sol - h * u;                                     // hauteur h au-dessus de la jonction mur/sol
    const R = (x, h, l, ep, c, r, rot) => `<rect x="${n(x)}" y="${n(y(h))}" width="${n(l)}" height="${n(ep * u)}" rx="${n((r || 0) * u)}" fill="${c}"${rot ? ` transform="rotate(${rot[0]} ${n(rot[1])} ${n(y(rot[2]))})"` : ''}/>`;
    const P = (pts, c) => `<path d="M${pts.map(([x, h]) => n(x) + ' ' + n(y(h))).join(' L')} Z" fill="${c}"/>`;
    const C = (x, h, r, c) => `<circle cx="${n(x)}" cy="${n(y(h))}" r="${n(r * u)}" fill="${c}"/>`;
    return { W, H, u, y, R, P, C };
  }
  const piece = (o, t) => `<rect x="0" y="${n(o.sol)}" width="${o.W}" height="${n(o.H - o.sol)}" fill="${t.sol}"/>` +
    `<rect x="0" y="${n(o.sol - 5 * o.u)}" width="${o.W}" height="${n(5 * o.u)}" fill="${t.meuble}"/>`;

  const DECORS = {
    aucun: { nom: 'Aucun', dessin: () => '' },
    sol: { nom: 'Mur et sol', dessin: (o, t) => piece(o, t) },

    /* Salle de soins : meuble bas à gauche, fauteuil et scialytique au centre. */
    cabinet: {
      nom: 'La salle de soins',
      dessin: (o, t) => {
        const { W, u, R, P, C } = outils(o);
        const m = 0.3 * W;                                             // largeur du meuble bas
        const f = 0.55 * W;                                            // pied du fauteuil
        return piece(o, t) +
          // meuble bas, plan de travail, portes, robinet
          R(0, 82, m, 82, t.meuble) + R(0, 90, m + 6 * u, 8, t.ombre, 2) +
          R(m * 0.33, 70, 2.5 * u, 58, t.ombre) + R(m * 0.66, 70, 2.5 * u, 58, t.ombre) +
          R(m * 0.5, 112, 4 * u, 22, t.ombre, 2) + R(m * 0.5, 112, 20 * u, 4, t.ombre, 2) +
          // scialytique : colonne, bras, tête lumineuse
          R(f + 66 * u, 196, 5 * u, 196, t.meuble) + R(f - 6 * u, 196, 77 * u, 5, t.meuble, 2) +
          R(f - 34 * u, 190, 44 * u, 15, t.lumiere, 7, [-12, f - 12 * u, 183]) +
          // fauteuil : socle, colonne, repose-jambes, assise, dossier, têtière
          R(f - 30 * u, 8, 60 * u, 8, t.ombre, 3) + R(f - 8 * u, 40, 16 * u, 34, t.ombre) +
          R(f - 78 * u, 54, 44 * u, 12, t.clair, 6, [28, f - 34 * u, 48]) +
          R(f - 40 * u, 54, 62 * u, 14, t.clair, 6) +
          R(f + 14 * u, 56, 78 * u, 14, t.clair, 7, [-58, f + 18 * u, 49]) +
          C(f + 62 * u, 126, 11, t.clair) +
          P([[f - 30 * u, 40], [f + 30 * u, 40], [f + 24 * u, 34], [f - 24 * u, 34]], t.ombre);
      }
    },

    /* Accueil : banque d'accueil et écran à droite, plante et cadre à gauche. */
    accueil: {
      nom: "L'accueil",
      dessin: (o, t) => {
        const { W, u, R, P, C } = outils(o);
        const b = 0.44 * W, p = 0.085 * W;
        return piece(o, t) +
          // cadre au mur
          R(p - 20 * u, 196, 46 * u, 56, t.ombre, 2) + R(p - 15 * u, 191, 36 * u, 46, t.lumiere, 1) +
          // plante
          P([[p - 13 * u, 30], [p + 13 * u, 30], [p + 9 * u, 0], [p - 9 * u, 0]], t.ombre) +
          [[-16, 62, -28], [0, 76, 0], [16, 64, 26], [-9, 92, -12], [10, 96, 14]].map(([dx, h, a]) =>
            `<ellipse cx="${n(p + dx * u)}" cy="${n(o.sol - h * u)}" rx="${n(9 * u)}" ry="${n(24 * u)}" fill="${t.meuble}" transform="rotate(${a} ${n(p + dx * u)} ${n(o.sol - h * u)})"/>`).join('') +
          // banque d'accueil, plateau, panneau clair
          R(b, 92, W - b, 92, t.meuble) + R(b - 8 * u, 101, W - b + 8 * u, 9, t.ombre, 2) +
          R(b + 18 * u, 74, W - b - 36 * u, 52, t.clair, 4) +
          // écran sur la banque
          R(W - 64 * u, 148, 46 * u, 32, t.ombre, 3) + R(W - 45 * u, 116, 8 * u, 15, t.ombre) + C(W - 41 * u, 132, 0, t.ombre);
      }
    },

    /* Hors du cabinet : une table, deux verres, une suspension. */
    soiree: {
      nom: 'La soirée',
      dessin: (o, t) => {
        const { W, u, R, P, C } = outils(o);
        const c = W / 2;
        return piece(o, t) +
          `<rect x="${n(c - 1.5 * u)}" y="0" width="${n(3 * u)}" height="${n(o.sol - 236 * u)}" fill="${t.ombre}"/>` +
          P([[c - 26 * u, 236], [c + 26 * u, 236], [c + 40 * u, 208], [c - 40 * u, 208]], t.ombre) + C(c, 206, 9, t.lumiere) +
          R(c - 74 * u, 70, 148 * u, 9, t.ombre, 3) + R(c - 58 * u, 61, 7 * u, 61, t.meuble) + R(c + 51 * u, 61, 7 * u, 61, t.meuble) +
          [-24, 24].map((dx) => R(c + dx * u - 6 * u, 94, 12 * u, 14, t.lumiere, 4) + R(c + dx * u - 1 * u, 80, 2 * u, 10, t.lumiere) + R(c + dx * u - 6 * u, 72, 12 * u, 2.5, t.lumiere, 1)).join('') +
          R(c - 4 * u, 104, 8 * u, 34, t.meuble, 3);
      }
    }
  };

  function rendre(nom, o) {
    const d = DECORS[nom];
    if (!d) throw new Error('Décor inconnu : ' + nom);
    return `<svg xmlns="http://www.w3.org/2000/svg" class="decor" width="${o.W}" height="${o.H}" viewBox="0 0 ${o.W} ${o.H}">${d.dessin(o, tons(o.fond))}</svg>`;
  }

  const API = { rendre, DECORS, liste: () => Object.keys(DECORS) };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Decors = API;
})(typeof window !== 'undefined' ? window : globalThis);
