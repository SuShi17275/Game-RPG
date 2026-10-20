// ===== skills.js : skills à niveaux, prérequis à seuils, éclats, boutique =====
// Les écrans sont dans l'ordinateur : #ordi-arbre (liste), #ordi-skill-detail, #ordi-boutique
// Données : data/skills.json, data/categories.json, data/config-skills.json
//
// Format d'un skill : "niveaux": [ { "nom": "...", "eclats": 2, "quetes": [ { "nom": "...", "recompense": 5 } ] } ]
// (l'ancien format avec "quetes" directement sur le skill marche encore : il devient un seul niveau)
//
// Sauvegardes (localStorage) :
//   progressionSkills : { idSkill: { "nom de la quête": "date ISO" } }
//   skillsAchetes     : [ idSkill, ... ]
//   niveauxEclats     : { idSkill: { "0": 2, "1": 3 } }  (éclats déjà reçus par niveau terminé)
//   paliersCredites   : ancien système (25/50/100 %), gardé pour ne pas perdre les éclats déjà gagnés
//   eclatsDepenses    : nombre

let skills = [];
let categories = [];
let configSkills = {
  seuils: { dessin_enfants: 50 },
  eclats: { paliers: [25, 50, 100], gains: { "25": 1, "50": 2, "100": 4 } },
  prixBoutique: { "2": 5, "3": 10, "4": 20, "5": 35 }
};

let progression = lireStockage("progressionSkills", {});
let skillsAchetes = lireStockage("skillsAchetes", []);
let niveauxEclats = lireStockage("niveauxEclats", {});
let paliersCredites = lireStockage("paliersCredites", {}); // ancien système, lecture seule
let eclatsDepenses = lireStockage("eclatsDepenses", 0);
let skillOuvert = null; // index du skill affiché dans l'écran de détail

function lireStockage(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle);
    return brut === null ? defaut : JSON.parse(brut);
  } catch (e) {
    return defaut;
  }
}

function sauverStockage(cle, valeur) {
  localStorage.setItem(cle, JSON.stringify(valeur));
}

function sauvegarderProgression() {
  sauverStockage("progressionSkills", progression);
}

// ---------- chargement (automatique) ----------
function chargerJson(chemin) {
  return fetch(chemin, { cache: "no-cache" }).then(function(r) { return r.json(); });
}

// Un skill sans "niveaux" (ancien format) devient un seul niveau
function normaliserSkill(skill) {
  if (!skill.niveaux) {
    skill.niveaux = [{ nom: "Niveau 1", eclats: 2, quetes: skill.quetes || [] }];
  }
  skill.niveaux.forEach(function(n, i) {
    if (!n.nom) n.nom = "Niveau " + (i + 1);
    if (typeof n.eclats !== "number") n.eclats = 2 + i;
  });
  return skill;
}

Promise.all([
  chargerJson("data/skills.json"),
  chargerJson("data/categories.json"),
  chargerJson("data/config-skills.json")
]).then(function(resultats) {
  skills = resultats[0].map(normaliserSkill);
  categories = resultats[1];
  configSkills = Object.assign(configSkills, resultats[2]);
  verifierPrerequis();
  if (typeof rafraichirOrdinateur === "function") rafraichirOrdinateur();
}).catch(function(erreur) {
  console.error("Erreur de chargement des skills :", erreur);
});

function getSkill(id) {
  return skills.find(function(s) { return s.id === id; });
}

function getCategorie(id) {
  return categories.find(function(c) { return c.id === id; }) || { id: id, nom: id, icone: "❔", couleur: "#888" };
}

// ---------- quêtes, niveaux et pourcentage (ces fonctions prennent un objet skill) ----------
function queteFaite(skill, quete) {
  return Boolean(progression[skill.id] && progression[skill.id][quete.nom]);
}

function toutesLesQuetes(skill) {
  return skill.niveaux.reduce(function(liste, n) { return liste.concat(n.quetes); }, []);
}

function nbQuetes(skill) {
  return toutesLesQuetes(skill).length;
}

function nbQuetesFaites(skill) {
  return toutesLesQuetes(skill).filter(function(q) { return queteFaite(skill, q); }).length;
}

// Le pourcentage est calculé sur les quêtes de tous les niveaux (prérequis, radar, stats)
function pourcentageSkill(skill) {
  const total = nbQuetes(skill);
  if (total === 0) return 0;
  return Math.round(nbQuetesFaites(skill) / total * 100);
}

function estMaitrise(skill) {
  return nbQuetes(skill) > 0 && nbQuetesFaites(skill) === nbQuetes(skill);
}

function niveauTermine(skill, indexNiveau) {
  const quetes = skill.niveaux[indexNiveau].quetes;
  return quetes.length > 0 && quetes.every(function(q) { return queteFaite(skill, q); });
}

