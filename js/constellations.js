// ===== constellations.js : appli Skills de l'ordinateur =====
// Un ciel horizontal où les skills sont dispersés. Une ligne relie un skill à son prérequis.
// Un tap sur un skill ouvre une fenêtre pop-up avec ses quêtes (ou son prix / ses prérequis).
//
// Utilise skills.js : skills, categories, getSkill, getCategorie, estDebloque, estMaitrise, estEnBoutique,
// prixSkill, prerequisAtteint, niveauSeuil, seuilPrerequis, idPrerequis, libellePrerequis,
// pourcentageSkill, soldeEclats, htmlQuetesSkill, acheterSkillUI, echapper.

let etoileSelectionnee = null;   // id du skill dont la pop-up est ouverte (il brille)
let positionPopup = null;
let deplacementPopup = null;

// ----- réglages de l'affichage (tu peux les modifier) -----
const RAYON = 2.7;               // taille des cercles dans le repère du ciel
const LARGEUR_NOM = 10;          // caractères max par ligne pour un nom

// ---------- états ----------
function etatSkill(skill) {
  if (estDebloque(skill)) return estMaitrise(skill) ? "maitrise" : "encours";
  if (estEnBoutique(skill)) return "boutique";
  return "verrouille";
}

// ---------- outils ----------
// Coupe un texte en lignes de `largeur` caractères, `max` lignes au maximum
function decouperTexte(texte, largeur, max) {
  const lignes = [];
  let courante = "";
  texte.split(" ").forEach(function(mot) {
    if (courante === "") courante = mot;
    else if ((courante + " " + mot).length <= largeur) courante += " " + mot;
    else { lignes.push(courante); courante = mot; }
  });
  if (courante !== "") lignes.push(courante);
  if (lignes.length > max) {
    lignes.length = max;
    lignes[max - 1] = lignes[max - 1].slice(0, largeur - 1) + "…";
  }
  return lignes;
}

function hashSkill(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 997;
  return hash;
}

// Petites étoiles de fond, toujours les mêmes
function fondEtoile(largeur, hauteur) {
  let graine = 4242;
  const suivant = function() {
    graine = (graine * 49297 + 233280) % 233280;
    return graine / 233280;
  };
  let svg = "";
  const nb = Math.round(largeur * hauteur / 300);
  for (let i = 0; i < nb; i++) {
    svg += `<circle cx="${(suivant() * largeur).toFixed(1)}" cy="${(suivant() * hauteur).toFixed(1)}" r="${(0.12 + suivant() * 0.3).toFixed(2)}" fill="#fff" opacity="${(0.15 + suivant() * 0.45).toFixed(2)}"/>`;
  }
  return svg;
}

