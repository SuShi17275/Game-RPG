const telephone = document.getElementById("telephone");

document.getElementById("btn-telephone").onclick = function() {
  telephone.classList.remove("cache");
  afficherHistorique();
};

function fermerTelephone() {
  telephone.classList.add("cache");
}

function afficherEcran(nom) {
  document.querySelectorAll(".ecran").forEach(function(e) { e.classList.add("cache"); });
  document.getElementById("ecran-" + nom).classList.remove("cache");
  if (nom === "banque") afficherHistorique();
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