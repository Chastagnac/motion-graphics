---
name: dents-strip
description: Transforme un JSON de strip « Les Dents du Cabinet » en planche de BD (image 4:5), en carrousel (une image par case) et, si demandé, en reel animé (MP4 vertical 1080 x 1920), avec une page de relecture où commenter chaque case. À utiliser quand on demande de dessiner, rendre, animer ou corriger un strip ou une série, ou quand l'utilisateur dit que ses commentaires sont prêts.
---

# dents-strip

Un fichier JSON de strip entre. Il en sort une planche de BD, un carrousel, et si on le demande une
vidéo de 8 à 12 secondes. Le dessin vient uniquement de `dents-du-cabinet/dents.js`, le temps et le
rendu vidéo viennent du moteur `motion-broll` (`engine/motion.js`, `engine/render.js`). Aucun modèle
d'image ou de vidéo n'intervient : tout est du SVG capturé par Chromium.

**Par défaut, le script livre des images.** L'utilisateur a demandé des planches de BD à la place
des vidéos le 6 octobre 2026. N'ajoute `--video` que s'il le demande.

## Règles à ne jamais enfreindre

1. **Ne modifie jamais un personnage existant de `dents.js`.** Leur stabilité est la règle numéro un.
   Le skill appelle `renderTooth()` et trie ses calques, il ne redessine rien. Un nouveau personnage
   ou un nouveau décor ne s'ajoute que si l'utilisateur le demande (l'assistante et `decors.js` l'ont
   été le 6 octobre 2026), sans toucher aux autres : exporte `node build.js <dossier>` avant et après,
   et vérifie avec `diff -r` que les SVG existants sont identiques.
   Le 8 octobre 2026, à sa demande, tous les personnages ont reçu des mains, des chaussures, des joues
   et une ombre sur le corps. Mains et chaussures sont des marqueurs SVG au bout des traits : les tracés
   des bras et des jambes sont inchangés, `scene.js` les retrouve toujours. Chaque dessin numérote ses
   propres marqueurs, car Chromium n'affiche pas un marqueur défini dans une case cachée.
   La vérification est automatique : `node dents-du-cabinet/verifier.js` redessine chaque personnage
   dans chaque expression et le compare à `svg/`. Lance le avant et après toute retouche de `dents.js`.
   Après un changement voulu par l'utilisateur, et seulement là : `node dents-du-cabinet/verifier.js --accepter`.
2. **N'invente aucune pièce.** Si une valeur de pose ou d'animation n'est pas dans `catalogue.json`,
   le script s'arrête et le dit. Signale le à l'utilisateur avec la liste des valeurs possibles, ne
   contourne pas.
3. **Textes** : jamais les mots logiciel, application, IA, automatique ni leurs dérivés, et pas de
   tiret cadratin. Le compte parle du quotidien du cabinet, jamais d'un produit. Le script vérifie
   `titre`, `texte` et `legende`.
4. **Format** : planche et carrousel en 4:5 (2160 x 2700) ; vidéo en 1080 x 1920, 30 i/s, 8 à 12 s.

## Installation (une fois)

Il faut Node 18+, ffmpeg, et Playwright dans `./motion` (dossier ignoré par git) :

```bash
mkdir -p motion && cd motion && echo '{"private":true}' > package.json && npm install playwright && npx playwright install chromium
```

Le script trouve tout seul le moteur (`skills/motion-broll/engine`) et la bibliothèque (le dossier du
JSON, sinon `./dents-du-cabinet`). Si la disposition diffère : `--moteur`, `--bibliotheque`, `--playwright`.

## Rendre un strip

```bash
# toute une série : planche + carrousel pour chaque JSON du dossier, quelques secondes par strip
node .claude/skills/dents-strip/scripts/strip.js dents-du-cabinet/series/cote-fauteuil

# un seul strip, avec la vidéo en plus (2 à 4 min)
node .claude/skills/dents-strip/scripts/strip.js dents-du-cabinet/exemple-carrousel.json --video
```