// Regroupe les skills reliés puis intercale les constellations et les étoiles isolées.
function calculerCiel() {
  const pos = {};
  const voisins = new Map();
  skills.forEach(function(skill) { voisins.set(skill.id, new Set()); });
  skills.forEach(function(skill) {
    skill.prerequis.forEach(function(p) {
      const parent = getSkill(idPrerequis(p));
      if (!parent || parent.categorie !== skill.categorie) return;
      voisins.get(skill.id).add(parent.id);
      voisins.get(parent.id).add(skill.id);
    });
  });

  const visites = new Set();
  const elementsParCategorie = new Map();
  skills.forEach(function(skill) {
    if (visites.has(skill.id)) return;
    const ids = [];
    const pile = [skill.id];
    visites.add(skill.id);
    while (pile.length > 0) {
      const id = pile.pop();
      ids.push(id);
      voisins.get(id).forEach(function(voisin) {
        if (visites.has(voisin)) return;
        visites.add(voisin);
        pile.push(voisin);
      });
    }
    const groupeSkills = ids.map(getSkill);
    const cle = skill.categorie;
    if (!elementsParCategorie.has(cle)) elementsParCategorie.set(cle, []);
    elementsParCategorie.get(cle).push({
      id: ids.slice().sort().join("-"),
      categorie: cle,
      skills: groupeSkills,
      constellation: groupeSkills.length > 1
    });
  });

  elementsParCategorie.forEach(function(elements) {
    elements.sort(function(a, b) {
      return hashSkill(a.id) - hashSkill(b.id) || a.id.localeCompare(b.id);
    });
  });

  const categoriesOrdonnees = Array.from(elementsParCategorie.keys()).sort(function(a, b) {
    return hashSkill(a) - hashSkill(b) || a.localeCompare(b);
  });
  const elements = [];
  const dernieresCategories = [];
  const elementsPlacesParCategorie = new Map();
  while (true) {
    const candidates = categoriesOrdonnees.filter(function(categorie) {
      return elementsParCategorie.get(categorie).length > 0 &&
        !dernieresCategories.slice(-2).includes(categorie);
    });
    const choix = candidates.length > 0 ? candidates : categoriesOrdonnees.filter(function(categorie) {
      return elementsParCategorie.get(categorie).length > 0;
    });
    choix.sort(function(a, b) {
      const proportionA = (elementsPlacesParCategorie.get(a) || 0) / (elementsParCategorie.get(a).length + (elementsPlacesParCategorie.get(a) || 0));
      const proportionB = (elementsPlacesParCategorie.get(b) || 0) / (elementsParCategorie.get(b).length + (elementsPlacesParCategorie.get(b) || 0));
      return proportionA - proportionB;
    });
    const categorieChoisie = choix[0];
    if (!categorieChoisie) break;
    const element = elementsParCategorie.get(categorieChoisie).shift();
    elements.push(element);
    dernieresCategories.push(categorieChoisie);
    elementsPlacesParCategorie.set(
      categorieChoisie,
      (elementsPlacesParCategorie.get(categorieChoisie) || 0) + 1
    );
  }

  const ESPACEMENT = 110;
  elements.forEach(function(element, index) {
    const ancreX = 45 + index * ESPACEMENT;
    if (!element.constellation) {
      const skill = element.skills[0];
      pos[skill.id] = {
        x: ancreX + hashSkill(skill.id + "-x") % 35 - 17,
        y: 15 + hashSkill(skill.id + "-y") % 70
      };
      return;
    }

    const echelleX = element.categorie === "art" ? 2.8 : 1.6;
    const echelleY = element.categorie === "art" ? 1.4 : 1.1;
    const points = element.skills.map(function(skill) {
      return {
        skill: skill,
        x: 10 + (typeof skill.x === "number" ? skill.x : 20 + hashSkill(skill.id) % 60) * 0.8,
        y: 10 + (typeof skill.y === "number" ? skill.y : 20 + hashSkill(skill.id + "-y") % 60) * 0.8
      };
    });
    const centreX = points.reduce(function(total, point) { return total + point.x; }, 0) / points.length;
    const centreY = points.reduce(function(total, point) { return total + point.y; }, 0) / points.length;
    const variationY = (hashSkill(element.id + "-ancre") % 17) - 8;
    points.forEach(function(point) {
      pos[point.skill.id] = {
        x: ancreX + (point.x - centreX) * echelleX,
        y: 50 + variationY + (point.y - centreY) * echelleY
      };
    });
  });

  const positions = Object.keys(pos).map(function(id) { return pos[id]; });
  const yMin = Math.min.apply(null, positions.map(function(point) { return point.y; }));
  const yMax = Math.max.apply(null, positions.map(function(point) { return point.y; }));
  const margeHaut = 10;
  const margeBas = 24;
  positions.forEach(function(point) { point.y = point.y - yMin + margeHaut; });

  return {
    largeur: Math.max(100, 90 + elements.length * ESPACEMENT),
    hauteur: yMax - yMin + margeHaut + margeBas,
    pos: pos
  };
}

