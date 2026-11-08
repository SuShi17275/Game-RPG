// ===== constellations.js : cartes de skills par catégorie =====
// La logique de progression et d'achat reste dans skills.js.

let categorieSkillOuverte = null;
let skillDetailOuvert = null;
let positionPopupSkill = null;
let deplacementPopupSkill = null;
let clicFondApresDeplacement = false;
let indexSkillsDebloquants = Object.create(null);
let indexSkillsDebloquantsConstruit = false;
let rangsSkills = null;

const RANGS_SKILL_DEFAUT = [
  { lettre: "E", pourcentage: 0 },
  { lettre: "D", pourcentage: 10 },
  { lettre: "C", pourcentage: 25 },
  { lettre: "B", pourcentage: 45 },
  { lettre: "A", pourcentage: 70 },
  { lettre: "S", pourcentage: 100 }
];

function construireIndexDebloques() {
  if (indexSkillsDebloquantsConstruit) return;
  skills.forEach(function(skill) {
    skill.prerequis.forEach(function(prerequis) {
      const idParent = idPrerequis(prerequis);
      if (!indexSkillsDebloquants[idParent]) indexSkillsDebloquants[idParent] = [];
      if (!indexSkillsDebloquants[idParent].includes(skill.id)) {
        indexSkillsDebloquants[idParent].push(skill.id);
      }
    });
  });
  indexSkillsDebloquantsConstruit = true;
}

function etatSkill(skill) {
  const debloque = skillsAchetes.includes(skill.id) || skillsDebloques.includes(skill.id) ||
    (skill.prerequis.length === 0 && skill.niveau === 1);
  if (debloque) return nbQuetesFaites(skill) > 0 ? "actif" : "dispo";
  if (estEnBoutique(skill)) return "boutique";
  return "verrouille";
}

function textePrerequisManquant(prerequis) {
  const idParent = idPrerequis(prerequis);
  const parent = getSkill(idParent);
  if (!parent) return idParent + " (skill introuvable)";

  const indexSeuil = niveauSeuil(prerequis);
  if (indexSeuil !== -1) {
    const niveauActuel = niveauEnCours(parent);
    const numeroActuel = niveauActuel === -1 ? parent.niveaux.length : niveauActuel + 1;
    return parent.id + " niveau " + (indexSeuil + 1) + " (tu es au niveau " + numeroActuel + ")";
  }

  const seuil = seuilPrerequis(prerequis);
  return parent.id + " " + seuil + " % (tu es à " + pourcentageSkill(parent) + " %)";
}

function prerequisManquants(skill) {
  return skill.prerequis.filter(function(prerequis) {
    return !prerequisAtteint(prerequis);
  }).map(textePrerequisManquant);
}

function rangSkill(pourcentage) {
  if (!rangsSkills) {
    rangsSkills = typeof listeRangs === "function" ? listeRangs() : RANGS_SKILL_DEFAUT;
  }
  let rang = rangsSkills[0];
  rangsSkills.forEach(function(candidat) {
    if (pourcentage >= candidat.pourcentage) rang = candidat;
  });
  return rang.lettre;
}

function niveauActuelSkill(skill) {
  const index = niveauEnCours(skill);
  return index === -1 ? "Tous les niveaux terminés" : skill.niveaux[index].nom;
}

function libellePrerequisChaine(parent, prerequis) {
  const indexSeuil = niveauSeuil(prerequis);
  if (indexSeuil !== -1) return parent.id + " " + (indexSeuil + 1);
  return parent.id + " " + seuilPrerequis(prerequis) + " %";
}

function chainesPrerequisSkill(skill, visites) {
  if (visites.has(skill.id) || skill.prerequis.length === 0) return [[skill.id]];
  const prochainesVisites = new Set(visites);
  prochainesVisites.add(skill.id);
  const chaines = [];

  skill.prerequis.forEach(function(prerequis) {
    const parent = getSkill(idPrerequis(prerequis));
    if (!parent) return;
    chainesPrerequisSkill(parent, prochainesVisites).forEach(function(chaine) {
      chaine[chaine.length - 1] = libellePrerequisChaine(parent, prerequis);
      chaine.push(skill.id);
      chaines.push(chaine);
    });
  });

  return chaines.length > 0 ? chaines : [[skill.id]];
}

