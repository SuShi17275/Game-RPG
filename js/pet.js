const BAISSE_FAIM_PAR_HEURE = 4;
const BAISSE_ENERGIE_PAR_HEURE = 2;
const BAISSE_AMITIE_PAR_HEURE = 1 / 6;
const COOLDOWN_GAMELLE_MS = 60 * 60 * 1000;
const COOLDOWN_CARESSER_MS = 30 * 60 * 1000;
const MAX_REMPLISSAGES_PAR_JOUR = 3;
const MAX_PARTIES_PAR_JOUR = 5;
const GAIN_CARESSER = 20;
const CHANCE_BONUS = 0.2;
const DUREE_BONUS_MS = 60 * 60 * 1000;
const DELAI_TIRAGE_BONUS_MS = 60 * 60 * 1000;
const PRIX_REPAS_PET = 10;

const etatInitialPet = {
  faim: 100,
  energie: 100,
  amitie: 0,
  partiesJouees: 0,
  jourJeu: null,
  repasDisponibles: 0,
  remplissagesGamelle: 0,
  jourGamelle: null,
  derniereMaj: new Date().toISOString(),
  prochaineGamelle: null,
  prochainCaresser: null,
  dernierTirageBonus: null
};

let pet = Object.assign({}, etatInitialPet, lireStockage("pet", {}));
delete pet.proprete;
delete pet.prochainNourrir;
delete pet.prochainLaver;

function sauvegarderPet() {
  ecrireStockage("pet", JSON.stringify(pet));
}

function dateLocale() {
  const maintenant = new Date();
  return [
    maintenant.getFullYear(),
    String(maintenant.getMonth() + 1).padStart(2, "0"),
    String(maintenant.getDate()).padStart(2, "0")
  ].join("-");
}

function reinitialiserCompteurGamelle() {
  const aujourdHui = dateLocale();
  if (pet.jourGamelle !== aujourdHui) {
    pet.jourGamelle = aujourdHui;
    pet.remplissagesGamelle = 0;
  }
}

function reinitialiserCompteurJeu() {
  const aujourdHui = dateLocale();
  if (pet.jourJeu !== aujourdHui) {
    pet.jourJeu = aujourdHui;
    pet.partiesJouees = 0;
    sauvegarderPet();
  }
}

function peutJouerPet() {
  reinitialiserCompteurJeu();
  return pet.partiesJouees < MAX_PARTIES_PAR_JOUR;
}

function peutDormirPet() {
  return pet.energie < 70;
}

function peutAgir(dateProchaine) {
  return !dateProchaine || new Date(dateProchaine) <= new Date();
}

function minutesRestantes(dateProchaine) {
  return Math.max(0, Math.ceil((new Date(dateProchaine) - new Date()) / 60000));
}

function appliquerTempsEcoule() {
  const maintenant = new Date();
  const derniereMaj = new Date(pet.derniereMaj);
  const heuresPassees = Math.max(0, (maintenant - derniereMaj) / (1000 * 60 * 60));
  pet.faim = Math.max(0, pet.faim - heuresPassees * BAISSE_FAIM_PAR_HEURE);
  pet.energie = Math.max(0, pet.energie - heuresPassees * BAISSE_ENERGIE_PAR_HEURE);
  pet.amitie = Math.max(0, pet.amitie - heuresPassees * BAISSE_AMITIE_PAR_HEURE);
  pet.derniereMaj = maintenant.toISOString();
  reinitialiserCompteurGamelle();
  sauvegarderPet();
}

let derniereMajPetAuRetour = 0;

function actualiserPetAuRetour() {
  const maintenant = Date.now();
  if (maintenant - derniereMajPetAuRetour < 1000) return;
  derniereMajPetAuRetour = maintenant;
  appliquerTempsEcoule();
  verifierBonusAleatoire();
  afficherPet();
}

document.addEventListener("visibilitychange", function() {
  if (!document.hidden) actualiserPetAuRetour();
});

window.addEventListener("pageshow", function(evenement) {
  if (evenement.persisted) actualiserPetAuRetour();
});

function notifierGamelle() {
  window.dispatchEvent(new CustomEvent("pet:gamelle-change", {
    detail: { repasDisponibles: pet.repasDisponibles }
  }));
}

function remplirGamelle() {
  reinitialiserCompteurGamelle();
  if (pet.remplissagesGamelle >= MAX_REMPLISSAGES_PAR_JOUR) {
    alert("La limite de remplissages pour aujourd'hui est atteinte.");
    afficherPet();
    return;
  }
  if (!peutAgir(pet.prochaineGamelle)) {
    alert(`Tu pourras remplir la gamelle dans ${minutesRestantes(pet.prochaineGamelle)} min.`);
    afficherPet();
    return;
  }
  if (argent < PRIX_REPAS_PET) {
    alert("Il te faut " + PRIX_REPAS_PET + " 💰 pour remplir la gamelle.");
    afficherPet();
    return;
  }
  if (!confirm("Acheter une portion pour " + PRIX_REPAS_PET + " 💰 ?")) return;

  ajouterTransaction("Nourriture du pet", -PRIX_REPAS_PET, { type: "pet" });
  pet.repasDisponibles += 1;
  pet.remplissagesGamelle += 1;
  pet.prochaineGamelle = new Date(Date.now() + COOLDOWN_GAMELLE_MS).toISOString();
  sauvegarderPet();
  notifierGamelle();
  afficherPet();
}

