const ordinateur = document.getElementById("ordinateur");

function ouvrirOrdinateur() {
  ordinateur.classList.remove("cache");
  ordinateur.classList.remove("ordi-skills");
  afficherEcranOrdi("accueil");
}

function fermerOrdinateur() {
  ordinateur.classList.add("cache");
  if (typeof fermerDetailSkill === "function") fermerDetailSkill();
}

function afficherEcranOrdi(nom) {
  document.querySelectorAll(".ecran-ordi").forEach(function(e) { e.classList.add("cache"); });
  document.getElementById("ordi-" + nom).classList.remove("cache");
  ordinateur.classList.toggle("ordi-skills", nom === "arbre");
  if (nom !== "arbre" && typeof fermerDetailSkill === "function") fermerDetailSkill();
  if (nom === "profil" && typeof afficherProfil === "function") afficherProfil();
  if (nom === "arbre" && typeof afficherArbre === "function") afficherArbre();
  if (nom === "stats" && typeof afficherStats === "function") afficherStats();
  if (nom === "boutique" && typeof afficherBoutique === "function") afficherBoutique();
  if (nom === "parametres" && typeof afficherParametres === "function") afficherParametres();
}

// Appelée quand la progression change : redessine l'écran actuellement ouvert
function rafraichirOrdinateur() {
  const visible = document.querySelector(".ecran-ordi:not(.cache)");
  if (!visible) return;
  if (visible.id === "ordi-arbre" && typeof afficherArbre === "function") afficherArbre();
  if (visible.id === "ordi-boutique" && typeof afficherBoutique === "function") afficherBoutique();
  if (visible.id === "ordi-profil" && typeof afficherProfil === "function") afficherProfil();
  if (visible.id === "ordi-stats" && typeof afficherStats === "function") afficherStats();
  if (visible.id === "ordi-parametres" && typeof afficherParametres === "function") afficherParametres();
}