function htmlChainesPrerequis(skill) {
  if (skill.prerequis.length === 0) return "";
  const chaines = chainesPrerequisSkill(skill, new Set()).map(function(chaine) {
    return chaine.join(" → ");
  });
  const uniques = Array.from(new Set(chaines));
  return `<p class="skills-chaine"><strong>Prérequis :</strong> ${uniques.map(echapper).join("<br>")}</p>`;
}

function htmlListePrerequis(skill) {
  const manquants = prerequisManquants(skill);
  let indexManquant = 0;
  let html = "<ul class=\"skills-prerequis\">";
  skill.prerequis.forEach(function(prerequis) {
    const manque = prerequisAtteint(prerequis) ? null : manquants[indexManquant++];
    html += `<li>${manque ? "🔒 " + echapper(manque) : "✅ " + echapper(libellePrerequis(prerequis))}</li>`;
  });
  return html + "</ul>";
}

function htmlDetailSkill(skill) {
  const etat = etatSkill(skill);
  const pourcentage = pourcentageSkill(skill);
  const indexSkill = skills.indexOf(skill);
  const cat = getCategorie(skill.categorie);
  let contenu = "";

  if (etat === "actif" || etat === "dispo") {
    contenu = htmlQuetesSkill(indexSkill);
  } else if (etat === "boutique") {
    const prix = prixSkill(skill);
    contenu = `
      <p>Prix : <strong>✨ ${prix} éclats</strong> · Solde : <strong>✨ ${soldeEclats()}</strong></p>
      <button class="skills-acheter" type="button" data-acheter-skill="${echapper(skill.id)}"
        ${soldeEclats() < prix ? "disabled" : ""}>Acheter — ✨ ${prix}</button>`;
  } else {
    contenu = `<p>Ce skill est verrouillé. Il manque :</p>${htmlListePrerequis(skill)}`;
  }

  return `
    <section class="skills-detail etat-${etat}" style="--couleur-skill:${cat.couleur}"
      aria-label="Détail de ${echapper(skill.nom)}">
      <div class="skills-detail-entete">
        <div>
          <p class="skills-detail-categorie">${cat.icone} ${echapper(cat.nom)}</p>
          <h3>${echapper(skill.nom)}</h3>
        </div>
        <button type="button" class="skills-fermer-detail" data-fermer-detail aria-label="Fermer le détail">✕</button>
      </div>
      ${htmlChainesPrerequis(skill)}
      ${contenu}
      <div class="skill-barre" role="progressbar" aria-label="Progression de ${echapper(skill.nom)}"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pourcentage}">
        <span style="width:${pourcentage}%;background:${cat.couleur}"></span>
      </div>
      <p class="skills-detail-progression">
        <strong>Rang ${rangSkill(pourcentage)}</strong>
        <span>${pourcentage} % · ${nbQuetesFaites(skill)}/${nbQuetes(skill)} quêtes</span>
      </p>
    </section>`;
}

function elementPopupSkill() {
  let popup = document.getElementById("ordi-popup-skill");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "ordi-popup-skill";
    document.getElementById("ordinateur").appendChild(popup);
  }
  return popup;
}

function majPopupSkill() {
  const popup = elementPopupSkill();
  const skill = skills.find(function(element) { return element.id === skillDetailOuvert; });
  popup.innerHTML = skill ? `
    <div class="skills-popup-fond" data-fermer-popup>
      <div class="skills-popup-contenu" role="dialog" aria-modal="true"
        aria-label="Détail de ${echapper(skill.nom)}">
        ${htmlDetailSkill(skill)}
      </div>
    </div>` : "";
  const fenetre = popup.querySelector(".skills-popup-contenu");
  if (!fenetre) return;
  const entete = fenetre.querySelector(".skills-detail-entete");
  entete.addEventListener("pointerdown", commencerDeplacementPopupSkill);
  if (positionPopupSkill) appliquerPositionPopupSkill(fenetre);
}