function caresserPet() {
  if (!peutAgir(pet.prochainCaresser)) return false;
  pet.amitie = Math.min(100, pet.amitie + GAIN_CARESSER);
  pet.prochainCaresser = new Date(Date.now() + COOLDOWN_CARESSER_MS).toISOString();
  sauvegarderPet();
  afficherPet();
  return true;
}

function traiterActionPet(evenement) {
  const action = evenement.detail && evenement.detail.action;
  if (action === "manger") {
    pet.repasDisponibles = Math.max(0, pet.repasDisponibles - 1);
    pet.faim = Math.min(100, pet.faim + 35);
    notifierGamelle();
  } else if (action === "dormir") {
    pet.energie = Math.min(100, pet.energie + 45);
  } else if (action === "jouer") {
    reinitialiserCompteurJeu();
    if (pet.partiesJouees >= MAX_PARTIES_PAR_JOUR) return;
    pet.partiesJouees += 1;
    pet.amitie = Math.min(100, pet.amitie + 15);
    pet.energie = Math.max(0, pet.energie - 10);
  } else {
    return;
  }
  sauvegarderPet();
  afficherPet();
}

function verifierBonusAleatoire() {
  const bonusEnCours = pet.finBonus && new Date(pet.finBonus) > new Date();
  const petHeureux = pet.faim > 70 && pet.energie > 70 && pet.amitie > 70;
  const maintenant = Date.now();
  const dernierTirage = new Date(pet.dernierTirageBonus).getTime();
  const tirageAutorise = !Number.isFinite(dernierTirage) ||
    maintenant - dernierTirage >= DELAI_TIRAGE_BONUS_MS;

  if (!bonusEnCours && petHeureux && tirageAutorise) {
    pet.dernierTirageBonus = new Date(maintenant).toISOString();
    if (Math.random() < CHANCE_BONUS) {
      pet.finBonus = new Date(maintenant + DUREE_BONUS_MS).toISOString();
    }
    sauvegarderPet();
  }
}

function bonusActif() {
  return pet.finBonus && new Date(pet.finBonus) > new Date();
}

function etatPet() {
  if (pet.faim < 25 || pet.amitie < 25) return "Triste";
  if (pet.energie < 25) return "Fatigué";
  return "Heureux";
}

function afficherPet() {
  reinitialiserCompteurGamelle();
  const bulle = document.getElementById("pet-info-bulle");
  if (!bulle) return;
  bulle.querySelector("#pet-faim").textContent = Math.round(pet.faim) + "%";
  bulle.querySelector("#pet-energie").textContent = Math.round(pet.energie) + "%";
  bulle.querySelector("#pet-etat").textContent = etatPet();
  bulle.querySelector("#pet-amitie").textContent = Math.round(pet.amitie);
  bulle.querySelector("#pet-gamelle").textContent =
    `${pet.repasDisponibles} portion(s) · ${pet.remplissagesGamelle}/${MAX_REMPLISSAGES_PAR_JOUR} remplissages aujourd'hui · ${PRIX_REPAS_PET} 💰/portion` +
    (pet.remplissagesGamelle >= MAX_REMPLISSAGES_PAR_JOUR
      ? " · limite atteinte"
      : peutAgir(pet.prochaineGamelle)
        ? ""
        : ` · prochain remplissage dans ${minutesRestantes(pet.prochaineGamelle)} min`);
  reinitialiserCompteurJeu();
  bulle.querySelector("#pet-jeu").textContent =
    `Parties aujourd'hui : ${pet.partiesJouees}/${MAX_PARTIES_PAR_JOUR}`;
  bulle.querySelector("#pet-bonus").textContent =
    bonusActif() ? "Bonus actif (x2 argent) ✅" : "Pas de bonus";
  bulle.querySelector("#pet-caresser").textContent = peutAgir(pet.prochainCaresser)
    ? "Double-clique pour caresser."
    : `Caresser à nouveau dans ${minutesRestantes(pet.prochainCaresser)} min.`;
}

window.addEventListener("pet:action-terminee", traiterActionPet);
window.addEventListener("pet:pret", notifierGamelle);
window.addEventListener("pet:popup-prete", function() {
  afficherPet();
  notifierGamelle();
});
if (document.getElementById("pet-info-bulle")) {
  afficherPet();
  notifierGamelle();
}