// Index du premier niveau pas fini, ou -1 si tout est fini
function niveauEnCours(skill) {
  for (let i = 0; i < skill.niveaux.length; i++) {
    if (!niveauTermine(skill, i)) return i;
  }
  return -1;
}

// Index de la première quête pas faite dans un niveau (-1 si le niveau est fini)
function indexProchaineQuete(skill, indexNiveau) {
  return skill.niveaux[indexNiveau].quetes.findIndex(function(q) { return !queteFaite(skill, q); });
}

// ---------- prérequis ----------
// "id"                              -> 100 % du skill
// {"id": "x", "seuil": "Niveau 1"}  -> le niveau "Niveau 1" du skill x est terminé
// {"id": "x", "pourcent": 60}       -> 60 %
// {"id": "x", "seuil": "nom"}       -> (ancien) valeur de config-skills.json > seuils > nom
function idPrerequis(p) {
  return typeof p === "string" ? p : p.id;
}

function seuilPrerequis(p) {
  if (typeof p === "string") return 100;
  if (typeof p.pourcent === "number") return p.pourcent;
  if (p.seuil && configSkills.seuils && typeof configSkills.seuils[p.seuil] === "number") {
    return configSkills.seuils[p.seuil];
  }
  return 100;
}

// Index du niveau du skill dont le nom est `nom` (-1 si aucun)
function indexNiveauParNom(skill, nom) {
  return skill.niveaux.findIndex(function(n) { return n.nom === nom; });
}

// "seuil" peut être le nom d'un niveau du skill parent (ex. "Niveau 1")
function niveauSeuil(p) {
  if (typeof p === "string" || typeof p.seuil !== "string") return -1;
  const parent = getSkill(p.id);
  return parent ? indexNiveauParNom(parent, p.seuil) : -1;
}

function prerequisAtteint(p) {
  const parent = getSkill(idPrerequis(p));
  if (!parent) return false;
  const indexNiveau = niveauSeuil(p);
  if (indexNiveau !== -1) {
    // le niveau demandé et tous ceux d'avant doivent être terminés
    for (let i = 0; i <= indexNiveau; i++) {
      if (!niveauTermine(parent, i)) return false;
    }
    return true;
  }
  return pourcentageSkill(parent) >= seuilPrerequis(p);
}

function prerequisRemplis(skill) {
  return skill.prerequis.every(prerequisAtteint);
}

function libellePrerequis(p) {
  const parent = getSkill(idPrerequis(p));
  const nom = parent ? parent.nom : idPrerequis(p);
  if (niveauSeuil(p) !== -1) return nom + " (" + p.seuil + " terminé)";
  const seuil = seuilPrerequis(p);
  return nom + (seuil < 100 ? " " + seuil + " %" : "");
}

// Au chargement : signale dans la console un "seuil" qui ne correspond à aucun niveau ni à la config
function verifierPrerequis() {
  skills.forEach(function(skill) {
    skill.prerequis.forEach(function(p) {
      if (typeof p === "string" || typeof p.seuil !== "string") return;
      const connuDansConfig = configSkills.seuils && typeof configSkills.seuils[p.seuil] === "number";
      if (niveauSeuil(p) === -1 && !connuDansConfig) {
        console.warn("Prérequis de « " + skill.id + " » : le seuil « " + p.seuil +
          " » ne correspond à aucun niveau de « " + p.id + " » (comptera comme 100 %).");
      }
    });
  });
}

// Débloqué si : skill de départ (niveau 1, sans prérequis), ou prérequis remplis, ou acheté
function estDebloque(skill) {
  if (skillsAchetes.includes(skill.id)) return true;
  if (skill.prerequis.length > 0) return prerequisRemplis(skill);
  return skill.niveau === 1;
}

// ---------- éclats ----------
function gainPalier(palier) {
  return (configSkills.eclats.gains && configSkills.eclats.gains[String(palier)]) || 0;
}

function soldeEclats() {
  let total = 0;
  // ancien système (paliers 25/50/100 %) : on garde ce qui a déjà été gagné
  for (const id in paliersCredites) {
    paliersCredites[id].forEach(function(p) { total += gainPalier(p); });
  }
  // nouveau système : éclats reçus à la fin de chaque niveau
  for (const id in niveauxEclats) {
    for (const i in niveauxEclats[id]) total += niveauxEclats[id][i];
  }
  return total - eclatsDepenses;
}

