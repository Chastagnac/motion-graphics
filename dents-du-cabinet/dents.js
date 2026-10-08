/*
 * Les Dents du Cabinet : bibliothèque de pièces et moteur d'assemblage.
 * Aucune dépendance. Fonctionne dans Node et dans le navigateur.
 *
 * Repère commun : chaque personnage tient dans un cadre 200 x 260, pieds à y = 248.
 * Une pose = un objet { dent, expression | sourcils/yeux/bouche, brasG, brasD, propG, propD, jambes, effets }.
 * renderTooth(pose) renvoie une chaîne SVG autonome.
 */
(function (root) {
  const INK = '#141413';
  const COLORS = {
    blanc: '#FFFFFF', vert: '#2BA58A', rouge: '#E2553F', bleu: '#2F4FD8',
    cafe: '#F2A93B', goutte: '#2F8FE0', postit: '#FFE45C', calot: '#8EC5FF', masque: '#BFE3F5',
    ombre: '#DCE3EE', vertOmbre: '#228C75', joue: '#FF9A9A'
  };
  const W = 200, H = 260, SOL = 248;

  /* ---------- 1. CORPS ---------- */
  const BODIES = {
    molaire: {
      nom: 'La molaire', role: 'La cheffe',
      path: 'M55 90 C55 50 85 46 100 62 C115 46 145 50 145 90 C145 125 138 142 133 172 C131 186 117 186 116 170 C115 158 110 148 100 148 C90 148 85 158 84 170 C83 186 69 186 67 172 C62 142 55 125 55 90 Z',
      hanches: [[75, 181], [125, 181]], epaules: [[57, 112], [143, 112]],
      visage: { x: 100, y: 98, s: 17, k: 1 }, haut: 50,
      defaut: { expression: 'juge', brasG: 'hanche', brasD: 'hanche' }
    },
    canine: {
      nom: 'La canine', role: "L'assistante",
      path: 'M100 40 C122 60 140 78 140 104 C140 132 126 150 120 176 C116 190 84 190 80 176 C74 150 60 132 60 104 C60 78 78 60 100 40 Z',
      hanches: [[90, 186], [110, 186]], epaules: [[62, 120], [138, 120]],
      visage: { x: 100, y: 106, s: 13, k: 1 }, haut: 26,
      defaut: { expression: 'malin', brasG: 'croise', brasD: 'tient', propD: 'aspiration' }
    },
    incisive: {
      nom: "L'incisive", role: "L'accueil",
      path: 'M62 52 C62 44 138 44 138 52 L140 118 C140 142 130 158 122 180 C118 192 82 192 78 180 C70 158 60 142 60 118 Z',
      hanches: [[88, 188], [112, 188]], epaules: [[61, 114], [139, 114]],
      visage: { x: 100, y: 96, s: 16, k: 1 }, haut: 32,
      defaut: { expression: 'blase', brasG: 'bas', brasD: 'tient', propD: 'cafe' }
    },
    lait: {
      nom: 'La dent de lait', role: 'Le patient',
      path: 'M70 142 C70 118 88 114 100 124 C112 114 130 118 130 142 C130 166 122 182 112 182 C107 182 104 172 100 172 C96 172 93 182 88 182 C78 182 70 166 70 142 Z',
      hanches: [[88, 180], [112, 180]], epaules: [[71, 150], [129, 150]],
      visage: { x: 100, y: 142, s: 11, k: 0.8 }, haut: 116,
      defaut: { expression: 'panique', brasG: 'leve', brasD: 'leve', jambes: 'tremble' }
    },
    sagesse: {
      nom: 'La dent de sagesse', role: 'Invitée rare',
      path: 'M58 94 C58 56 86 52 100 66 C114 52 142 56 142 94 C142 124 137 140 133 164 C131 178 121 178 120 166 C119 158 114 150 108 152 C104 162 104 176 100 178 C96 176 96 162 92 152 C86 150 81 158 80 166 C79 178 69 178 67 164 C63 140 58 124 58 94 Z',
      hanches: [[74, 174], [126, 174]], epaules: [[60, 114], [140, 114]],
      visage: { x: 100, y: 100, s: 16, k: 1 }, haut: 54,
      defaut: { expression: 'blase', brasG: 'croise', brasD: 'bas' }
    },

    /* Les dentistes : humains bâton en blouse, dans le même cadre que les dents. */
    docteur: {
      type: 'humain', nom: 'Le docteur', role: 'Dentiste',
      dessin: (u) => blouse(u),
      hanches: [[90, 186], [110, 186]], epaules: [[79, 116], [121, 116]],
      visage: { x: 100, y: 68, s: 13, k: 1 }, haut: 24,
      defaut: { expression: 'content', brasG: 'bas', brasD: 'tient', propD: 'miroir', masque: 'menton' }
    },
    docteure: {
      type: 'humain', nom: 'La docteure', role: 'Dentiste',
      dessin: (u) => blouse(u),
      hanches: [[90, 186], [110, 186]], epaules: [[79, 116], [121, 116]],
      visage: { x: 100, y: 68, s: 13, k: 1 }, haut: 18,
      defaut: { expression: 'malin', brasG: 'hanche', brasD: 'tient', propD: 'sonde' }
    },
    collaborateur: {
      type: 'humain', nom: 'Le collaborateur', role: 'Jeune dentiste',
      dessin: (u) => blouse(u),
      hanches: [[90, 186], [110, 186]], epaules: [[79, 116], [121, 116]],
      visage: { x: 100, y: 68, s: 13, k: 1 }, haut: 28,
      defaut: { expression: 'panique', brasG: 'tient', propG: 'bloc', brasD: 'bas' }
    },
    /* L'assistante : humaine bâton en tunique verte, queue de cheval. */
    assistante: {
      type: 'humain', nom: "L'assistante", role: 'Assistante dentaire',
      dessin: (u) => tunique(u),
      hanches: [[90, 186], [110, 186]], epaules: [[79, 116], [121, 116]],
      visage: { x: 100, y: 68, s: 13, k: 1 }, haut: 30,
      defaut: { expression: 'content', brasG: 'bas', brasD: 'tient', propD: 'aspiration' }
    }
  };
  Object.keys(BODIES).forEach((k) => { if (!BODIES[k].type) BODIES[k].type = 'dent'; });

  /* Tête des humains : un croissant d'ombre à droite, sous le contour. */
  const tete = (u) => `<defs><clipPath id="dc-tete-${u}"><circle cx="100" cy="70" r="34"/></clipPath></defs>` +
    `<circle cx="100" cy="70" r="34" fill="${COLORS.ombre}" stroke="none"/>` +
    `<circle cx="94" cy="67" r="34" fill="${COLORS.blanc}" stroke="none" clip-path="url(#dc-tete-${u})"/>` +
    `<circle cx="100" cy="70" r="34"/>`;

  function blouse(u) {
    return `<path d="M80 106 L120 106 L136 188 L64 188 Z" fill="${COLORS.blanc}"/>` +
      `<path d="M110 109 L117.5 109 L132 185 L121 185 Z" fill="${COLORS.ombre}" stroke="none"/>` +
      `<path d="M88 106 L100 126 L112 106" stroke-width="4"/>` +
      `<path d="M110 146 L126 146 L127 160 L111 160 Z" stroke-width="3.5"/>` +
      `<path d="M116 146 L116 137" stroke="${COLORS.bleu}" stroke-width="3.5"/>` +
      tete(u);
  }

  function tunique(u) {
    return `<path d="M80 106 L120 106 L136 188 L64 188 Z" fill="${COLORS.vert}"/>` +
      `<path d="M112 109 L117.5 109 L132 185 L122 185 Z" fill="${COLORS.vertOmbre}" stroke="none"/>` +
      `<path d="M88 106 L100 124 L112 106 Z" fill="${COLORS.blanc}" stroke-width="4"/>` +
      `<rect x="79" y="142" width="14" height="9" rx="2" fill="${COLORS.blanc}" stroke-width="3"/>` +
      tete(u);
  }

  /* Accessoire fixe de chaque personnage : il ne change jamais. */
  const SIGNATURES = {
    molaire: {
      avantVisage: (b) => {
        const { x, y, s } = b.visage;
        return `<rect x="${x - s - 10}" y="${y - 8}" width="20" height="16" rx="5" fill="${COLORS.vert}" stroke-width="4"/>` +
          `<rect x="${x + s - 10}" y="${y - 8}" width="20" height="16" rx="5" fill="${COLORS.vert}" stroke-width="4"/>` +
          `<path d="M${x - s + 10} ${y} L${x + s - 10} ${y}" stroke-width="4"/>`;
      }
    },
    canine: { apresCorps: () => `<circle cx="100" cy="36" r="10" fill="${COLORS.rouge}" stroke-width="4"/>` },
    incisive: {
      apresCorps: () =>
        `<path d="M57 100 C52 16 148 16 143 100" stroke-width="5"/>` +
        `<rect x="49" y="88" width="13" height="25" rx="5" fill="${COLORS.bleu}" stroke-width="4"/>` +
        `<rect x="138" y="88" width="13" height="25" rx="5" fill="${COLORS.bleu}" stroke-width="4"/>` +
        `<path d="M56 113 C58 130 72 134 81 127" stroke-width="4"/>`
    },
    lait: {
      apresTout: (b) => gouttes(b)
    },
    docteur: {
      apresCorps: () => `<path d="M68 54 C64 18 136 18 132 54 C120 46 80 46 68 54 Z" fill="${COLORS.calot}" stroke-width="4.5"/>` +
        `<path d="M84 34 L84 44 M100 30 L100 42 M116 34 L116 44" stroke-width="2.5"/>`
    },
    docteure: {
      apresCorps: () => `<circle cx="100" cy="28" r="12" fill="${INK}"/>` +
        `<path d="M112 22 L124 12" stroke="${COLORS.rouge}" stroke-width="4"/>` +
        `<path d="M67 62 C60 26 140 26 133 62 C124 46 76 46 67 62 Z" fill="${INK}"/>`
    },
    collaborateur: {
      apresCorps: () => `<path d="M68 58 L72 38 L82 50 L88 30 L98 46 L104 28 L112 46 L120 32 L124 48 L132 42 L132 60" stroke-width="4.5"/>`,
      avantVisage: (b) => {
        const { x, y, s } = b.visage;
        return `<circle cx="${x - s}" cy="${y}" r="10" stroke-width="3"/><circle cx="${x + s}" cy="${y}" r="10" stroke-width="3"/>` +
          `<path d="M${x - s + 10} ${y} L${x + s - 10} ${y}" stroke-width="3"/>`;
      }
    },
    assistante: {
      apresCorps: () => `<path d="M130 52 C152 50 157 78 147 100 C144 107 135 104 138 96 C143 82 140 68 128 62 Z" fill="${INK}" stroke-width="4"/>` +
        `<path d="M67 64 C58 24 142 24 133 64 C124 48 76 48 67 64 Z" fill="${INK}"/>` +
        `<circle cx="134" cy="54" r="5" fill="${COLORS.postit}" stroke-width="3"/>`
    },
    sagesse: {
      apresCorps: () =>
        `<path d="M86 80 C92 77 98 80 104 77 C108 75 112 78 114 77" stroke-width="3"/>` +
        `<path d="M162 140 L162 ${SOL}" stroke-width="5"/><path d="M162 140 C162 126 178 126 178 138" stroke-width="5"/>`
    }
  };

  /* ---------- 2. VISAGE ---------- */
  // Sourcils : [gauche, droit], dessinés autour de (0,0) au-dessus de chaque œil.
  const SOURCILS = {
    neutre: ['M-8 0 L8 0', 'M-8 0 L8 0'],
    leve: ['M-8 1 L8 2', 'M-8 -5 L8 -11'],
    fronce: ['M-8 -4 L8 3', 'M-8 3 L8 -4'],
    triste: ['M-8 3 L8 -4', 'M-8 -4 L8 3'],
    choque: ['M-8 -6 C-4 -12 4 -12 8 -6', 'M-8 -6 C-4 -12 4 -12 8 -6'],
    malin: ['M-8 2 L8 2', 'M-8 -3 C-3 -10 3 -10 8 -6']
  };
  // Yeux : un motif par œil, centré sur (0,0).
  const YEUX = {
    points: () => `<circle r="3.2" fill="${INK}" stroke="none"/>`,
    ronds: () => `<circle r="7" fill="${COLORS.blanc}" stroke-width="3.5"/><circle r="2.6" fill="${INK}" stroke="none"/>`,
    plisses: () => `<path d="M-6 2 C-3 -4 3 -4 6 2" stroke-width="4"/>`,
    blase: () => `<path d="M-7 -1 L7 -1" stroke-width="4"/><circle cy="2.5" r="2.6" fill="${INK}" stroke="none"/>`,
    cote: () => `<circle r="6" fill="${COLORS.blanc}" stroke-width="3"/><circle cx="3" r="2.6" fill="${INK}" stroke="none"/>`
  };
  // Bouches : centrées sur (0,0).
  const BOUCHES = {
    neutre: 'M-8 0 L8 0',
    sourire: 'M-12 -3 C-6 7 6 7 12 -3',
    sourire_coin: 'M-9 2 C-2 4 6 2 11 -5',
    ouverte: 'ELLIPSE',
    triste: 'M-10 5 C-5 -3 5 -3 10 5',
    tremble: 'M-11 0 C-8 -4 -4 4 -1 0 C2 -4 6 4 10 0',
    moue: 'M-8 2 L8 -2'
  };

  /* Expressions nommées : ce qu'on écrit dans les données de chaque slide. */
  const EXPRESSIONS = {
    neutre: { sourcils: 'neutre', yeux: 'points', bouche: 'neutre' },
    blase: { sourcils: 'neutre', yeux: 'blase', bouche: 'moue' },
    juge: { sourcils: 'leve', yeux: 'points', bouche: 'moue' },
    regard_camera: { sourcils: 'neutre', yeux: 'ronds', bouche: 'neutre' },
    choque: { sourcils: 'choque', yeux: 'ronds', bouche: 'ouverte', effets: ['choc'] },
    panique: { sourcils: 'triste', yeux: 'ronds', bouche: 'tremble', effets: ['sueur'] },
    content: { sourcils: 'neutre', yeux: 'plisses', bouche: 'sourire' },
    malin: { sourcils: 'malin', yeux: 'cote', bouche: 'sourire_coin' },
    fache: { sourcils: 'fronce', yeux: 'points', bouche: 'triste' },
    triste: { sourcils: 'triste', yeux: 'points', bouche: 'triste' }
  };

  /* ---------- 3. BRAS ---------- */
  // Dessinés pour le bras gauche depuis l'épaule (0,0) ; le bras droit est le miroir.
  // main = point où se pose un objet tenu.
  const BRAS = {
    bas: { d: [[0, 0], [-12, 30], [-14, 56]], main: [-14, 56] },
    hanche: { d: [[0, 0], [-24, 18], [-6, 36]], main: [-6, 36] },
    leve: { d: [[0, 0], [-20, -22], [-24, -48]], main: [-24, -48] },
    salut: { d: [[0, 0], [-26, 6], [-30, -20]], main: [-30, -20] },
    pointe: { d: [[0, 0], [-30, 4], [-56, 0]], main: [-56, 0] },
    croise: { d: [[0, 0], [-12, 22], [24, 24]], main: [24, 24] },
    tient: { d: [[0, 0], [-22, 24], [-34, 10]], main: [-34, 10] },
    haussement: { d: [[0, 0], [-18, 16], [-36, 2]], main: [-36, 2] }
  };

  /* ---------- 4. OBJETS TENUS ---------- */
  const PROPS = {
    cafe: (x, y) => `<rect x="${x - 9}" y="${y - 20}" width="18" height="21" rx="3" fill="${COLORS.cafe}" stroke-width="4"/>` +
      `<path d="M${x} ${y - 26} C${x - 4} ${y - 30} ${x + 4} ${y - 34} ${x} ${y - 39}" stroke-width="3"/>`,
    // combiné sombre à écran clair : il ne se confond pas avec le casque bleu de l'incisive
    telephone: (x, y) => `<rect x="${x - 7}" y="${y - 30}" width="14" height="32" rx="7" fill="${INK}" stroke-width="4"/>` +
      `<rect x="${x - 3.5}" y="${y - 24}" width="7" height="13" rx="2" fill="${COLORS.masque}" stroke="none"/>`,
    bloc: (x, y) => `<rect x="${x - 13}" y="${y - 30}" width="26" height="32" rx="2" fill="${COLORS.blanc}" stroke-width="4"/>` +
      `<path d="M${x - 7} ${y - 20} L${x + 7} ${y - 20} M${x - 7} ${y - 12} L${x + 7} ${y - 12} M${x - 7} ${y - 4} L${x + 3} ${y - 4}" stroke-width="2.5"/>`,
    postit: (x, y) => `<rect x="${x - 12}" y="${y - 24}" width="24" height="24" fill="${COLORS.postit}" stroke-width="3.5" transform="rotate(-8 ${x} ${y - 12})"/>`,
    aspiration: (x, y) => `<path d="M${x} ${y} C${x + 4} ${y - 20} ${x + 16} ${y - 24} ${x + 14} ${y - 42}" stroke-width="7"/>` +
      `<circle cx="${x + 14}" cy="${y - 46}" r="4" fill="${COLORS.blanc}" stroke-width="3"/>`,
    miroir: (x, y) => `<path d="M${x} ${y} L${x + 2} ${y - 30}" stroke-width="4"/>` +
      `<circle cx="${x + 3}" cy="${y - 38}" r="8" fill="${COLORS.masque}" stroke-width="3.5"/>`,
    sonde: (x, y) => `<path d="M${x} ${y} L${x + 2} ${y - 32} C${x + 2} ${y - 40} ${x + 10} ${y - 40} ${x + 9} ${y - 34}" stroke-width="3.5"/>`
  };

  /* ---------- 5. JAMBES ---------- */
  const JAMBES = {
    debout: (h, c) => `M${h[0]} ${h[1]} L${h[0] + c * 4} ${SOL} L${h[0] + c * 16} ${SOL}`,
    marche: (h, c) => `M${h[0]} ${h[1]} L${h[0] + c * 16} ${SOL} L${h[0] + c * 28} ${SOL}`,
    tremble: (h, c) => {
      const t = (SOL - h[1]) / 3;
      return `M${h[0]} ${h[1]} L${h[0] + c * 6} ${h[1] + t} L${h[0] - c * 3} ${h[1] + 2 * t} L${h[0] + c * 4} ${SOL} L${h[0] + c * 14} ${SOL}`;
    }
  };

  /* ---------- 6. EFFETS ---------- */
  function gouttes(b) {
    const { x, y, s, k } = b.visage;
    const dx = s + 26 * k;
    return `<ellipse cx="${x + dx + 8}" cy="${y - 4}" rx="3.5" ry="7" fill="${COLORS.goutte}" stroke-width="2.5"/>` +
      `<ellipse cx="${x - dx - 8}" cy="${y + 2}" rx="3.5" ry="7" fill="${COLORS.goutte}" stroke-width="2.5"/>`;
  }
  const EFFETS = {
    sueur: (b) => (b.id === 'lait' ? '' : gouttes(b)),
    choc: (b) => {
      const t = b.haut;
      return `<path d="M68 ${t - 2} L58 ${t - 14} M100 ${t - 8} L100 ${t - 24} M132 ${t - 2} L142 ${t - 14}" stroke-width="4"/>`;
    },
    zzz: (b) => {
      const t = b.haut, z = (x, y, s) => `M${x} ${y} L${x + s} ${y} L${x} ${y + s} L${x + s} ${y + s}`;
      return `<path d="${z(140, t - 4, 10)} ${z(154, t - 20, 13)} ${z(170, t - 40, 16)}" stroke-width="3.5"/>`;
    }
  };

  /* ---------- 7. FINITIONS ---------- */
  // Mains et chaussures sont des marqueurs SVG posés au bout des traits : les tracés des bras et des
  // jambes ne changent pas, et la main ou le pied suit le trait quand une animation le déplace.
  const marqueur = (nom, inner) => `<marker id="${nom}" markerUnits="userSpaceOnUse" markerWidth="60" markerHeight="40" refX="30" refY="20" viewBox="0 0 60 40" overflow="visible">${inner}</marker>`;
  const finitions = (humain, u) => `<defs>` +
    marqueur('dc-main-' + u, `<circle cx="30" cy="20" r="5.4" fill="${COLORS.blanc}" stroke="${INK}" stroke-width="3.6"/>`) +
    [['G', 13, 35], ['D', 25, 47]].map(([c, x0, x1]) => marqueur('dc-pied-' + u + c,
      `<path d="M${x0} 21 A11 9 0 0 1 ${x1} 21 Z" fill="${humain ? COLORS.blanc : INK}" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>`)).join('') +
    `</defs>`;

  /* ---------- 8. ASSEMBLAGE ---------- */
  // Chaque dessin porte ses propres marqueurs et masques, sous un numéro à lui : une page qui montre et
  // cache des cases ne peut pas faire dépendre un personnage visible d'une définition cachée.
  let numero = 0;
  const pts = (arr) => 'M' + arr.map((p) => p.join(' ')).join(' L');

  function renderTooth(pose, opts) {
    opts = opts || {};
    const id = pose.dent;
    const base = BODIES[id];
    if (!base) throw new Error('Dent inconnue : ' + id);
    const b = Object.assign({ id }, base);
    const p = Object.assign({ jambes: 'debout' }, base.defaut, pose);
    const ex = EXPRESSIONS[p.expression] || {};
    const sourcils = p.sourcils || ex.sourcils || 'neutre';
    const yeux = p.yeux || ex.yeux || 'points';
    const bouche = p.bouche || ex.bouche || 'neutre';
    const effets = [].concat(ex.effets || [], p.effets || []);
    const sig = SIGNATURES[id] || {};
    const { x, y, s, k } = b.visage;
    const u = ++numero, humain = b.type === 'humain', pied = 'dc-pied-' + u;
    let o = finitions(humain, u);

    // jambes
    o += `<path d="${JAMBES[p.jambes](b.hanches[0], -1)}" marker-end="url(#${pied}G)"/><path d="${JAMBES[p.jambes](b.hanches[1], 1)}" marker-end="url(#${pied}D)"/>`;
    // corps : une dent a un croissant d'ombre à droite, sous son contour
    o += b.dessin ? b.dessin(u) : `<defs><clipPath id="dc-corps-${u}"><path d="${b.path}" transform="translate(7 4)"/></clipPath></defs>` +
      `<path d="${b.path}" fill="${COLORS.ombre}" stroke="none"/>` +
      `<path d="${b.path}" fill="${COLORS.blanc}" stroke="none" transform="translate(-7 -4)" clip-path="url(#dc-corps-${u})"/>` +
      `<path d="${b.path}"/>`;
    if (sig.apresCorps) o += sig.apresCorps(b);
    // bras et objets
    const props = [];
    [['brasG', 'propG', 0, 1], ['brasD', 'propD', 1, -1]].forEach(([bk, pk, i, m]) => {
      const a = BRAS[p[bk]];
      if (!a) return;
      const [ex0, ey0] = b.epaules[i];
      const abs = a.d.map(([ax, ay]) => [ex0 + ax * m, ey0 + ay]);
      o += `<path d="${pts(abs)}" marker-end="url(#dc-main-${u})"/>`;
      if (p[pk] && PROPS[p[pk]]) props.push(PROPS[p[pk]](ex0 + a.main[0] * m, ey0 + a.main[1]));
    });
    // visage : deux joues roses, puis l'accessoire, puis les traits
    o += [-1, 1].map((c) => `<circle cx="${x + c * (s + 8 * k)}" cy="${y + 13 * k}" r="${5.5 * k}" fill="${COLORS.joue}" stroke="none" opacity="0.6"/>`).join('');
    if (sig.avantVisage) o += sig.avantVisage(b);
    const by = -14 * k, my = 24 * k;
    o += `<g stroke-width="${5 * k}">`;
    o += `<path transform="translate(${x - s} ${y + by}) scale(${k})" d="${SOURCILS[sourcils][0]}"/>`;
    o += `<path transform="translate(${x + s} ${y + by}) scale(${k})" d="${SOURCILS[sourcils][1]}"/>`;
    o += `<g transform="translate(${x - s} ${y}) scale(${k})">${YEUX[yeux]()}</g>`;
    o += `<g transform="translate(${x + s} ${y}) scale(${k})">${YEUX[yeux]()}</g>`;
    const masque = p.masque || null;
    if (masque !== 'haut') o += BOUCHES[bouche] === 'ELLIPSE'
      ? `<ellipse cx="${x}" cy="${y + my}" rx="${6 * k}" ry="${8 * k}" fill="${INK}"/>`
      : `<path transform="translate(${x} ${y + my}) scale(${k})" d="${BOUCHES[bouche]}"/>`;
    o += `</g>`;
    if (masque === 'haut') {
      o += `<path d="M67 76 L80 80 M133 76 L120 80" stroke-width="3"/>` +
        `<rect x="79" y="77" width="42" height="24" rx="9" fill="${COLORS.masque}" stroke-width="4"/>` +
        `<path d="M85 85 L115 85 M85 92 L115 92" stroke-width="2"/>`;
    } else if (masque === 'menton') {
      o += `<path d="M70 92 L82 100 M130 92 L118 100" stroke-width="3"/>` +
        `<rect x="81" y="97" width="38" height="15" rx="7" fill="${COLORS.masque}" stroke-width="4"/>`;
    }
    o += props.join('');
    if (sig.apresTout) o += sig.apresTout(b);
    effets.forEach((e) => { if (EFFETS[e]) o += EFFETS[e](b); });

    const w = opts.width ? ` width="${opts.width}"` : '';
    const h = opts.height ? ` height="${opts.height}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${w}${h} role="img" aria-label="${b.nom}">` +
      `<g fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${o}</g></svg>`;
  }

  const API = {
    renderTooth, renderCharacter: renderTooth, BODIES, EXPRESSIONS, SOURCILS, YEUX, BOUCHES, BRAS, PROPS, JAMBES, EFFETS, COLORS,
    catalogue: () => ({
      dents: Object.keys(BODIES).filter((k) => BODIES[k].type === 'dent'),
      humains: Object.keys(BODIES).filter((k) => BODIES[k].type === 'humain'),
      masques: ['haut', 'menton'], expressions: Object.keys(EXPRESSIONS), sourcils: Object.keys(SOURCILS),
      yeux: Object.keys(YEUX), bouches: Object.keys(BOUCHES), bras: Object.keys(BRAS),
      objets: Object.keys(PROPS), jambes: Object.keys(JAMBES), effets: Object.keys(EFFETS)
    })
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Dents = API;
})(typeof window !== 'undefined' ? window : globalThis);
