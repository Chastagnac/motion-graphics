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
