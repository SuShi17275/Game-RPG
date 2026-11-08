// ===== skills.js : skills à niveaux, prérequis à seuils, éclats, boutique =====
// Les écrans sont dans l'ordinateur : #ordi-arbre (liste), #ordi-skill-detail, #ordi-boutique
// Données : data/skills.json, data/categories.json, data/config-skills.json
//
// Format d'un skill : "niveaux": [ { "nom": "...", "eclats": 2, "quetes": [ { "nom": "...", "recompense": 5 } ] } ]
// (l'ancien format avec "quetes" directement sur le skill marche encore : il devient un seul niveau)
//
// Sauvegardes (localStorage) :
//   progressionSkills : { idSkill: { idQuete: "date ISO" } }
//   skillsAchetes     : [ idSkill, ... ]
//   skillsDebloques   : [ idSkill, ... ] (prérequis remplis au moins une fois)
//   niveauxEclats     : { idSkill: { idNiveau: nombre } } (éclats déjà reçus par niveau terminé)
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
let skillsDebloques = lireStockage("skillsDebloques", []);
let niveauxEclats = lireStockage("niveauxEclats", {});
let paliersCredites = lireStockage("paliersCredites", {}); // ancien système, lecture seule
let eclatsDepenses = lireStockage("eclatsDepenses", 0);
function sauverStockage(cle, valeur) {
  ecrireStockage(cle, JSON.stringify(valeur));
}

function sauvegarderProgression() {
  sauverStockage("progressionSkills", progression);
}

// ---------- chargement (automatique) ----------
function chargerJson(chemin) {
  return fetch(chemin, { cache: "no-cache" }).then(function(r) { return r.json(); });
}

// Les ids persistants doivent être écrits dans le JSON ; ce slug n'est qu'un secours.
function slugIdentifiant(texte) {
  return String(texte).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "element";
}