// ---------- affichage du ciel ----------
function afficherArbre() {
  const conteneur = document.getElementById("ordi-arbre");
  if (!conteneur) return;
  if (categories.length === 0 || skills.length === 0) {
    conteneur.innerHTML = "<h2>🌱 Skills</h2><p>Chargement…</p>";
    return;
  }
  const zoneDefilement = conteneur.querySelector(".constel-defilement");
  const defilement = zoneDefilement
    ? { gauche: zoneDefilement.scrollLeft, haut: zoneDefilement.scrollTop }
    : { gauche: 0, haut: 0 };
  const ciel = calculerCiel();

  let svg = `<svg class="constel-ciel" viewBox="0 0 ${ciel.largeur} ${ciel.hauteur}" role="img" aria-label="Ciel des skills">`;
  svg += `<defs><filter id="lueur" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="1.8"/></filter></defs>`;
  svg += fondEtoile(ciel.largeur, ciel.hauteur);

  // Liens courbes pour que les chemins des skills restent visuellement distincts.
  skills.forEach(function(skill) {
    skill.prerequis.forEach(function(p) {
      const parent = getSkill(idPrerequis(p));
      if (!parent || parent.categorie !== skill.categorie) return;
      const a = ciel.pos[parent.id];
      const b = ciel.pos[skill.id];
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const marge = RAYON + 1.8;
      const x1 = a.x + dx / dist * marge, y1 = a.y + dy / dist * marge;
      const x2 = b.x - dx / dist * marge, y2 = b.y - dy / dist * marge;
      const sens = hashSkill(parent.id + skill.id) % 2 === 0 ? 1 : -1;
      const courbure = sens * (3 + hashSkill(skill.id + parent.id) % 4);
      const cx = (x1 + x2) / 2 - dy / dist * courbure;
      const cy = (y1 + y2) / 2 + dx / dist * courbure;
      const cat = getCategorie(skill.categorie);
      svg += `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}" class="constel-ligne${prerequisAtteint(p) ? "" : " attente"}" style="stroke:${cat.couleur}"/>`;
    });
  });

  // skills
  skills.forEach(function(skill) {
    const p = ciel.pos[skill.id];
    if (!p) return;
    const cat = getCategorie(skill.categorie);
    const etat = etatSkill(skill);
    const selectionne = skill.id === etoileSelectionnee;

    svg += `<g class="constel-noeud ${etat}${selectionne ? " selectionne" : ""}" onclick="ouvrirEtoile('${skill.id}')">`;

    if (selectionne) {
      svg += `<circle cx="${p.x}" cy="${p.y}" r="${RAYON + 5}" fill="${cat.couleur}" opacity="0.55" filter="url(#lueur)"/>`;
      svg += `<circle cx="${p.x}" cy="${p.y}" r="${RAYON + 3}" class="constel-pulse" style="stroke:${cat.couleur}"/>`;
    }

    if (etat === "verrouille" || etat === "boutique") {
      svg += `<circle cx="${p.x}" cy="${p.y}" r="${RAYON}" class="constel-rond gris" style="stroke:${cat.couleur}"/>`;
    } else {
      svg += `<circle cx="${p.x}" cy="${p.y}" r="${RAYON}" class="constel-rond" style="fill:${cat.couleur}33;stroke:${cat.couleur}"/>`;
      if (etat === "maitrise") {
        svg += `<circle cx="${p.x}" cy="${p.y}" r="${RAYON + 1.5}" class="constel-anneau" style="stroke:${cat.couleur}"/>`;
      }
      svg += `<text class="constel-pct" x="${p.x}" y="${(p.y + 1.1).toFixed(2)}" style="fill:${selectionne ? "#fff" : "#e9fff8"}">${pourcentageSkill(skill)}%</text>`;
    }
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${RAYON + 2}" fill="transparent"/>`; // zone de tap plus large

    // Nom et sous-titre sous le cercle
    const nom = decouperTexte(skill.nom, LARGEUR_NOM, 3);
    svg += `<text class="constel-nom" x="${p.x}" y="${(p.y + RAYON + 3.8).toFixed(2)}">`;
    nom.forEach(function(l, i) {
      svg += `<tspan x="${p.x}" dy="${i === 0 ? 0 : 3.1}">${echapper(l)}</tspan>`;
    });
    if (etat === "boutique") {
      svg += `<tspan class="constel-sous" x="${p.x}" dy="3.3">à acheter</tspan>`;
    }
    svg += `</text></g>`;
  });

  svg += `</svg>`;
  conteneur.innerHTML = `
    <div class="constel-defilement" tabindex="0" aria-label="Ciel des skills défilant dans toutes les directions">${svg}</div>`;
  const nouvelleZoneDefilement = conteneur.querySelector(".constel-defilement");
  if (nouvelleZoneDefilement) {
    nouvelleZoneDefilement.scrollLeft = defilement.gauche;
    nouvelleZoneDefilement.scrollTop = defilement.haut;
  }

  majPopup();
}

// ---------- fenêtre pop-up ----------
function elementPopup() {
  let popup = document.getElementById("ordi-popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "ordi-popup";
    const ordi = document.getElementById("ordinateur");
    if (ordi) ordi.appendChild(popup);
  }
  return popup;
}

