let definitionsTaches = [];
let tachesFaites = JSON.parse(localStorage.getItem("tachesFaites")) || [];

const conteneur = document.getElementById("liste-taches");

fetch("data/taches.json")
  .then(function(r) { return r.json(); })
  .then(function(donnees) {
    definitionsTaches = donnees;
    verifierNouveauJour();
    afficherTaches();
  });

function sauvegarderTachesFaites() {
  localStorage.setItem("tachesFaites", JSON.stringify(tachesFaites));
}

function afficherTaches() {
  conteneur.innerHTML = "";
  definitionsTaches.forEach(function(t) {
    const fait = tachesFaites.includes(t.id);
    conteneur.innerHTML += `
      <p>
        <input type="checkbox" onchange="cocherTache('${t.id}')" ${fait ? "checked" : ""} ${fait || t.auto ? "disabled" : ""}>
        ${t.nom} (${t.gain})
      </p>
    `;
  });
  afficherObjets();
}

function trouverTache(id) {
  return definitionsTaches.find(function(t) { return t.id === id; });
}

function cocherTache(id) {
  const t = trouverTache(id);
  if (!t || t.auto || tachesFaites.includes(id)) return;
  if (!confirm(`Valider « ${t.nom} » ?`)) {
    afficherTaches(); // redécoche la case si tu annules
    return;
  }
  validerTache(t);
}

function validerTache(t) {
  tachesFaites.push(t.id);
  sauvegarderTachesFaites();
  ajouterTransaction(t.nom, t.gain, { type: "tache" });
  afficherTaches();
}

// Appelée par les quêtes de skill et les défis
function validerTacheAuto(id) {
  const t = trouverTache(id);
  if (!t || tachesFaites.includes(id)) return;
  validerTache(t);
}

function verifierNouveauJour() {
  const aujourdhui = new Date().toLocaleDateString("fr-CA");
  if (localStorage.getItem("derniereDate") !== aujourdhui) {
    tachesFaites = [];
    sauvegarderTachesFaites();
    localStorage.setItem("derniereDate", aujourdhui);
    afficherTaches();
  }
}

document.addEventListener("visibilitychange", function() {
  if (!document.hidden) verifierNouveauJour();
});