// Un skill sans "niveaux" (ancien format) devient un seul niveau.
function normaliserSkill(skill) {
  if (!skill.niveaux) {
    skill.niveaux = [{ nom: "Niveau 1", eclats: 2, quetes: skill.quetes || [] }];
  }
  const identifiantsNiveaux = new Set();
  skill.niveaux.forEach(function(n, i) {
    if (!n.nom) n.nom = "Niveau " + (i + 1);
    if (typeof n.eclats !== "number") n.eclats = 2 + i;
    if (!n.id) {
      n.id = skill.id + "-niveau-" + slugIdentifiant(n.nom);
      let suffixe = 2;
      while (identifiantsNiveaux.has(n.id)) n.id = skill.id + "-niveau-" + slugIdentifiant(n.nom) + "-" + suffixe++;
      console.warn("Niveau sans id dans « " + skill.id + " » : identifiant généré depuis son nom.");
    }
    identifiantsNiveaux.add(n.id);
    const identifiantsQuetes = new Set();
    n.quetes.forEach(function(quete) {
      if (!quete.id) {
        const base = n.id + "-quete-" + slugIdentifiant(quete.nom);
        quete.id = base;
        let suffixe = 2;
        while (identifiantsQuetes.has(quete.id)) quete.id = base + "-" + suffixe++;
        console.warn("Quête sans id dans « " + skill.id + " » : identifiant généré depuis son nom.");
      }
      identifiantsQuetes.add(quete.id);
    });
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
  migrerNiveauxEclats();
  verifierPrerequis();
  verifierQuetes();
  if (typeof construireIndexDebloques === "function") construireIndexDebloques();
  memoriserSkillsDebloques();
  if (typeof rafraichirOrdinateur === "function") rafraichirOrdinateur();
  window.dispatchEvent(new Event("skills:pretes"));
}).catch(function(erreur) {
  console.error("Erreur de chargement des skills :", erreur);
});

function migrerNiveauxEclats() {
  let modifie = false;
  skills.forEach(function(skill) {
    const recompenses = niveauxEclats[skill.id];
    if (!recompenses) return;
    skill.niveaux.forEach(function(niveau, index) {
      const ancienId = String(index);
      if (!Object.prototype.hasOwnProperty.call(recompenses, ancienId)) return;
      if (!Object.prototype.hasOwnProperty.call(recompenses, niveau.id)) {
        recompenses[niveau.id] = recompenses[ancienId];
      }
      delete recompenses[ancienId];
      modifie = true;
    });
  });
  if (modifie) sauverStockage("niveauxEclats", niveauxEclats);
}

function getSkill(id) {
  return skills.find(function(s) { return s.id === id; });
}

function getCategorie(id) {
  return categories.find(function(c) { return c.id === id; }) || { id: id, nom: id, icone: "❔", couleur: "#888" };
}

// ---------- quêtes, niveaux et pourcentage (ces fonctions prennent un objet skill) ----------
function queteFaite(skill, quete) {
  return Boolean(progression[skill.id] && progression[skill.id][quete.id]);
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

// L'ordre des niveaux détermine leur progression : ajoute les nouveaux niveaux à la fin.
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

function verifierQuetes() {
  let progressionModifiee = false;
  skills.forEach(function(skill) {
    const progressionSkill = progression[skill.id] || (progression[skill.id] = {});
    const identifiants = new Set();
    const quetesParNom = new Map();

    skill.niveaux.forEach(function(niveau) {
      niveau.quetes.forEach(function(quete) {
        if (identifiants.has(quete.id)) {
          console.warn("Identifiant de quête dupliqué dans le skill « " + skill.id + " » : " + quete.id);
          const base = niveau.id + "-quete-" + slugIdentifiant(quete.nom);
          quete.id = base;
          let suffixe = 2;
          while (identifiants.has(quete.id)) quete.id = base + "-" + suffixe++;
        }
        identifiants.add(quete.id);
        if (!quetesParNom.has(quete.nom)) quetesParNom.set(quete.nom, []);
        quetesParNom.get(quete.nom).push(quete);
      });
    });

    quetesParNom.forEach(function(quetes, nom) {
      if (quetes.length > 1) {
        console.warn("Quête « " + nom + " » dupliquée dans « " + skill.id +
          " » : chaque occurrence a une progression distincte.");
      }
      if (Object.prototype.hasOwnProperty.call(progressionSkill, nom)) {
        const premiereQuete = quetes[0];
        if (!Object.prototype.hasOwnProperty.call(progressionSkill, premiereQuete.id)) {
          progressionSkill[premiereQuete.id] = progressionSkill[nom];
        }
        delete progressionSkill[nom];
        progressionModifiee = true;
      }
    });
  });

  if (progressionModifiee) sauvegarderProgression();
}

function memoriserSkillsDebloques() {
  let modifie = false;
  skills.forEach(function(skill) {
    if (skill.prerequis.length > 0 && prerequisRemplis(skill) && !skillsDebloques.includes(skill.id)) {
      skillsDebloques.push(skill.id);
      modifie = true;
    }
  });
  if (modifie) sauverStockage("skillsDebloques", skillsDebloques);
}

// Débloqué si : skill de départ (niveau 1, sans prérequis), ou prérequis remplis, ou acheté
function estDebloque(skill) {
  if (skillsAchetes.includes(skill.id) || skillsDebloques.includes(skill.id)) return true;
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
    if (niveauTermine(skill, i) && niveauxEclats[skill.id][n.id] === undefined) {
      niveauxEclats[skill.id][n.id] = n.eclats; // on enregistre le montant reçu
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

// ---------- affichage : quêtes d'un skill (un seul niveau à la fois) ----------
// Retourne le HTML des quêtes affichées dans le panneau de détail (constellations.js).
function htmlQuetesSkill(indexSkill) {
  const skill = skills[indexSkill];
  const actuel = niveauEnCours(skill);

  let html = "";

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

// Ouvre le panneau de détail d'un skill (défini dans constellations.js).
function ouvrirSkill(indexSkill) {
  if (!skills[indexSkill] || typeof ouvrirDetailSkill !== "function") return;
  ouvrirDetailSkill(skills[indexSkill].id);
}

function selectionnerQueteConseillee() {
  if (skills.length === 0) return null;
  const candidats = skills.map(function(skill, index) {
    const derniereQuete = toutesLesQuetes(skill).reduce(function(derniere, quete) {
      const date = progression[skill.id] && progression[skill.id][quete.id];
      const horodatage = date ? Date.parse(date) : NaN;
      return Number.isFinite(horodatage) ? Math.max(derniere, horodatage) : derniere;
    }, 0);
    return { skill: skill, index: index, derniereQuete: derniereQuete };
  }).filter(function(candidat) {
    const niveau = niveauEnCours(candidat.skill);
    return candidat.derniereQuete > 0 && estDebloque(candidat.skill) && niveau !== -1 &&
      indexProchaineQuete(candidat.skill, niveau) !== -1;
  }).sort(function(a, b) {
    return a.derniereQuete - b.derniereQuete ||
      a.skill.nom.localeCompare(b.skill.nom, "fr");
  });

  if (candidats.length === 0) return null;
  const candidat = candidats[0];
  const indexNiveau = niveauEnCours(candidat.skill);
  const indexQuete = indexProchaineQuete(candidat.skill, indexNiveau);
  return {
    skill: candidat.skill,
    quete: candidat.skill.niveaux[indexNiveau].quetes[indexQuete]
  };
}

function enregistrerQueteSkill(skill, quete) {
  progression[skill.id] = progression[skill.id] || {};
  progression[skill.id][quete.id] = new Date().toISOString();
  sauvegarderProgression();
  ajouterTransaction(quete.nom, quete.recompense, { type: "skill" });
  validerTacheAuto("quete-skill");

  const resultat = verifierNiveaux(skill);
  const debloquesAvant = new Set(skillsDebloques);
  memoriserSkillsDebloques();
  const nouvellementDebloques = skills.filter(function(skillDebloque) {
    return !debloquesAvant.has(skillDebloque.id) && skillsDebloques.includes(skillDebloque.id);
  });
  if (resultat.eclats > 0) {
    alert("🎉 " + resultat.niveaux.join(", ") + " terminé !\n✨ +" + resultat.eclats + " éclats");
  }
  if (nouvellementDebloques.length > 0) {
    alert("🔓 Skill débloqué ! " + nouvellementDebloques.map(function(skillDebloque) {
      return skillDebloque.nom;
    }).join(", "));
  }
  if (typeof rafraichirOrdinateur === "function") rafraichirOrdinateur();
  window.dispatchEvent(new Event("skills:progression-change"));
}

function validerQueteConseillee(mail) {
  const skill = getSkill(mail.skillId);
  if (!skill || !estDebloque(skill)) return false;

  const indexNiveau = niveauEnCours(skill);
  if (indexNiveau === -1) return false;
  const indexQuete = indexProchaineQuete(skill, indexNiveau);
  const quete = skill.niveaux[indexNiveau].quetes[indexQuete];
  if (!quete || quete.id !== mail.queteId) return false;

  enregistrerQueteSkill(skill, quete);
  return true;
}

function validerQuete(indexSkill, indexNiveau, indexQuete) {
  const skill = skills[indexSkill];
  if (!estDebloque(skill)) return;
  if (indexNiveau !== niveauEnCours(skill)) return; // seule une quête du niveau en cours peut être validée
  if (indexQuete !== indexProchaineQuete(skill, indexNiveau)) return; // dans l'ordre : seule la prochaine quête
  const quete = skill.niveaux[indexNiveau].quetes[indexQuete];
  if (!quete || queteFaite(skill, quete)) return;
  if (!confirm("Valider « " + quete.nom + " » ?")) return;
  enregistrerQueteSkill(skill, quete);
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