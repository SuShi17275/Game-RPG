// Au chargement : on essaie de récupérer les tâches sauvegardées
const tachesSauvegardees = localStorage.getItem("taches");

let taches;
if (tachesSauvegardees) {
  taches = JSON.parse(tachesSauvegardees);
} else {
  taches = [
    {nom: "Faire son lit", fait: false},
    {nom: "Se brosser les dents", fait: false},
    {nom: "Revoir des cours", fait: false},
    {nom: "Lire", fait: false},
    {nom: "Dessin", fait: false},
    {nom: "Travailler sur un projet", fait: false},
    {nom: "Sport", fait: false},
    {nom: "Programmation", fait: false},
    {nom: "Ménage", fait: false},
    {nom: "Faire mon sac la veille", fait: false},
    {nom: "Loisir", fait: false},
    {nom: "Data analyst", fait: false}
  ];
}

const conteneur = document.getElementById("liste-taches");

function afficherTaches() {
  conteneur.innerHTML = "";
  taches.forEach(function(tache, index) {
    conteneur.innerHTML += `
      <p>
        <input type="checkbox" onchange="cocherTache(${index})" ${tache.fait ? "checked disabled" : ""}>
        ${tache.nom}
      </p>
    `;
  });
}

function cocherTache(index) {
  if (taches[index].fait) return;
  taches[index].fait = true;
  localStorage.setItem("taches", JSON.stringify(taches));
  ajouterTransaction(taches[index].nom, GAIN_PAR_TACHE);
  afficherTaches();
}

function verifierNouveauJour() {
  const aujourdhui = new Date().toLocaleDateString("fr-CA"); // format AAAA-MM-JJ
  if (localStorage.getItem("derniereDate") !== aujourdhui) {
    taches.forEach(function(t) { t.fait = false; });
    localStorage.setItem("taches", JSON.stringify(taches));
    localStorage.setItem("derniereDate", aujourdhui);
    afficherTaches();
  }
}

// Sur téléphone, l'appli reste souvent ouverte en arrière-plan : on revérifie quand on revient dessus
document.addEventListener("visibilitychange", function() {
  if (!document.hidden) verifierNouveauJour();
});