Plusieurs fichiers peuvent être passés d'un coup : ils sont tous validés avant le premier rendu.
Pour les vidéos d'une série entière, lance 3 ou 4 commandes en parallèle avec chacune sa part des fichiers.
Sorties dans `dents-du-cabinet/rendus/<id>/` :

| Fichier | Rôle |
|---|---|
| `<id>-planche.png` | la planche de BD : toutes les cases dans une image 4:5 (2160 x 2700, le double de 1080 x 1350) |
| `carrousel/<id>-N.png` | les images du carrousel, 1 à 4 cases chacune selon le champ `carrousel` |
| `<id>.mp4` | la vidéo, seulement avec `--video` |
| `<id>.html` | la page animée, à ouvrir dans un navigateur pour un aperçu en boucle |
| `apercus/caseN.png` | avec `--video` : image de fin de chaque plan, plus une par micro animation |
| `viewer.html` | page de relecture avec un champ de commentaire par case |

Avant de montrer un rendu, regarde la planche (et `apercus/` pour une vidéo) : texte lisible et entier,
objet bien dans la main, rien qui chevauche le visage ou sort de la case.

### Planche, carrousel et décor

- **Planche** : toutes les cases dans une image (6 au maximum).
- **Carrousel** : le champ `carrousel` du strip donne le nombre de cases de chaque image, de 1 à 4,
  par exemple `[1, 2, 1]`. La somme doit égaler le nombre de cases. Sans ce champ, une case par image.
  Choisis le découpage selon l'histoire : une case seule pour une ouverture ou une chute, deux pour
  un échange, trois ou quatre pour un rythme rapide. Varie d'un strip à l'autre.
- **Formes des pages** : 1 case pleine page, 2 cases empilées, 3 cases (deux en haut, une large en
  bas), 4 cases en carré. La planche de 5 ou 6 cases passe sur 3 rangs.
- Chaque case montre la **dernière image** de son plan : pose finale après les micro animations,
  réplique entière. Une animation passagère (clignement, gorgée) ne se voit pas sur une image fixe.
- Celui qui parle a une bulle blanche à queue courbe, la narration (case sans `voix`) un cartouche
  jaune pâle, rectangulaire et posé légèrement de travers. Les deux ont une ombre portée noire.
- **Décor** : champ `decor` sur le strip, ou sur une case pour en changer. Valeurs de
  `dents-du-cabinet/decors.js` : `cabinet` (salle de soins, valeur par défaut), `accueil`,
  `soiree` (hors du cabinet), `reunion` (salle de réunion), `sol` (mur et sol nus), `aucun`. Les décors sont des
  aplats ton sur ton dans la couleur de la série, sans contour, pour laisser le trait noir aux personnages.
  Sur les images fixes, chaque personnage a une ombre au sol.
