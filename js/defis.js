let defisPossibles = [];
let defiActif = JSON.parse(localStorage.getItem("defiActif")) || null;
const CHANCE_DEFI = 0.3; // à ajuster

fetch("data/defis.json")
  .then(function(r) { return r.json(); })
  .then(function(donnees) {
    defisPossibles = donnees;
    verifierExpirationDefi();
    verifierNouveauDefi();
    afficherDefi();
  });

function sauvegarderDefi() {
  localStorage.setItem("defiActif", JSON.stringify(defiActif));
}

function verifierNouveauDefi() {
  if (defiActif || defisPossibles.length === 0) return;
  if (Math.random() < CHANCE_DEFI) {
    const choix = defisPossibles[Math.floor(Math.random() * defisPossibles.length)];
    defiActif = { nom: choix.nom, recompense: choix.recompense, dureeMinutes: choix.dureeMinutes, statut: "propose" };
    sauvegarderDefi();
  }
}

function accepterDefi() {
  if (!defiActif || defiActif.statut !== "propose") return;
  defiActif.statut = "accepte";
  defiActif.finAvant = new Date(Date.now() + defiActif.dureeMinutes * 60000).toISOString();
  sauvegarderDefi();
  afficherDefi();
}

function refuserDefi() {
  defiActif = null;
  sauvegarderDefi();
  afficherDefi();
}

function validerDefi() {
  if (!defiActif || defiActif.statut !== "accepte") return;
  ajouterTransaction(defiActif.nom, defiActif.recompense);
  defiActif = null;
  sauvegarderDefi();
  afficherDefi();
}

function verifierExpirationDefi() {
  if (defiActif && defiActif.statut === "accepte" && new Date(defiActif.finAvant) < new Date()) {
    ajouterTransaction(defiActif.nom, -defiActif.recompense);
    defiActif = null;
    sauvegarderDefi();
  }
}

function afficherDefi() {
  const c = document.getElementById("zone-defi");
  if (!defiActif) { c.innerHTML = "<p>Aucun défi en cours.</p>"; return; }

  if (defiActif.statut === "propose") {
    c.innerHTML = `
      <p>${defiActif.nom} — 💰 ${defiActif.recompense} — ${defiActif.dureeMinutes} min</p>
      <button onclick="accepterDefi()">Accepter</button>
      <button onclick="refuserDefi()">Refuser</button>
    `;
  } else {
    const restant = Math.ceil((new Date(defiActif.finAvant) - new Date()) / 60000);
    c.innerHTML = `
      <p>${defiActif.nom} en cours — ${restant} min restantes</p>
      <button onclick="validerDefi()">Valider (terminé)</button>
    `;
  }
}