// Donne les éclats des niveaux terminés qui n'ont pas encore été payés.
// Retourne { eclats, niveaux } (niveaux = noms des niveaux qui viennent d'être terminés).
function verifierNiveaux(skill) {
  if (!niveauxEclats[skill.id]) niveauxEclats[skill.id] = {};
  let eclats = 0;
  const termines = [];
  skill.niveaux.forEach(function(n, i) {
    if (niveauTermine(skill, i) && niveauxEclats[skill.id][String(i)] === undefined) {
      niveauxEclats[skill.id][String(i)] = n.eclats; // on enregistre le montant reçu
      eclats += n.eclats;
      termines.push(n.nom);
    }
  });
  if (termines.length > 0) sauverStockage("niveauxEclats", niveauxEclats);
  return { eclats: eclats, niveaux: termines };
}

// ---------- boutique (logique) ----------
function estEnBoutique(skill) {
  return skill.prerequis.length === 0 && skill.niveau > 1 && !skillsAchetes.includes(skill.id);
}

function prixSkill(skill) {
  return configSkills.prixBoutique[String(skill.niveau)] || 0;
}

function skillsEnBoutique() {
  return skills.filter(estEnBoutique);
}

function acheterSkill(idSkill) {
  const skill = getSkill(idSkill);
  if (!skill || !estEnBoutique(skill)) return { ok: false, message: "Ce skill n'est pas en boutique." };
  const prix = prixSkill(skill);
  if (soldeEclats() < prix) {
    return { ok: false, message: "Pas assez d'éclats (" + soldeEclats() + "/" + prix + ")." };
  }
  eclatsDepenses += prix;
  skillsAchetes.push(idSkill);
  sauverStockage("eclatsDepenses", eclatsDepenses);
  sauverStockage("skillsAchetes", skillsAchetes);
  if (typeof rafraichirOrdinateur === "function") rafraichirOrdinateur();
  return { ok: true, message: skill.nom + " débloqué !" };
}

function acheterSkillUI(idSkill) {
  const skill = getSkill(idSkill);
  if (!skill) return;
  if (!confirm("Acheter « " + skill.nom + " » pour " + prixSkill(skill) + " éclats ?")) return;
  alert(acheterSkill(idSkill).message);
}

// ---------- affichage : ancienne liste des skills (remplacée par les constellations, js/constellations.js) ----------
function afficherListeSkills() {
  const conteneur = document.getElementById("ordi-arbre");
  let html = "<h2>🌱 Skills</h2><p class=\"eclats\">✨ Éclats : " + soldeEclats() + "</p>";

  categories.forEach(function(cat) {
    // les skills à acheter n'apparaissent que dans la boutique
    const liste = [];
    skills.forEach(function(skill, index) {
      if (skill.categorie === cat.id && !estEnBoutique(skill)) liste.push({ skill: skill, index: index });
    });
    if (liste.length === 0) return;

    html += `<h3 class="categorie-titre" style="border-left-color:${cat.couleur}">${cat.icone} ${echapper(cat.nom)}</h3>`;
    liste.forEach(function(e) {
      const skill = e.skill;
      if (estDebloque(skill)) {
        const actuel = niveauEnCours(skill);
        const etiquette = actuel === -1
          ? "✅ Maîtrisé"
          : "Niv. " + (actuel + 1) + "/" + skill.niveaux.length;
        html += `
          <button class="skill-carte" style="border-left-color:${cat.couleur}" onclick="ouvrirSkill(${e.index})">
            <span class="skill-nom">${echapper(skill.nom)}</span>
            <span class="skill-compte">${etiquette} · ${nbQuetesFaites(skill)}/${nbQuetes(skill)}</span>
            <span class="skill-barre"><span style="width:${pourcentageSkill(skill)}%;background:${cat.couleur}"></span></span>
          </button>`;
      } else {
        const manque = skill.prerequis.map(libellePrerequis).join(", ");
        html += `
          <div class="skill-carte verrouille" style="border-left-color:${cat.couleur}">
            <span class="skill-nom">🔒 ${echapper(skill.nom)}</span>
            <small>Prérequis : ${echapper(manque)}</small>
          </div>`;
      }
    });
  });

  conteneur.innerHTML = html;
}

