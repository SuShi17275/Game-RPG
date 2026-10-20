const ordinateur = document.getElementById("ordinateur");

function ouvrirOrdinateur() {
  ordinateur.classList.remove("cache");
  afficherEcranOrdi("accueil");
}

function fermerOrdinateur() {
  ordinateur.classList.add("cache");
}

function afficherEcranOrdi(nom) {
  document.querySelectorAll(".ecran-ordi").forEach(function(e) { e.classList.add("cache"); });
  document.getElementById("ordi-" + nom).classList.remove("cache");
  if (nom === "profil" && typeof afficherProfil === "function") afficherProfil();
  if (nom === "arbre" && typeof afficherArbre === "function") afficherArbre();
  if (nom === "stats" && typeof afficherStats === "function") afficherStats();
  if (nom === "boutique" && typeof afficherBoutique === "function") afficherBoutique();
}

// Appelée quand la progression change : redessine l'écran actuellement ouvert
function rafraichirOrdinateur() {
  const visible = document.querySelector(".ecran-ordi:not(.cache)");
  if (!visible) return;
  if (visible.id === "ordi-arbre" && typeof afficherArbre === "function") afficherArbre();
  if (visible.id === "ordi-boutique" && typeof afficherBoutique === "function") afficherBoutique();
  if (visible.id === "ordi-skill-detail" && typeof ouvrirSkill === "function" && skillOuvert !== null) ouvrirSkill(skillOuvert);
  if (visible.id === "ordi-profil" && typeof afficherProfil === "function") afficherProfil();
  if (visible.id === "ordi-stats" && typeof afficherStats === "function") afficherStats();
}