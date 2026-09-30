const BAISSE_PAR_HEURE = 4; // vitesse à laquelle faim/propreté baissent
const GAIN_ACTION = 20; // gain par nourrir/laver/caresser
const COOLDOWN_NOURRIR_MS = 60 * 60 * 1000; // 1h
const COOLDOWN_LAVER_MS = 60 * 60 * 1000; // 1h
const COOLDOWN_CARESSER_MS = 30 * 60 * 1000; // 30 min
const CHANCE_BONUS = 0.2;
const DUREE_BONUS_MS = 60 * 60 * 1000;

let pet = JSON.parse(localStorage.getItem("pet")) || {
  faim: 100,
  proprete: 100,
  amitie: 0,
  derniereMaj: new Date().toISOString(),
  prochainNourrir: null,
  prochainLaver: null,
  prochainCaresser: null
};

function sauvegarderPet() {
  localStorage.setItem("pet", JSON.stringify(pet));
}

function peutAgir(dateProchaine) {
  return !dateProchaine || new Date(dateProchaine) <= new Date();
}

function minutesRestantes(dateProchaine) {
  return Math.ceil((new Date(dateProchaine) - new Date()) / 60000);
}

function appliquerTempsEcoule() {
  const maintenant = new Date();
  const heuresPassees = (maintenant - new Date(pet.derniereMaj)) / (1000 * 60 * 60);
  pet.faim = Math.max(0, pet.faim - heuresPassees * BAISSE_PAR_HEURE);
  pet.proprete = Math.max(0, pet.proprete - heuresPassees * BAISSE_PAR_HEURE);
  pet.derniereMaj = maintenant.toISOString();
  sauvegarderPet();
}

function nourrirPet() {
  if (!peutAgir(pet.prochainNourrir)) return;
  pet.faim = Math.min(100, pet.faim + GAIN_ACTION);
  pet.prochainNourrir = new Date(Date.now() + COOLDOWN_NOURRIR_MS).toISOString();
  sauvegarderPet();
  afficherPet();
}

function laverPet() {
  if (!peutAgir(pet.prochainLaver)) return;
  pet.proprete = Math.min(100, pet.proprete + GAIN_ACTION);
  pet.prochainLaver = new Date(Date.now() + COOLDOWN_LAVER_MS).toISOString();
  sauvegarderPet();
  afficherPet();
}

function caresserPet() {
  if (!peutAgir(pet.prochainCaresser)) return;
  pet.amitie = Math.min(100, pet.amitie + GAIN_ACTION);
  pet.prochainCaresser = new Date(Date.now() + COOLDOWN_CARESSER_MS).toISOString();
  sauvegarderPet();
  afficherPet();
}

function verifierBonusAleatoire() {
  const bonusEnCours = pet.finBonus && new Date(pet.finBonus) > new Date();
  const petHeureux = pet.faim > 70 && pet.proprete > 70 && pet.amitie > 70;

  if (!bonusEnCours && petHeureux && Math.random() < CHANCE_BONUS) {
    pet.finBonus = new Date(Date.now() + DUREE_BONUS_MS).toISOString();
    sauvegarderPet();
  }
}

function bonusActif() {
  return pet.finBonus && new Date(pet.finBonus) > new Date();
}

function afficherPet() {
  document.getElementById("pet-faim").textContent = Math.round(pet.faim);
  document.getElementById("pet-proprete").textContent = Math.round(pet.proprete);
  document.getElementById("pet-amitie").textContent = Math.round(pet.amitie);
  document.getElementById("pet-bonus").textContent = bonusActif() ? "Bonus actif (x2 argent) ✅" : "Pas de bonus";

  configurerBouton("btn-nourrir", pet.prochainNourrir);
  configurerBouton("btn-laver", pet.prochainLaver);
  configurerBouton("btn-caresser", pet.prochainCaresser);
}

function configurerBouton(idBouton, dateProchaine) {
  const bouton = document.getElementById(idBouton);
  if (peutAgir(dateProchaine)) {
    bouton.disabled = false;
    bouton.textContent = bouton.dataset.label;
  } else {
    bouton.disabled = true;
    bouton.textContent = `${bouton.dataset.label} (${minutesRestantes(dateProchaine)} min)`;
  }
}