// ---------- affichage : quêtes d'un skill (un seul niveau à la fois) ----------
// Retourne le HTML des quêtes. Il est affiché dans la fenêtre pop-up (constellations.js).
function htmlQuetesSkill(indexSkill) {
  const skill = skills[indexSkill];
  const cat = getCategorie(skill.categorie);
  const actuel = niveauEnCours(skill);

  let html = `
    <div class="skill-barre"><span style="width:${pourcentageSkill(skill)}%;background:${cat.couleur}"></span></div>
    <p>${pourcentageSkill(skill)} % (${nbQuetesFaites(skill)}/${nbQuetes(skill)})</p>`;

  if (actuel === -1) {
    html += `<p class="skill-maitrise">🎉 Skill maîtrisé, tous les niveaux sont terminés !</p>`;
  } else {
    const niveau = skill.niveaux[actuel];
    const faites = niveau.quetes.filter(function(q) { return queteFaite(skill, q); }).length;

    if (actuel > 0) {
      html += `<p class="niveaux-faits">✅ ${actuel} niveau${actuel > 1 ? "x" : ""} terminé${actuel > 1 ? "s" : ""}</p>`;
    }
    html += `
      <h3>Niveau ${actuel + 1}/${skill.niveaux.length} — ${echapper(niveau.nom)}</h3>
      <p>${faites}/${niveau.quetes.length} quêtes · fin du niveau : ✨ ${niveau.eclats} éclats</p>`;

    const prochaine = indexProchaineQuete(skill, actuel);
    if (prochaine !== -1) {
      const quete = niveau.quetes[prochaine];
      html += `
        <div class="quete popup-quete-actuelle">
          <p>${echapper(quete.nom)}</p>
          <p>💰 ${quete.recompense}</p>
          <button onclick="validerQuete(${indexSkill}, ${actuel}, ${prochaine})">Valider</button>
        </div>`;
    }
  }

  const quetesTerminees = [];
  skill.niveaux.forEach(function(n) {
    const faitesDansNiveau = n.quetes.filter(function(quete) { return queteFaite(skill, quete); });
    if (faitesDansNiveau.length > 0) {
      quetesTerminees.push({ niveau: n, quetes: faitesDansNiveau });
    }
  });
  if (quetesTerminees.length > 0) {
    const totalTerminees = quetesTerminees.reduce(function(total, groupe) {
      return total + groupe.quetes.length;
    }, 0);
    html += `<details class="popup-quetes-terminees"><summary>Quêtes déjà faites (${totalTerminees})</summary>`;
    quetesTerminees.forEach(function(groupe) {
      html += `<div class="popup-quetes-niveau"><strong>${echapper(groupe.niveau.nom)}</strong>`;
      groupe.quetes.forEach(function(quete) {
        html += `
          <div class="quete popup-quete-terminee">
            <p>${echapper(quete.nom)}</p>
            <p>💰 ${quete.recompense} · Complétée</p>
          </div>`;
      });
      html += `</div>`;
    });
    html += `</details>`;
  }

  return html;
}

// Ouvre la fenêtre pop-up d'un skill (définie dans constellations.js)
function ouvrirSkill(indexSkill) {
  skillOuvert = indexSkill;
  if (typeof ouvrirEtoile === "function") ouvrirEtoile(skills[indexSkill].id);
}

function validerQuete(indexSkill, indexNiveau, indexQuete) {
  const skill = skills[indexSkill];
  if (!estDebloque(skill)) return;
  if (indexNiveau !== niveauEnCours(skill)) return; // seule une quête du niveau en cours peut être validée
  if (indexQuete !== indexProchaineQuete(skill, indexNiveau)) return; // dans l'ordre : seule la prochaine quête
  const quete = skill.niveaux[indexNiveau].quetes[indexQuete];
  if (!quete || queteFaite(skill, quete)) return;
  if (!confirm("Valider « " + quete.nom + " » ?")) return;

  progression[skill.id] = progression[skill.id] || {};
  progression[skill.id][quete.nom] = new Date().toISOString();
  sauvegarderProgression();

  ajouterTransaction(quete.nom, quete.recompense, { type: "skill" });
  validerTacheAuto("quete-skill");

  const resultat = verifierNiveaux(skill);
  if (resultat.eclats > 0) {
    alert("🎉 " + resultat.niveaux.join(", ") + " terminé !\n✨ +" + resultat.eclats + " éclats");
  }

  rafraichirOrdinateur();
}

// ---------- affichage : boutique ----------
function afficherBoutique() {
  const conteneur = document.getElementById("ordi-boutique");
  const solde = soldeEclats();
  let html = "<h2>🛒 Boutique</h2><p class=\"eclats\">✨ Éclats : " + solde + "</p>";

  const liste = skillsEnBoutique().slice().sort(function(a, b) {
    return prixSkill(a) - prixSkill(b) || a.nom.localeCompare(b.nom);
  });

  if (liste.length === 0) {
    html += "<p>Tout est acheté !</p>";
  }

  liste.forEach(function(skill) {
    const cat = getCategorie(skill.categorie);
    const prix = prixSkill(skill);
    html += `
      <div class="skill-carte boutique" style="border-left-color:${cat.couleur}">
        <span class="skill-nom">${cat.icone} ${echapper(skill.nom)}</span>
        <small>Niveau ${skill.niveau} — ${echapper(cat.nom)}</small>
        <button onclick="acheterSkillUI('${skill.id}')" ${solde < prix ? "disabled" : ""}>Acheter — ✨ ${prix}</button>
      </div>`;
  });

  conteneur.innerHTML = html;
}

// Ancien nom, gardé au cas où un autre fichier l'appelle encore
function afficherSkills() {
  if (typeof rafraichirOrdinateur === "function") rafraichirOrdinateur();
}