/*
 * dents-strip : scène. Branche la bibliothèque Dents sur le moteur motion.js.
 * Même contrat que le moteur : chaque style est une fonction pure du temps dans seek(t),
 * la page expose window.seek et window.DURATION, « ?render » coupe l'aperçu en boucle.
 * Le dessin vient uniquement de Dents.renderTooth : ici on trie ses calques, on ne redessine rien.
 */
(function () {
  const M = window.M, D = window.Dents;
  const SOL = 248;                                   // pieds dans le repère 200 x 260 de la bibliothèque
  // cadrage du reel 1080 x 1920. Une planche de BD passe le sien à monter().
  const REEL = {
    SOL_Y: 1530,                                     // pieds à l'écran, au-dessus de la zone basse des reels
    sol: 1455,                                       // jonction du mur et du sol, pour le décor
    CADRE: { 1: { s: 4.0, x: [0.5] }, 2: { s: 3.1, x: [0.29, 0.71] }, 3: { s: 2.7, x: [0.18, 0.5, 0.82] } },
    TEXTE: { haut: 190, hauteur: 340, ecart: 110, marge: 80, max: 150, min: 64 },                 // narration
    BULLE: { haut: 140, marge: 56, padX: 52, padY: 34, rayon: 54, queue: 30, ecart: 96, hauteur: 320, largeurMin: 240, max: 150 }
  };
  const R_ENTREE = [14, 0.78], R_MOT = [30, 0.62], R_BULLE = [24, 0.7];
  const SVG = 'http://www.w3.org/2000/svg';

  const n2 = (v) => +v.toFixed(2);
  const svgDe = (src) => document.importNode(new DOMParser().parseFromString(src, 'image/svg+xml').documentElement, true);
  const morceau = (inner) => svgDe(`<svg xmlns="${SVG}"><g>${inner}</g></svg>`).firstElementChild;
  const d3 = (p) => 'M' + p.map((q) => q.join(' ')).join(' L');
  // petit saut du conteneur : monte sec, retombe en ressort
  const saut = (t0, amp) => M.track(0, [[t0, -amp, [60, 1]], [t0 + 0.07, 0, [20, 0.5]]]);

  /* Monte un strip dans un élément et renvoie son seek(t). */
  function monter(stage, DATA, cadrage) {
    const C = Object.assign({ W: DATA.W, H: DATA.H }, REEL, cadrage);
    const { W, H, SOL_Y, CADRE, TEXTE, BULLE } = C;
    stage.classList.add('scene');
    stage.style.width = W + 'px'; stage.style.height = H + 'px'; stage.style.background = DATA.fond;

    function personnage(c, cx, s) {
      const corps = Object.assign({ id: c.dent }, D.BODIES[c.dent]);
      const p = c.pose;
      const rendu = (surcharge) => svgDe(D.renderTooth(Object.assign({
        dent: c.dent, expression: null, effets: [], propG: null, propD: null,
        sourcils: p.sourcils, yeux: p.yeux, bouche: p.bouche, brasG: p.brasG, brasD: p.brasD, jambes: p.jambes, masque: p.masque
      }, surcharge || {})));
      const visageDe = (svg) => {
        const g = [...svg.firstElementChild.children].filter((n) => n.tagName === 'g');
        const attendu = p.masque === 'haut' ? 4 : 5;
        if (g.length !== 1 || g[0].children.length !== attendu) throw new Error('dents-strip : structure du visage inattendue pour ' + c.dent);
        return g[0];
      };

      const svg = rendu();
      const racine = svg.firstElementChild;
      const majs = [];

      // --- visage : un calque par valeur utilisée, on affiche celui du moment ---
      const visage = visageDe(svg);
      const aBouche = visage.children.length === 5;
      while (visage.firstChild) visage.removeChild(visage.firstChild);
      [['sourcils', 0, 2], ['yeux', 2, 4], ['bouche', 4, 5]].forEach(([canal, a, b]) => {
        if (canal === 'bouche' && !aBouche) return;
        const valeurs = [...new Set([p[canal]].concat(c.ch[canal].map((k) => k[1])))];
        const calques = valeurs.map((v) => {
          const g = document.createElementNS(SVG, 'g');
          [...visageDe(rendu({ [canal]: v })).children].slice(a, b).forEach((n) => g.appendChild(n));
          visage.appendChild(g);
          return [v, g];
        });
        const pas = M.step(p[canal], c.ch[canal]);
        majs.push((u) => { const v = pas(u); calques.forEach(([w, g]) => { g.style.display = w === v ? '' : 'none'; }); });
      });

      // --- bras : le trait existant passe d'une pose du catalogue à une autre, l'objet suit la main ---
      [['G', 0, 1], ['D', 1, -1]].forEach(([cote, i, m]) => {
        const nom = p['bras' + cote];
        if (!nom) return;
        const [ex, ey] = corps.epaules[i];
        const points = (pose) => D.BRAS[pose].d.map(([ax, ay]) => [ex + ax * m, ey + ay]);
        const p0 = points(nom);
        const trait = [...racine.children].find((n) => n.tagName === 'path' && n.getAttribute('d') === d3(p0));
        if (!trait) throw new Error('dents-strip : bras introuvable dans le dessin de ' + c.dent);
        const cles = c.ch['bras' + cote];
        const pistes = p0.map((q, k) => [0, 1].map((a) => M.track(q[a], cles.map(([t, pose]) => [t, points(pose)[k][a]]), M.FAST)));
        const pos = (u) => pistes.map((q) => [n2(q[0](u)), n2(q[1](u))]);
        if (cles.length) majs.push((u) => trait.setAttribute('d', d3(pos(u))));

        const objet = p['prop' + cote];
        if (!objet) return;
        const [hx, hy] = p0[2];
        const g = morceau(D.PROPS[objet](hx, hy));
        racine.appendChild(g);
        const vib = c.vib[cote], incl = M.track(0, c.incl[cote], M.FAST);
        if (!cles.length && !vib.length && !c.incl[cote].length) return;
        majs.push((u) => {
          const main = pos(u)[2];
          let dx = main[0] - hx, dy = main[1] - hy, rot = incl(u);
          vib.forEach(([t0, d]) => {
            const v = u - t0;
            if (v < 0 || v > d) return;
            const env = Math.sin(Math.PI * M.clamp(v / d)) ** 0.6;
            rot += 9 * env * Math.sin(2 * Math.PI * 19 * v);
            dx += 1.6 * env * Math.sin(2 * Math.PI * 19 * v + 1.3);
          });
          g.setAttribute('transform', `translate(${n2(dx)} ${n2(dy)}) rotate(${n2(rot)} ${hx} ${hy})`);
        });
      });

      // --- jambes : remplacement du tracé par un autre tracé du catalogue ---
      if (c.ch.jambes.length) {
        const pas = M.step(p.jambes, c.ch.jambes);
        [[0, -1], [1, 1]].forEach(([i, cote]) => {
          const h = corps.hanches[i];
          const trait = [...racine.children].find((n) => n.tagName === 'path' && n.getAttribute('d') === D.JAMBES[p.jambes](h, cote));
          if (!trait) throw new Error('dents-strip : jambe introuvable dans le dessin de ' + c.dent);
          majs.push((u) => trait.setAttribute('d', D.JAMBES[pas(u)](h, cote)));
        });
      }

      // --- effets : calques de la bibliothèque, allumés ou éteints ---
      Object.keys(c.fx).forEach((nom) => {
        const src = D.EFFETS[nom](corps);
        if (!src) return;
        const g = morceau(src);
        racine.appendChild(g);
        const pas = M.step(0, c.fx[nom]);
        majs.push((u) => { g.style.display = pas(u) ? '' : 'none'; });
      });

      // --- conteneur : c'est lui seul qui se déplace (entrée, sursaut), jamais le corps ---
      const el = document.createElement('div');
      el.className = 'perso';
      el.style.width = 200 * s + 'px'; el.style.height = 260 * s + 'px';
      el.style.left = cx - 100 * s + 'px'; el.style.top = SOL_Y - SOL * s + 'px';
      el.appendChild(svg);
      const horsChamp = H - (SOL_Y - SOL * s) + 40;
      const sauts = c.sursauts.map((t) => saut(t, 30));
      if (c.entree === 'saut') sauts.push(saut(0, 20));
      majs.push((u) => {
        let y = c.entree === 'ressort' ? (1 - M.S(u - c.retard, R_ENTREE[0], R_ENTREE[1])) * horsChamp : 0;
        sauts.forEach((f) => { y += f(u); });
        el.style.transform = `translateY(${y.toFixed(2)}px)`;
      });
      return { el, cx, tete: SOL_Y - (SOL - corps.haut) * s, visage: SOL_Y - (SOL - corps.visage.y) * s, maj: (u) => majs.forEach((f) => f(u)) };
    }

    // --- une case = un plan : les personnages, puis le bloc de texte (bulle si quelqu'un parle, cartouche sinon) ---
    const cases = DATA.cases.map((c) => {
      const el = document.createElement('div');
      el.className = 'case';
      const cadre = CADRE[c.places];
      // décor de la bibliothèque, ton sur ton, à l'échelle des personnages de la case
      // le monde de la case (décor et personnages) tient dans un calque à part : un plan dramatique le recadre d'un bloc
      const monde = document.createElement('div');
      monde.className = 'monde'; el.appendChild(monde);
      if (window.Decors && c.decor && c.decor !== 'aucun') monde.insertAdjacentHTML('afterbegin', window.Decors.rendre(c.decor, {
        W, H, sol: C.sol, u: cadre.s, fond: DATA.fond, pieds: TEXTE.cartouche ? c.persos.map((p) => W * cadre.x[p.place]) : [], piedY: SOL_Y,
        tetes: TEXTE.cartouche ? c.persos.map((p) => ({ x: W * cadre.x[p.place], h: SOL - D.BODIES[p.dent].haut })) : []
      }));
      const persos = c.persos.map((p) => {
        const o = personnage(p, W * cadre.x[p.place], cadre.s);
        monde.appendChild(o.el);
        return o;
      });
      // plan dramatique : gros plan sur un visage, décor éteint, tout le reste dans le noir
      let bande = null;
      if (c.plan === 'drame') {
        el.classList.add('drame');
        const qui = persos[c.voix != null ? c.voix : 0];
        const Z = M.clamp(0.3 * H / (62 * cadre.s), 1.3, 2.6);
        monde.style.transformOrigin = '0 0';
        monde.style.transform = `translate(${n2(W / 2 - Z * qui.cx)}px, ${n2(0.4 * H - Z * qui.visage)}px) scale(${n2(Z)})`;
        const nuit = document.createElement('div');
        nuit.className = 'nuit'; el.appendChild(nuit);
        bande = document.createElement('div');
        bande.className = 'bande';
      }
      const bloc = document.createElement('div');
      bloc.className = 'bloc';
      let trace = null;
      if (bande) bloc.appendChild(bande);
      else if (c.voix != null || TEXTE.cartouche) {
        const svg = document.createElementNS(SVG, 'svg');
        svg.setAttribute('class', 'bulle'); svg.setAttribute('width', W); svg.setAttribute('height', H);
        // ombre portée pleine, décalée : la bulle se détache du décor
        const ombre = document.createElementNS(SVG, 'path');
        ombre.setAttribute('class', 'ombre'); ombre.setAttribute('transform', 'translate(11 13)');
        trace = document.createElementNS(SVG, 'path');
        svg.append(ombre, trace); bloc.appendChild(svg);
        if (c.voix == null) bloc.classList.add('recit');
      }
      const txt = document.createElement('div');
      txt.className = 'txt';
      const mots = c.texte.map((w, i) => {
        const sp = document.createElement('span');
        sp.className = 'mot'; sp.textContent = w.m;
        if (i) txt.appendChild(document.createTextNode(' '));
        txt.appendChild(sp);
        return { sp, t: w.t };
      });
      bloc.appendChild(txt); el.appendChild(bloc); stage.appendChild(el);
      return { c, el, bloc, txt, mots, persos, trace, bande };
    });

    // taille du texte : la plus grande qui tient, mesurée avec la vraie police ; la bulle épouse le texte
    let calibre = false;
    const ajuster = (txt, mots, hMax, max) => {
      let f = max;
      for (; f > TEXTE.min; f -= 2) {
        txt.style.fontSize = f + 'px';
        if (txt.offsetHeight <= hMax && mots.every((m) => m.sp.offsetWidth <= txt.clientWidth)) break;
      }
      txt.style.fontSize = f + 'px';
    };
    const emprise = (mots) => ({
      xs: Math.min(...mots.map((m) => m.sp.offsetLeft)), xe: Math.max(...mots.map((m) => m.sp.offsetLeft + m.sp.offsetWidth)),
      ys: Math.min(...mots.map((m) => m.sp.offsetTop)), ye: Math.max(...mots.map((m) => m.sp.offsetTop + m.sp.offsetHeight))
    });
    const calibrer = () => {
      const pret = document.fonts.check('900 100px Geist');
      cases.forEach(({ c, el, bloc, txt, mots, persos, trace, bande }) => {
        if (!mots.length) return;
        const vu = el.style.display; el.style.display = '';
        if (bande) {
          // plan dramatique : le texte en capitales dans un bandeau noir, en bas de la case
          const lt = W - 140, pad = Math.round(0.03 * H);
          txt.style.left = (W - lt) / 2 + 'px'; txt.style.top = '0px'; txt.style.width = lt + 'px';
          ajuster(txt, mots, 0.2 * H, 150);
          const h = txt.offsetHeight + 2 * pad, y0 = Math.round(0.9 * H - h);
          bande.style.top = y0 + 'px'; bande.style.height = h + 'px'; txt.style.top = y0 + pad + 'px';
          el.style.display = vu;
          return;
        }
        const sommet = Math.min(...persos.map((p) => p.tete));
        if (c.voix == null) {
          // narration : en haut, mais jamais loin des têtes quand les personnages sont petits
          const haut = Math.max(TEXTE.haut, sommet - TEXTE.ecart - TEXTE.hauteur);
          const h = Math.min(TEXTE.hauteur, sommet - 40 - haut);
          const lt = Math.min(W - 2 * TEXTE.marge, TEXTE.largeur || W), gt = (W - lt) / 2;
          txt.style.left = gt + 'px'; txt.style.top = '0px'; txt.style.width = lt + 'px';
          ajuster(txt, mots, h, TEXTE.max);
          if (!trace) txt.style.top = haut + (h - txt.offsetHeight) / 2 + 'px';
          else {                                       // cartouche de BD : boîte au cordeau, collée en haut
            const { xs, xe, ys, ye } = emprise(mots), r = TEXTE.rayon;
            const x0 = n2(gt + xs - TEXTE.padX), x1 = n2(gt + xe + TEXTE.padX), y0 = haut, y1 = n2(haut + ye - ys + 2 * TEXTE.padY);
            txt.style.top = y0 + TEXTE.padY - ys + 'px';
            trace.setAttribute('d', `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1}` +
              ` H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`);
            bloc.style.transformOrigin = `${(x0 + x1) / 2}px ${(y0 + y1) / 2}px`;
            bloc.style.transform = 'rotate(-1.4deg)';                  // cartouche posé un peu de travers, comme une étiquette
          }
        } else {
          const qui = persos[c.voix], bas = sommet - BULLE.ecart;
          txt.style.left = txt.style.top = '0px'; txt.style.width = Math.min(W - 2 * (BULLE.marge + BULLE.padX), BULLE.largeur || W) + 'px';
          ajuster(txt, mots, Math.min(BULLE.hauteur, bas - BULLE.haut - 2 * BULLE.padY), BULLE.max);
          const { xs, xe, ys, ye } = emprise(mots);
          const l = Math.max(BULLE.largeurMin, xe - xs + 2 * BULLE.padX), h = ye - ys + 2 * BULLE.padY;
          const cx = M.clamp(M.lerp(W / 2, qui.cx, 0.5), BULLE.marge + l / 2, W - BULLE.marge - l / 2);
          const x0 = n2(cx - l / 2), x1 = n2(cx + l / 2), y1 = n2(bas), y0 = n2(bas - h), r = Math.min(BULLE.rayon, h / 2);
          txt.style.left = cx - (xs + xe) / 2 + 'px'; txt.style.top = y0 + BULLE.padY - ys + 'px';
          const q = BULLE.queue, tx = n2(M.clamp(M.lerp(cx, qui.cx, 0.8), x0 + r + q, x1 - r - q)), px = n2(qui.cx), py = n2(qui.tete - 24);
          trace.setAttribute('d', `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1}` +
            ` H${tx + q} Q${n2(tx + q * 0.35)} ${n2(y1 + (py - y1) * 0.6)} ${px} ${py} Q${n2(tx - q * 0.75)} ${n2(y1 + (py - y1) * 0.45)} ${tx - q} ${y1} H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`);
          bloc.style.transformOrigin = `${px}px ${py}px`;
        }
        if (trace) trace.previousSibling.setAttribute('d', trace.getAttribute('d') || '');
        el.style.display = vu;
      });
      calibre = pret;
    };
    document.fonts.load('900 100px Geist').then(calibrer);

    return (t) => {
      if (!calibre) calibrer();
      t = M.clamp(t, 0, DATA.T - 1e-4);
      cases.forEach(({ c, el, bloc, mots, persos }) => {
        const u = t - c.t0;
        if (u < 0 || u >= c.duree) { el.style.display = 'none'; return; }
        el.style.display = '';
        if (c.voix != null && c.plan !== 'drame') {
          bloc.style.visibility = u < c.tBulle ? 'hidden' : '';
          bloc.style.transform = `scale(${(0.6 + 0.4 * M.S(u - c.tBulle, R_BULLE[0], R_BULLE[1])).toFixed(4)})`;
        }
        mots.forEach(({ sp, t: tm }) => {
          if (u < tm) { sp.style.visibility = 'hidden'; return; }
          const a = M.S(u - tm, R_MOT[0], R_MOT[1]);
          sp.style.visibility = '';
          sp.style.transform = `translateY(${((1 - a) * 0.22).toFixed(4)}em) scale(${(0.86 + 0.14 * a).toFixed(4)})`;
        });
        persos.forEach((p) => p.maj(u));
      });
    };
  }
  window.DentsScene = monter;

  // --- page d'un strip animé : même contrat que les clips du moteur ---
  const stage = document.getElementById('stage'), DATA = window.STRIP;
  if (!stage || !DATA) return;
  const wrap = document.getElementById('wrap');
  wrap.style.width = DATA.W + 'px'; wrap.style.height = DATA.H + 'px';
  const seek = monter(stage, DATA);
  window.seek = seek; window.DURATION = DATA.T;

  const RENDER = location.search.includes('render');
  document.body.classList.add(RENDER ? 'render' : 'preview');
  seek(0);
  if (!RENDER) {
    const fit = () => { const k = Math.min(innerWidth / DATA.W, innerHeight / DATA.H); wrap.style.transform = `translate(-50%,-50%) scale(${k})`; };
    fit(); addEventListener('resize', fit);
    const t0 = performance.now();
    const loop = () => { seek(((performance.now() - t0) / 1000) % (DATA.T + 0.6)); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
})();