function htmlPopup(skill) {
  const cat = getCategorie(skill.categorie);
  const etat = etatSkill(skill);
  let corps = "";

  if (etat === "encours" || etat === "maitrise") {
    corps = htmlQuetesSkill(skills.indexOf(skill));
  } else if (etat === "boutique") {
    const prix = prixSkill(skill);
    corps = `
      <p>🛒 Ce skill s'achète avec des éclats.</p>
      <p>Prix : <strong>✨ ${prix}</strong> · Tu as : <strong>✨ ${soldeEclats()}</strong></p>
      <button onclick="acheterSkillUI('${skill.id}')" ${soldeEclats() < prix ? "disabled" : ""}>Acheter — ✨ ${prix}</button>
      <p class="popup-aide">Les éclats se gagnent en terminant les niveaux des autres skills.</p>`;
  } else {
    corps = `<p>🔒 Skill verrouillé. Il faut d'abord :</p><ul class="popup-prerequis">`;
    skill.prerequis.forEach(function(p) {
      corps += `<li>${prerequisAtteint(p) ? "✅" : "⬜"} ${echapper(libellePrerequis(p))}</li>`;
    });
    corps += `</ul>`;
  }

  return `
    <div class="popup-fond" onclick="if (event.target === this) fermerPopupSkill()">
      <div class="popup-skill" style="border-top-color:${cat.couleur}${positionPopup ? `;left:${positionPopup.left}px;top:${positionPopup.top}px;transform:none` : ""}">
        <div class="popup-entete" onpointerdown="deplacerPopup(event)">
          <h3>${cat.icone} ${echapper(skill.nom)}</h3>
          <button class="popup-fermer" onclick="fermerPopupSkill()" aria-label="Fermer">✖</button>
        </div>
        ${corps}
      </div>
    </div>`;
}

// Affiche ou cache la pop-up selon etoileSelectionnee
function majPopup() {
  const popup = elementPopup();
  const skill = etoileSelectionnee ? getSkill(etoileSelectionnee) : null;
  popup.innerHTML = skill ? htmlPopup(skill) : "";
}

function ouvrirEtoile(idSkill) {
  if (etoileSelectionnee !== idSkill) positionPopup = null;
  etoileSelectionnee = idSkill;
  afficherArbre();
}

function fermerPopupSkill() {
  etoileSelectionnee = null;
  positionPopup = null;
  afficherArbre();
}

function deplacerPopup(event) {
  if (event.button !== 0 || event.target.closest("button")) return;
  const popup = event.currentTarget.closest(".popup-skill");
  const fond = popup.parentElement;
  const boitePopup = popup.getBoundingClientRect();
  const boiteFond = fond.getBoundingClientRect();
  positionPopup = {
    left: boitePopup.left - boiteFond.left,
    top: boitePopup.top - boiteFond.top
  };
  popup.style.left = positionPopup.left + "px";
  popup.style.top = positionPopup.top + "px";
  popup.style.transform = "none";
  deplacementPopup = {
    pointerId: event.pointerId,
    debutX: event.clientX,
    debutY: event.clientY,
    left: positionPopup.left,
    top: positionPopup.top,
    largeurFond: boiteFond.width,
    hauteurFond: boiteFond.height,
    largeurPopup: boitePopup.width,
    hauteurPopup: boitePopup.height
  };
  event.preventDefault();
}

function suivreDeplacementPopup(event) {
  if (!deplacementPopup || event.pointerId !== deplacementPopup.pointerId) return;
  const marge = 8;
  const maxLeft = Math.max(marge, deplacementPopup.largeurFond - deplacementPopup.largeurPopup - marge);
  const maxTop = Math.max(marge, deplacementPopup.hauteurFond - deplacementPopup.hauteurPopup - marge);
  positionPopup = {
    left: Math.max(marge, Math.min(maxLeft, deplacementPopup.left + event.clientX - deplacementPopup.debutX)),
    top: Math.max(marge, Math.min(maxTop, deplacementPopup.top + event.clientY - deplacementPopup.debutY))
  };
  const popup = document.querySelector(".popup-skill");
  if (!popup) return;
  popup.style.left = positionPopup.left + "px";
  popup.style.top = positionPopup.top + "px";
}

function terminerDeplacementPopup(event) {
  if (deplacementPopup && event.pointerId === deplacementPopup.pointerId) deplacementPopup = null;
}

document.addEventListener("pointermove", suivreDeplacementPopup);
document.addEventListener("pointerup", terminerDeplacementPopup);
document.addEventListener("pointercancel", terminerDeplacementPopup);

document.addEventListener("keydown", function(e) {
  if (e.key === "Escape" && etoileSelectionnee) fermerPopupSkill();
});