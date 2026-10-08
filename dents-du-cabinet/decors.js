/*
 * Les Dents du Cabinet : décors. Aucune dépendance, Node et navigateur, comme dents.js.
 *
 * Un décor est un fond ton sur ton : des aplats sans contour, dans des nuances de la couleur de
 * la série, pour que le trait noir des personnages reste seul au premier plan.
 * Decors.rendre(nom, { W, H, sol, u, fond }) renvoie une chaîne SVG de W x H.
 *   sol  : y de la jonction entre le mur et le sol
 *   u    : pixels par unité de personnage (un dentiste mesure 232 unités), les meubles suivent
 *   fond : couleur de la série, en #RRGGBB
 *   pieds, piedY : facultatifs, x des personnages et y de leurs pieds, pour poser une ombre au sol
 *   tetes : facultatif, [{ x, h }] centre et hauteur (en unités) de chaque personnage. Sur une image
 *           fixe, un petit objet accroché au mur (horloge, étagère) s'efface s'il tombe derrière une tête.
 */
(function (root) {
  const ENCRE = '#141413', BLANC = '#FFFFFF';
  const rvb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mel = (a, b, k) => '#' + rvb(a).map((v, i) => Math.round(v + (rvb(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
  const tons = (fond) => ({
    fond, sol: mel(fond, ENCRE, 0.13), meuble: mel(fond, ENCRE, 0.2), ombre: mel(fond, ENCRE, 0.31), fonce: mel(fond, ENCRE, 0.44),
    pale: mel(fond, BLANC, 0.2), clair: mel(fond, BLANC, 0.5), lumiere: mel(fond, BLANC, 0.82), ligne: mel(fond, ENCRE, 0.19)
  });
  const n = (v) => +v.toFixed(1);
  const DENT = 'M-10 -8C-10 -18 -2 -18 0 -13C2 -18 10 -18 10 -8C10 0 8 4 7 12C6.5 16 3.5 16 3 11C2.5 7 -2.5 7 -3 11C-3.5 16 -6.5 16 -7 12C-8 4 -10 0 -10 -8Z';

  /* Petits outils de dessin : tout est exprimé en unités u au-dessus du sol. */
  function outils(o) {
    const { W, H, sol, u } = o;
    const y = (h) => sol - h * u;                                     // hauteur h au-dessus de la jonction mur/sol
    const R = (x, h, l, ep, c, r, rot) => `<rect x="${n(x)}" y="${n(y(h))}" width="${n(l)}" height="${n(ep * u)}" rx="${n((r || 0) * u)}" fill="${c}"${rot ? ` transform="rotate(${rot[0]} ${n(rot[1])} ${n(y(rot[2]))})"` : ''}/>`;
    const P = (pts, c) => `<path d="M${pts.map(([x, h]) => n(x) + ' ' + n(y(h))).join(' L')} Z" fill="${c}"/>`;
    const C = (x, h, r, c) => `<circle cx="${n(x)}" cy="${n(y(h))}" r="${n(r * u)}" fill="${c}"/>`;
    const E = (x, h, rx, ry, c, a) => `<ellipse cx="${n(x)}" cy="${n(y(h))}" rx="${n(rx * u)}" ry="${n(ry * u)}" fill="${c}"${a ? ` transform="rotate(${a} ${n(x)} ${n(y(h))})"` : ''}/>`;
    const T = (x, h, s, c) => `<path transform="translate(${n(x)} ${n(y(h))}) scale(${+(s * u).toFixed(2)})" d="${DENT}" fill="${c}"/>`;   // silhouette de dent
    // vrai si aucune tête ne passe devant la zone du mur x0..x1 dont le bas est à la hauteur h
    const libre = (x0, x1, h) => !(o.tetes || []).some((q) => q.h + 20 > h && q.x > x0 - 46 * u && q.x < x1 + 46 * u);
    return { W, H, u, y, R, P, C, E, T, libre };
  }
  /* La pièce : haut de mur plus clair au-dessus d'une cimaise, plinthe, sol avec ses lignes de fuite.
     carreaux : true pour un carrelage (lignes dans les deux sens), sinon un parquet. */
  const piece = (o, t, carreaux) => {
    const { W, H, sol, u } = o, c = W / 2, yc = sol - 244 * u, ep = n(Math.max(1, 0.9 * u));
    const fuites = Array.from({ length: 15 }, (_, i) => i - 7).map((i) =>
      `<path d="M${n(c + i * 0.085 * W)} ${n(sol)} L${n(c + i * 0.15 * W)} ${H}" stroke="${t.ligne}" stroke-width="${ep}" fill="none"/>`).join('');
    const travers = carreaux ? [0.3, 0.68].map((k) => `<rect x="0" y="${n(sol + (H - sol) * k)}" width="${W}" height="${ep}" fill="${t.ligne}"/>`).join('') : '';
    return (yc > 0 ? `<rect x="0" y="0" width="${W}" height="${n(yc)}" fill="${t.pale}"/><rect x="0" y="${n(yc)}" width="${W}" height="${n(2.5 * u)}" fill="${t.meuble}"/>` : '') +
      `<rect x="0" y="${n(sol)}" width="${W}" height="${n(H - sol)}" fill="${t.sol}"/>` + fuites + travers +
      `<rect x="0" y="${n(sol - 6 * u)}" width="${W}" height="${n(6 * u)}" fill="${t.meuble}"/>`;
  };
  /* Fenêtre : cadre, vitre, croisillons, store et appui. x est son centre. */
  const fenetre = ({ u, R }, t, x, vitre) =>
    R(x - 30 * u, 216, 60 * u, 92, t.clair, 3) + R(x - 26 * u, 212, 52 * u, 84, vitre, 2) +
    R(x - 1 * u, 212, 2 * u, 84, t.clair) + R(x - 26 * u, 171, 52 * u, 2, t.clair) + R(x - 34 * u, 124, 68 * u, 4, t.ombre, 1);
  /* Ombre au sol sous chaque personnage : elle l'ancre dans la pièce. */
  const ombres = (o, t) => (o.pieds || []).map((x) =>
    `<ellipse cx="${n(x)}" cy="${n(o.piedY)}" rx="${n(44 * o.u)}" ry="${n(6.5 * o.u)}" fill="${t.ombre}"/>`).join('');

  const DECORS = {
    aucun: { nom: 'Aucun', dessin: () => '' },
    sol: { nom: 'Mur et sol', dessin: (o, t) => piece(o, t) },

    /* Salle de soins : fenêtre et meuble bas à gauche, fauteuil et scialytique au centre, négatoscope à droite. */
    cabinet: {
      nom: 'La salle de soins',
      dessin: (o, t) => {
        const k = outils(o), { W, u, R, P, C, E, T } = k;
        const m = 0.3 * W;                                             // largeur du meuble bas
        const f = 0.55 * W;                                            // pied du fauteuil
        const v = 0.15 * W, x = 0.87 * W;                              // fenêtre, négatoscope
        return piece(o, t, true) +
          // fenêtre, son store, et la lumière qu'elle jette sur le sol
          fenetre(k, t, v, t.lumiere) + R(v - 26 * u, 212, 52 * u, 13, t.pale) +
          P([[v - 22 * u, -5], [v + 30 * u, -5], [v + 62 * u, -40], [v + 2 * u, -40]], t.fond) +
          // faisceau du scialytique sur le fauteuil
          P([[f - 36 * u, 176], [f + 6 * u, 184], [f + 52 * u, 58], [f - 74 * u, 58]], t.pale) +
          // négatoscope : boîte lumineuse et radio d'une dent
          R(x - 27 * u, 206, 54 * u, 46, t.ombre, 3) + R(x - 23 * u, 202, 46 * u, 38, t.lumiere, 2) + T(x, 184, 0.95, t.clair) +
          // meuble bas, plan de travail, portes, poignées, robinet
          R(0, 82, m, 82, t.meuble) + R(0, 90, m + 6 * u, 8, t.ombre, 2) +
          R(m * 0.33, 70, 2.5 * u, 58, t.ombre) + R(m * 0.66, 70, 2.5 * u, 58, t.ombre) +
          R(m * 0.14, 66, 9 * u, 2.5, t.clair, 1) + R(m * 0.47, 66, 9 * u, 2.5, t.clair, 1) + R(m * 0.8, 66, 9 * u, 2.5, t.clair, 1) +
          R(m * 0.5, 112, 4 * u, 22, t.ombre, 2) + R(m * 0.5, 112, 20 * u, 4, t.ombre, 2) +
          // sur le plan de travail : boîte de gants, flacon, gobelet
          R(m * 0.08, 104, 22 * u, 14, t.clair, 2) + R(m * 0.08 + 7 * u, 106, 8 * u, 3, t.lumiere, 1) +
          R(m * 0.82, 110, 8 * u, 20, t.clair, 3) + R(m * 0.82 + 2 * u, 115, 4 * u, 6, t.ombre, 1) +
          // scialytique : colonne, bras, tête lumineuse
          R(f + 66 * u, 196, 5 * u, 196, t.meuble) + R(f - 6 * u, 196, 77 * u, 5, t.meuble, 2) +
          R(f - 34 * u, 190, 44 * u, 15, t.lumiere, 7, [-12, f - 12 * u, 183]) +
          // tablette porte-instruments
          R(f - 96 * u, 98, 5 * u, 98, t.meuble) + R(f - 118 * u, 104, 50 * u, 6, t.ombre, 2) +
          R(f - 110 * u, 110, 3 * u, 6, t.clair, 1) + R(f - 102 * u, 112, 3 * u, 8, t.clair, 1) + R(f - 86 * u, 109, 10 * u, 5, t.clair, 2) +
          // fauteuil : socle, colonne, repose-jambes, assise, dossier, têtière
          R(f - 30 * u, 8, 60 * u, 8, t.ombre, 3) + R(f - 8 * u, 40, 16 * u, 34, t.ombre) +
          R(f - 78 * u, 54, 44 * u, 12, t.clair, 6, [28, f - 34 * u, 48]) +
          R(f - 40 * u, 54, 62 * u, 14, t.clair, 6) +
          R(f + 14 * u, 56, 78 * u, 14, t.clair, 7, [-58, f + 18 * u, 49]) +
          C(f + 62 * u, 126, 11, t.clair) +
          P([[f - 30 * u, 40], [f + 30 * u, 40], [f + 24 * u, 34], [f - 24 * u, 34]], t.ombre);
      }
    },

    /* Accueil : cadre, plante et chaises d'attente à gauche, banque, écran et étagère de dossiers à droite. */
    accueil: {
      nom: "L'accueil",
      dessin: (o, t) => {
        const { W, u, R, P, C, libre } = outils(o);
        const b = 0.44 * W, p = 0.085 * W, h = 0.3 * W, s = 0.19 * W;
        const chaise = (x) => R(x + 3 * u, 40, 3 * u, 40, t.ombre) + R(x + 22 * u, 40, 3 * u, 40, t.ombre) +
          R(x + 2 * u, 86, 24 * u, 32, t.clair, 5) + R(x, 47, 28 * u, 8, t.clair, 3);
        const dossiers = [[0, 26, 'meuble'], [8, 30, 'clair'], [16, 24, 'ombre'], [24, 30, 'meuble'], [32, 27, 'clair'], [44, 30, 'ombre'], [52, 22, 'meuble'], [64, 28, 'clair'], [72, 30, 'meuble'], [80, 25, 'ombre']];
        return piece(o, t) +
          // tapis de la salle d'attente
          R(0.05 * W, -9, 0.36 * W, 15, t.meuble, 7) +
          // cadre au mur, avec une dent dedans
          R(p - 20 * u, 196, 46 * u, 56, t.ombre, 2) + R(p - 15 * u, 191, 36 * u, 46, t.lumiere, 1) +
          outils(o).T(p + 3 * u, 167, 0.85, t.clair) +
          // horloge
          (libre(h - 16 * u, h + 16 * u, 182) ? C(h, 198, 16, t.ombre) + C(h, 198, 12.5, t.lumiere) + R(h - 1 * u, 207, 2 * u, 10, t.ombre, 1) + R(h, 199, 8 * u, 2, t.ombre, 1) : '') +
          // chaises d'attente
          chaise(s) + chaise(s + 33 * u) +
          // plante
          P([[p - 13 * u, 30], [p + 13 * u, 30], [p + 9 * u, 0], [p - 9 * u, 0]], t.ombre) +
          [[-16, 62, -28], [0, 76, 0], [16, 64, 26], [-9, 92, -12], [10, 96, 14]].map(([dx, hh, a]) =>
            `<ellipse cx="${n(p + dx * u)}" cy="${n(o.sol - hh * u)}" rx="${n(9 * u)}" ry="${n(24 * u)}" fill="${t.meuble}" transform="rotate(${a} ${n(p + dx * u)} ${n(o.sol - hh * u)})"/>`).join('') +
          // étagère de dossiers au-dessus de la banque
          (libre(b + 16 * u, b + 112 * u, 174) ? R(b + 16 * u, 178, 96 * u, 4, t.ombre, 1) +
            dossiers.map(([dx, hh, c]) => R(b + 20 * u + dx * u, 178 + hh, 7 * u, hh, t[c], 1)).join('') : '') +
          // banque d'accueil, plateau, panneau clair, présentoir
          R(b, 92, W - b, 92, t.meuble) + R(b - 8 * u, 101, W - b + 8 * u, 9, t.ombre, 2) +
          R(b + 18 * u, 74, W - b - 36 * u, 52, t.clair, 4) +
          R(b + 8 * u, 115, 13 * u, 14, t.clair, 2) + R(b + 10 * u, 112, 9 * u, 2, t.ombre, 1) + R(b + 10 * u, 108, 9 * u, 2, t.ombre, 1) +
          // écran sur la banque
          R(W - 64 * u, 148, 46 * u, 32, t.ombre, 3) + R(W - 60 * u, 144, 38 * u, 24, t.clair, 2) + R(W - 45 * u, 116, 8 * u, 15, t.ombre) + C(W - 41 * u, 132, 0, t.ombre);
      }
    },

    /* Hors du cabinet : la nuit à la fenêtre, une guirlande, une table dressée, une suspension. */
    soiree: {
      nom: 'La soirée',
      dessin: (o, t) => {
        const k = outils(o), { W, u, y, R, P, C } = k;
        const c = W / 2, v = 0.15 * W, x = 0.86 * W;
        const fil = Array.from({ length: 13 }, (_, i) => [i * W / 12, 262 - 16 * Math.sin(Math.PI * i / 12)]);
        return piece(o, t) +
          // fenêtre sur la nuit : lune, étoiles, rideaux
          fenetre(k, t, v, t.fonce) + C(v + 11 * u, 192, 9, t.lumiere) + C(v + 15 * u, 195, 7.5, t.fonce) +
          C(v - 14 * u, 198, 1.6, t.lumiere) + C(v - 6 * u, 150, 1.6, t.lumiere) + C(v + 16 * u, 158, 1.3, t.lumiere) +
          P([[v - 40 * u, 220], [v - 22 * u, 220], [v - 30 * u, 124], [v - 40 * u, 124]], t.pale) +
          P([[v + 22 * u, 220], [v + 40 * u, 220], [v + 40 * u, 124], [v + 30 * u, 124]], t.pale) +
          // guirlande lumineuse
          `<path d="M${fil.map(([px, h]) => n(px) + ' ' + n(y(h))).join(' L')}" fill="none" stroke="${t.ombre}" stroke-width="${n(1.4 * u)}"/>` +
          fil.slice(1, -1).map(([px, h], i) => C(px, h - 5, 4.2, i % 2 ? t.clair : t.lumiere)).join('') +
          // deux cadres
          R(x - 20 * u, 204, 40 * u, 32, t.ombre, 2) + R(x - 16 * u, 200, 32 * u, 24, t.clair, 1) +
          R(x - 12 * u, 164, 26 * u, 30, t.ombre, 2) + R(x - 8 * u, 160, 18 * u, 22, t.lumiere, 1) +
          // lumière de la suspension sur la table
          P([[c - 40 * u, 208], [c + 40 * u, 208], [c + 96 * u, 70], [c - 96 * u, 70]], t.pale) +
          // suspension
          `<rect x="${n(c - 1.5 * u)}" y="0" width="${n(3 * u)}" height="${n(o.sol - 236 * u)}" fill="${t.ombre}"/>` +
          P([[c - 26 * u, 236], [c + 26 * u, 236], [c + 40 * u, 208], [c - 40 * u, 208]], t.ombre) + C(c, 206, 9, t.lumiere) +
          // chaises derrière la table
          R(c - 104 * u, 108, 24 * u, 108, t.meuble, 6) + R(c + 80 * u, 108, 24 * u, 108, t.meuble, 6) +
          // table, verres, assiettes, bouteille
          R(c - 74 * u, 70, 148 * u, 9, t.ombre, 3) + R(c - 58 * u, 61, 7 * u, 61, t.meuble) + R(c + 51 * u, 61, 7 * u, 61, t.meuble) +
          [-24, 24].map((dx) => R(c + dx * u - 6 * u, 94, 12 * u, 14, t.lumiere, 4) + R(c + dx * u - 1 * u, 80, 2 * u, 10, t.lumiere) + R(c + dx * u - 6 * u, 72, 12 * u, 2.5, t.lumiere, 1)).join('') +
          R(c - 62 * u, 73, 24 * u, 3, t.clair, 1) + R(c + 38 * u, 73, 24 * u, 3, t.clair, 1) +
          R(c - 4 * u, 104, 8 * u, 34, t.meuble, 3) + R(c - 1.5 * u, 114, 3 * u, 12, t.meuble, 1);
      }
    },

    /* Salle de réunion : écran au mur à gauche avec un graphique, fenêtre à droite, grande table et chaises sur toute la largeur. */
    reunion: {
      nom: 'La salle de réunion',
      dessin: (o, t) => {
        const k = outils(o), { W, u, R } = k;
        const e = 0.25 * W, g = 0.08 * W, d = 0.92 * W;
        return piece(o, t) +
          // écran et son graphique
          R(e - 62 * u, 226, 124 * u, 84, t.ombre, 4) + R(e - 56 * u, 220, 112 * u, 72, t.lumiere, 2) +
          [0, 1, 2, 3].map((i) => R(e - 42 * u + i * 22 * u, 158 + 10 + i * 12, 14 * u, 10 + i * 12, i === 3 ? t.ombre : t.clair, 1)).join('') +
          R(e - 48 * u, 158, 96 * u, 2, t.ombre, 1) +
          // fenêtre
          fenetre(k, t, 0.8 * W, t.lumiere) +
          // chaises derrière la table
          [0.13, 0.3, 0.47, 0.64, 0.81].map((x) => R(x * W, 122, 26 * u, 122, t.meuble, 7)).join('') +
          // table, ordinateur, gobelets
          R(g, 82, d - g, 10, t.ombre, 3) + R(g + 12 * u, 72, 8 * u, 72, t.meuble) + R(d - 20 * u, 72, 8 * u, 72, t.meuble) +
          R(0.36 * W, 104, 30 * u, 20, t.clair, 2) + R(0.36 * W - 5 * u, 84.5, 40 * u, 2.5, t.clair, 1) +
          R(0.2 * W, 94, 9 * u, 12, t.lumiere, 2) + R(0.58 * W, 94, 9 * u, 12, t.lumiere, 2) + R(0.74 * W, 94, 9 * u, 12, t.lumiere, 2);
      }
    }
  };

  function rendre(nom, o) {
    const d = DECORS[nom];
    if (!d) throw new Error('Décor inconnu : ' + nom);
    return `<svg xmlns="http://www.w3.org/2000/svg" class="decor" width="${o.W}" height="${o.H}" viewBox="0 0 ${o.W} ${o.H}">${d.dessin(o, tons(o.fond))}${ombres(o, tons(o.fond))}</svg>`;
  }

  const API = { rendre, DECORS, liste: () => Object.keys(DECORS) };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Decors = API;
})(typeof window !== 'undefined' ? window : globalThis);