- **Plan dramatique** : `"plan": "drame"` sur une case (ou `; plan=drame` dans la mise en scène). Gros plan
  sur celui qui parle, ou sur le premier personnage ; décor éteint, tout le reste dans le noir, texte en
  capitales rouges dans un bandeau noir. À garder pour une chute ou un regard noir : une fois par
  histoire au plus, et pas dans toutes.
  Sur une image fixe, un petit objet accroché au mur (l'horloge et l'étagère de l'accueil) s'efface
  quand il tombe derrière une tête : il ne doit jamais sembler sortir d'un crâne.
- **Accroche et légende** (carrousel seulement) : le champ `accroche` du strip s'affiche en grand
  au-dessus de la première image, le champ `legende` dans un bandeau noir sous la dernière. La planche
  ne porte ni l'un ni l'autre. L'accroche donne le sujet et l'enjeu en 8 mots au plus, sans la chute
  (« 8h04. Trois demandes. Une seule personne. ») : c'est elle qui arrête le pouce dans le fil.
- Titre du strip en bas à gauche (avec le numéro de l'image pour un carrousel), « Les Dents du
  Cabinet » en bas à droite.
- La mise en page se règle dans `scripts/planche.js`.

## Format JSON

Le format du carrousel, plus quelques ajouts par case : `duree`, `animations`, et au besoin `voix`,
`depart`, `place`.

```json
{
  "id": "S1-lundi", "serie": "STRIP", "titre": "Lundi 8h01",
  "accroche": "Lundi, 8h01. Deux lignes, un café.",
  "slides": [
    {
      "texte": "Le téléphone sonne.",
      "duree": 2.4,
      "voix": "incisive",
      "personnages": [
        {
          "dent": "incisive", "expression": "regard_camera", "brasD": "tient", "propD": "cafe",
          "depart": { "expression": "content" },
          "animations": ["sursaut à 0.5s", "expression:regard_camera à 0.5s", "clignement à 1.5s"]
        }
      ]
    }
  ],
  "legende": "Combien d'appels avant 9h chez vous ?"
}
```

- `serie` choisit le fond : strip `#A8E0D2`, vecu `#FFB3A7`, irritant `#B9C8FF`, fiche `#FFC9E3`, quiz `#FFD84D`.
- `duree` : secondes du plan vidéo (1 à 6). Facultatif : sans lui, la durée est calculée sur la
  longueur de la réplique. Le total de 8 à 12 s n'est exigé qu'avec `--video`.
- La pose écrite dans le personnage reste la **pose clé**, celle du carrousel fixe. `depart` surcharge
  quelques champs au début du plan, pour qu'une animation amène ensuite à la pose clé.
- `entree` (optionnel) : `ressort` (arrive par le bas), `saut` (petit rebond au changement de plan),
  `aucune`. Par défaut : `ressort` à la première apparition, `saut` si le personnage était déjà là.
- `voix` (optionnel, sur la case) : le personnage qui parle. Le texte passe alors dans une bulle
  blanche dont la queue pointe sur lui, et sa bouche s'ouvre à chaque mot (calque `ouverte` du
  catalogue). Sans `voix`, le texte est une narration posée en haut, sans bulle.
- 1 à 3 personnages par case, placés de gauche à droite dans l'ordre de la liste. Pour garder un
  personnage à sa place quand il est seul avant l'arrivée d'un autre : `"places": 2` sur la case et
  `"place": 1` sur le personnage.
- Quand il y a une bulle, seul celui qui parle fait le petit saut au changement de plan.
- Une réplique tient en 8 mots environ. Au-delà le texte rétrécit et le script prévient.

### Micro animations

Une chaîne par animation : `cible:valeur à 1.2s`, avec en option `pendant 0.5s` pour revenir ensuite
à l'état précédent. Le temps est compté depuis le début de la case.

| Écriture | Effet |
|---|---|
| `sourcil:leve à 1.2s` | remplace le calque des sourcils (valeurs : `sourcils` du catalogue) |
| `yeux:cote à 1s`, `bouche:ouverte à 1s` | remplace le calque des yeux ou de la bouche |
| `expression:panique à 1.5s` | remplace les trois calques du visage et allume les effets de l'expression |
| `clignement à 0.9s` | yeux en `plisses` pendant 0,12 s |
| `brasG:leve à 1s`, `brasD:salut à 1s` | le bras passe à une autre pose du catalogue, l'objet suit la main |
| `prop:cafe:gorgee à 2s` | le bras qui tient le café monte en `croise`, la tasse s'incline, puis retour |
| `prop:telephone:vibre à 1.4s pendant 1.2s` | l'objet tenu tremble sur place (tout objet du catalogue) |
| `effet:choc à 0.4s pendant 1s` | allume un effet du catalogue (`sueur`, `choc`, `zzz`) |
| `jambes:tremble à 1s` | remplace le tracé des jambes |
| `sursaut à 0.5s` | petit saut de tout le personnage |

Le visage change toujours par remplacement de calque. Le corps n'est jamais déformé : seul le conteneur
du personnage se déplace (entrée, saut), et seuls les bras et les objets bougent à l'intérieur.

Limites connues à signaler plutôt qu'à contourner :

- le catalogue n'a pas d'œil fermé, le clignement emprunte `plisses` ;
- aucun objet ne peut être posé ou lâché en cours de case ;
- la gorgée ne marche que sur les dents. Sur un dentiste aucune pose de bras n'amène la tasse à la
  bouche : le script refuse, utilise `brasD:salut` pour lever la tasse ;
- les personnages sont de face, ils ne se tournent pas l'un vers l'autre. Un bras `pointe` côté
  intérieur touche le voisin : vérifie sur les images de contrôle.

## Écrire une série

Les strips d'une série vivent dans `dents-du-cabinet/series/<nom>/`, un JSON par strip. Séries
existantes :

| Série | Identifiants | Contenu |
|---|---|---|
| `cote-fauteuil` | `F01` à `F24` | le quotidien vu par les dentistes, gags en 4 cases |
| `petites-histoires` | `H01` à `H08` | de vraies petites histoires, 9 ou 10 pages |
| `situations-du-cabinet` | `C01` à `C16` | une douleur du cabinet par histoire, 8 pages, avec accroche et message final |

Les trois ont leur texte dans `histoires/` et leur mise en scène dans `mises-en-scene/` (voir plus bas).
Pour produire en nombre : un JSON par histoire, sans `duree` ni `animations`, puis une seule commande sur le dossier.

Recette qui marche, tirée des références du dossier `assets/` (duos de caractères opposés, bulles
courtes, chute pince-sans-rire) :

- 4 cases, 5 au maximum, une seule réplique par case ;
- un duo par strip, aux tempéraments fixes : docteure (maline, blasée), docteur (bonne pâte),
  collaborateur (anxieux), assistante (humaine, efficace, pince-sans-rire, celle qui fait
  tourner le cabinet), incisive (accueil, blasée, café), canine (assistante, vive), molaire
  (cheffe, juge), dent de lait (le patient, paniqué), dent de sagesse (invitée rare) ;
- la chute est une réplique plate dite sans émotion, pendant que l'autre personnage passe en
  `regard_camera` ou cligne des yeux ;
- fond `irritant` pour ce qui agace (retards, lapins, avis, labo), `vecu` pour les moments partagés ;
- la `legende` pose une question qui appelle un commentaire.

On s'inspire du mécanisme des références, jamais de leurs personnages ni de leurs gags.

## Histoires longues : le texte d'abord

L'utilisateur travaille l'écriture, les personnages et les décors comme trois chantiers séparés.
Une histoire longue (9 ou 10 pages de carrousel) s'écrit donc en deux fichiers, puis se compile :

| Fichier | Contenu |
|---|---|
| `dents-du-cabinet/histoires/<serie>.md` | le texte seul : pages, répliques, narration, légende, et une ligne `L'accroche : …` facultative. C'est là qu'on corrige l'écriture. |
| `dents-du-cabinet/mises-en-scene/<serie>.txt` | une ligne par case : qui est là, quelle expression, quelle pose, quel décor. La syntaxe est en tête du fichier. |

```bash
node .claude/skills/dents-strip/scripts/histoire.js dents-du-cabinet/histoires/petites-histoires.md dents-du-cabinet/mises-en-scene/petites-histoires.txt
node .claude/skills/dents-strip/scripts/strip.js dents-du-cabinet/series/petites-histoires
```

`histoire.js` écrit un JSON par histoire dans `series/<serie>/` ; ne corrige pas ces JSON à la main,
corrige la source et relance. Au-delà de 6 cases il n'y a plus de planche unique, seulement le carrousel.
Ne passe à la mise en scène qu'une fois le texte validé.

## Boucle de commentaires

1. Lance le serveur de relecture en tâche de fond et donne le lien à l'utilisateur :

   ```bash
   node .claude/skills/dents-strip/scripts/commentaires.js dents-du-cabinet/rendus
   ```

   `http://localhost:4173/` montre tous les strips avec un commentaire général par strip ;
   `http://localhost:4173/<id>/viewer.html` permet de commenter case par case. Chaque frappe est
   enregistrée dans `rendus/<id>/commentaires.json`. (Ouverte en double clic, sans serveur, la page propose de
   télécharger ce fichier : il faut alors le déposer dans `rendus/<id>/`.)

2. Quand l'utilisateur dit que ses commentaires sont prêts :
   - lis **tous** les `rendus/*/commentaires.json` (`general` et chaque `cases[].commentaire`) ;
   - corrige les JSON des strips concernés (le champ `source` donne le chemin) : textes, durées,
     poses, animations. Ne touche ni à `dents.js` ni au skill pour satisfaire un commentaire de contenu ;
   - si un commentaire demande une pièce absente du catalogue, ne l'invente pas : garde la demande
     pour le compte rendu ;
   - relance tout en **une seule commande**, avec tous les fichiers modifiés :

     ```bash
     node .claude/skills/dents-strip/scripts/strip.js <a.json> <b.json> --clore-commentaires
     ```

     `--clore-commentaires` archive les commentaires traités dans `historique/` pour que la page
     reparte vierge. Ajoute `--video` seulement si l'utilisateur veut aussi les vidéos : sans lui,
     un MP4 déjà présent n'est plus proposé dans les pages de relecture car il date d'avant.
3. Regarde les nouvelles planches, puis résume à l'utilisateur ce qui a changé case par case et ce
   qui n'a pas pu être fait.

## Comment c'est branché

- `scripts/compile.js` valide le JSON contre `catalogue.json` et le transforme en clés temporelles.
- `scripts/strip.js` assemble une page autonome (`motion.js` + `dents.js` + `runtime/scene.js` + police
  Geist du moteur), capture les images de contrôle, puis appelle `engine/render.js` tel quel : 4
  sous-images par image, fondues par ffmpeg en flou de mouvement.
- `runtime/scene.js` expose `window.seek(t)` et `window.DURATION`, comme tout clip du moteur. Chaque
  image est une fonction pure du temps (`M.S`, `M.track`, `M.step`), sans transition CSS ni minuteur.
- La planche réutilise cette même scène : `runtime/planche.js` la monte une fois par case
  (`DentsScene(element, donnees, cadrage)`), figée sur la fin du plan, avec le cadrage calculé par
  `scripts/planche.js` selon la forme de la case. Images et vidéo partagent donc poses, bulles et textes.
- Cadrage et rythme du reel se règlent en tête de `runtime/scene.js` (`REEL`, ressorts).

## Galerie en ligne (Vercel)

`vercel.json` fait construire à Vercel une galerie statique à chaque `git push` :

```bash
node .claude/skills/dents-strip/scripts/site.js dents-du-cabinet/rendus site
```

Elle reprend la vue d'ensemble (clic sur une image pour la voir en grand, flèches, « Télécharger » en
pleine taille), sans les commentaires, qui ont besoin du serveur local `commentaires.js`. Vercel ne
rend rien lui même : il publie les images suivies par git. Après un rendu, il faut donc commiter les
PNG de `rendus/` et pousser pour que le site change. La galerie demande aux moteurs de recherche de
ne pas l'indexer, mais son adresse reste ouverte à qui la connaît.

## Tests et suivi git

```bash
node --test .claude/skills/dents-strip/tests/dents-strip.test.js
```

Sans navigateur, quelques secondes. Les tests couvrent la validation (mots interdits, pièces hors
catalogue, découpage), la mise en page, `histoire.js`, et vérifient que tous les JSON de `series/`
se compilent, qu'ils correspondent à leur source dans `histoires/`, et qu'aucun personnage n'a changé.
Lance les après toute retouche du skill ou de la bibliothèque.

Dans `rendus/`, git ne suit que les images (planche, carrousel), `infos.json` et les commentaires.
Les pages HTML et les MP4 sont ignorés : ils se régénèrent avec `strip.js`.
