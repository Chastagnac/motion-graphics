/*
 * dents-strip : images fixes. Chaque case du strip est montée par la même scène que la vidéo,
 * figée sur sa dernière image (pose finale, réplique entière), puis rangée dans sa page :
 * la planche (toutes les cases) et les pages du carrousel (1 à 4 cases chacune).
 */
(function () {
  const P = window.PLANCHE, DATA = window.STRIP;
  const figes = [];
  const carrousel = P.pages.filter((p) => p.id !== 'planche').length;

  P.pages.forEach((p) => {
    const page = document.createElement('div');
    page.className = 'planche'; page.id = 'page-' + p.id;
    page.style.width = P.W + 'px'; page.style.height = P.H + 'px';
    p.cellules.forEach((cel) => {
      const c = DATA.cases[cel.index];
      const v = document.createElement('div');
      v.className = 'vignette';
      Object.assign(v.style, { left: cel.x + 'px', top: cel.y + 'px', width: cel.l + 'px', height: cel.h + 'px' });
      const scene = document.createElement('div');
      v.appendChild(scene); page.appendChild(v);
      const seek = window.DentsScene(scene, DATA, cel.cadrage);
      scene.style.transform = `scale(${cel.cadrage.echelle})`;
      figes.push(() => seek(c.t0 + c.duree - 0.02));
    });
    // textes hors case : l'accroche au-dessus de la première image, la question sous la dernière
    [['accroche', 92, 44], ['question', 56, 30]].forEach(([nom, max, min]) => {
      const b = p[nom];
      if (!b) return;
      const boite = document.createElement('div'), texte = document.createElement('span');
      boite.className = 'bande-' + nom; texte.textContent = b.texte.replace(/'/g, '’');
      Object.assign(boite.style, { left: b.x + 'px', top: b.y + 'px', width: b.l + 'px', height: b.h + 'px' });
      boite.appendChild(texte); page.appendChild(boite);
      figes.push(() => {
        const cs = getComputedStyle(boite);
        const hMax = b.h - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), lMax = b.l - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        let f = max;
        for (; f > min; f -= 2) { texte.style.fontSize = f + 'px'; if (texte.offsetHeight <= hMax && texte.scrollWidth <= lMax) break; }
        texte.style.fontSize = f + 'px';
      });
    });
    const pied = document.createElement('div');
    pied.className = 'pied';
    Object.assign(pied.style, { left: P.marge + 'px', right: P.marge + 'px', top: P.piedY + 'px', height: P.pied + 'px' });
    const gauche = document.createElement('span'), droite = document.createElement('span');
    gauche.textContent = DATA.titre + (p.id !== 'planche' && carrousel > 1 ? `  ${p.id.slice(1)}/${carrousel}` : '');
    droite.textContent = P.signature;
    pied.append(gauche, droite); page.appendChild(pied);
    document.body.appendChild(page);
  });

  const figer = () => figes.forEach((f) => f());
  figer();
  window.pret = document.fonts.load('900 100px Geist').then(() => document.fonts.ready).then(() => { figer(); return true; });
})();