function commencerDeplacementPopupSkill(event) {
  if (event.button !== 0 || event.target.closest("button")) return;
  const fenetre = event.currentTarget.closest(".skills-popup-contenu");
  const fond = fenetre.closest(".skills-popup-fond");
  const boiteFenetre = fenetre.getBoundingClientRect();
  const boiteFond = fond.getBoundingClientRect();
  if (!positionPopupSkill) {
    positionPopupSkill = {
      left: boiteFenetre.left - boiteFond.left,
      top: boiteFenetre.top - boiteFond.top
    };
  }
  deplacementPopupSkill = {
    pointerId: event.pointerId,
    debutX: event.clientX,
    debutY: event.clientY,
    left: positionPopupSkill.left,
    top: positionPopupSkill.top,
    largeurFond: boiteFond.width,
    hauteurFond: boiteFond.height,
    largeurFenetre: boiteFenetre.width,
    hauteurFenetre: boiteFenetre.height
  };
  fenetre.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function appliquerPositionPopupSkill(fenetre) {
  fenetre.style.position = "absolute";
  fenetre.style.transform = "none";
  fenetre.style.left = positionPopupSkill.left + "px";
  fenetre.style.top = positionPopupSkill.top + "px";
}

function suivreDeplacementPopupSkill(event) {
  if (!deplacementPopupSkill || event.pointerId !== deplacementPopupSkill.pointerId) return;
  if (Math.abs(event.clientX - deplacementPopupSkill.debutX) > 3 ||
      Math.abs(event.clientY - deplacementPopupSkill.debutY) > 3) {
    clicFondApresDeplacement = true;
  }
  const marge = 8;
  const maxLeft = Math.max(marge, deplacementPopupSkill.largeurFond -
    deplacementPopupSkill.largeurFenetre - marge);
  const maxTop = Math.max(marge, deplacementPopupSkill.hauteurFond -
    deplacementPopupSkill.hauteurFenetre - marge);
  positionPopupSkill = {
    left: Math.max(marge, Math.min(maxLeft,
      deplacementPopupSkill.left + event.clientX - deplacementPopupSkill.debutX)),
    top: Math.max(marge, Math.min(maxTop,
      deplacementPopupSkill.top + event.clientY - deplacementPopupSkill.debutY))
  };
  const fenetre = document.querySelector("#ordi-popup-skill .skills-popup-contenu");
  if (fenetre) appliquerPositionPopupSkill(fenetre);
}

function terminerDeplacementPopupSkill(event) {
  if (deplacementPopupSkill && event.pointerId === deplacementPopupSkill.pointerId) {
    deplacementPopupSkill = null;
  }
}

function htmlCarteSkill(skill, cat) {
  const etat = etatSkill(skill);
  const pourcentage = pourcentageSkill(skill);
  const enfants = indexSkillsDebloquants[skill.id] || [];
  const statut = {
    actif: "Actif",
    dispo: "Disponible",
    boutique: "Boutique",
    verrouille: "Verrouillé"
  }[etat];

  return `
    <article class="skill-carte etat-${etat}${skillDetailOuvert === skill.id ? " selectionnee" : ""}"
      data-skill-id="${echapper(skill.id)}"
      style="--couleur-skill:${cat.couleur}">
      <button type="button" class="skill-carte-ouvrir" aria-expanded="${skillDetailOuvert === skill.id}">
        <span class="skill-carte-entete">
          <span class="skill-nom">${echapper(skill.nom)}</span>
          <span class="skill-etat">${statut}</span>
        </span>
        <span class="skill-carte-niveau">${echapper(niveauActuelSkill(skill))}</span>
        <span class="skill-carte-meta">Rang ${rangSkill(pourcentage)} · ${pourcentage} % · ${nbQuetesFaites(skill)}/${nbQuetes(skill)} quêtes</span>
        <span class="skill-barre" role="progressbar" aria-label="Progression de ${echapper(skill.nom)}"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pourcentage}">
          <span style="width:${pourcentage}%;background:${cat.couleur}"></span>
        </span>
      </button>
      ${etat === "boutique" ? `
        <p class="skill-carte-prix">✨ ${prixSkill(skill)} éclats</p>
        <button type="button" class="skills-acheter" data-acheter-skill="${echapper(skill.id)}"
          ${soldeEclats() < prixSkill(skill) ? "disabled" : ""}>Acheter</button>` : ""}
      ${etat === "verrouille" ? `<p class="skill-carte-manque">🔒 ${prerequisManquants(skill).map(echapper).join("<br>")}</p>` : ""}
      ${enfants.length > 0 ? `<p class="skill-carte-debloque"><strong>Débloque :</strong> ${enfants.map(echapper).join(", ")}</p>` : ""}
    </article>`;
}

function afficherArbre() {
  const conteneur = document.getElementById("ordi-arbre");
  if (!conteneur) return;
  if (categories.length === 0 || skills.length === 0) {
    conteneur.innerHTML = "<h2>🌱 Skills</h2><p>Chargement…</p>";
    return;
  }

  if (categorieSkillOuverte === null) {
    const premiereCategorie = categories.find(function(cat) {
      return skills.some(function(skill) { return skill.categorie === cat.id; });
    });
    categorieSkillOuverte = premiereCategorie ? premiereCategorie.id : null;
  }

  const categoriesHtml = categories.map(function(cat) {
    const nbSkills = skills.filter(function(skill) { return skill.categorie === cat.id; }).length;
    const ouverte = categorieSkillOuverte === cat.id;
    let cartes = "";
    if (ouverte) {
      const liste = skills.filter(function(skill) { return skill.categorie === cat.id; });
      liste.sort(function(a, b) {
        const ordreEtat = { actif: 0, dispo: 1, boutique: 2, verrouille: 3 };
        return ordreEtat[etatSkill(a)] - ordreEtat[etatSkill(b)] ||
          a.nom.localeCompare(b.nom, "fr");
      });
      cartes = `<div class="skills-grille">${liste.map(function(skill) {
        return htmlCarteSkill(skill, cat);
      }).join("")}</div>`;
    }

    return `
      <section class="skills-categorie">
        <button type="button" class="skills-categorie-bouton" data-categorie="${echapper(cat.id)}"
          aria-expanded="${ouverte}" style="--couleur-skill:${cat.couleur}">
          <span>${cat.icone} ${echapper(cat.nom)}</span>
          <span class="skills-categorie-compte">${nbSkills} skills ${ouverte ? "−" : "+"}</span>
        </button>
        ${cartes}
      </section>`;
  }).join("");

  conteneur.innerHTML = `
    <header class="skills-entete">
      <h2>🌱 Skills</h2>
      <span class="skills-solde">✨ Éclats : ${soldeEclats()}</span>
    </header>
    ${categoriesHtml}`;
  majPopupSkill();

  conteneur.onclick = function(event) {
    const acheter = event.target.closest("[data-acheter-skill]");
    if (acheter) {
      acheterSkillUI(acheter.dataset.acheterSkill);
      return;
    }

    const categorie = event.target.closest("[data-categorie]");
    if (categorie) {
      const idCategorie = categorie.dataset.categorie;
      const prochaineCategorie = categorieSkillOuverte === idCategorie ? null : idCategorie;
      const detailSelectionne = skills.find(function(skill) {
        return skill.id === skillDetailOuvert;
      });
      if (prochaineCategorie !== null &&
          (!detailSelectionne || detailSelectionne.categorie !== prochaineCategorie)) {
        skillDetailOuvert = null;
      }
      categorieSkillOuverte = prochaineCategorie;
      afficherArbre();
      return;
    }

    const carte = event.target.closest(".skill-carte[data-skill-id]");
    if (carte) {
      ouvrirDetailSkill(carte.dataset.skillId);
    }
  };
}

function ouvrirDetailSkill(idSkill) {
  const skill = getSkill(idSkill);
  if (!skill) return;
  categorieSkillOuverte = skill.categorie;
  if (skillDetailOuvert === idSkill) {
    skillDetailOuvert = null;
    positionPopupSkill = null;
  } else {
    skillDetailOuvert = idSkill;
    positionPopupSkill = null;
  }
  afficherArbre();
}

function fermerDetailSkill() {
  skillDetailOuvert = null;
  positionPopupSkill = null;
  deplacementPopupSkill = null;
  const popup = document.getElementById("ordi-popup-skill");
  if (popup) popup.innerHTML = "";
  if (document.querySelector("#ordi-arbre:not(.cache)")) afficherArbre();
}

document.addEventListener("click", function(event) {
  const popup = document.getElementById("ordi-popup-skill");
  if (!popup || !popup.contains(event.target)) return;

  const clicFond = event.target.matches("[data-fermer-popup]");
  if (clicFond && clicFondApresDeplacement) {
    clicFondApresDeplacement = false;
    return;
  }
  clicFondApresDeplacement = false;

  if (event.target.closest("[data-acheter-skill]")) {
    acheterSkillUI(event.target.closest("[data-acheter-skill]").dataset.acheterSkill);
    return;
  }
  if (event.target.closest("[data-fermer-detail]") || clicFond) {
    fermerDetailSkill();
  }
});

document.addEventListener("keydown", function(event) {
  if (event.key === "Escape" && skillDetailOuvert) fermerDetailSkill();
});

document.addEventListener("pointermove", suivreDeplacementPopupSkill);
document.addEventListener("pointerup", terminerDeplacementPopupSkill);
document.addEventListener("pointercancel", terminerDeplacementPopupSkill);
