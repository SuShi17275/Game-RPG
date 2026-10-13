const telephone = document.getElementById("telephone");

document.getElementById("btn-telephone").onclick = function() {
  telephone.classList.remove("cache");
  afficherEcran("accueil");
};

function fermerTelephone() {
  telephone.classList.add("cache");
}

function afficherEcran(nom) {
  document.querySelectorAll(".ecran").forEach(function(e) { e.classList.add("cache"); });
  document.getElementById("ecran-" + nom).classList.remove("cache");
  if (nom === "banque") afficherHistorique();
  if (nom === "bonus") afficherBonus();
}

function afficherHistorique() {
  const liste = document.getElementById("liste-historique");
  liste.innerHTML = "";
  historique.slice().reverse().forEach(function(t) {
    const date = new Date(t.date).toLocaleDateString("fr-FR");
    const signe = t.montant > 0 ? "+" : "";
    liste.innerHTML += `<li>${date} — ${t.libelle} : ${signe}${t.montant}</li>`;
  });
}

function afficherBonus() {
  const c = document.getElementById("liste-bonus");
  if (bonusActif()) {
    const minutes = Math.ceil((new Date(pet.finBonus) - new Date()) / 60000);
    c.innerHTML = `<p>🐾 Pet heureux : argent x2, encore ${minutes} min</p>`;
  } else {
    c.innerHTML = "<p>Aucun bonus actif pour le moment.</p>";
  }
}