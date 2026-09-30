let quetesSuppPossibles = [];
let quetesSuppActives = JSON.parse(localStorage.getItem("quetesSuppActives")) || [];
const JOURS_INACTIVITE = 3; // à ajuster

fetch("data/quetes-supp.json")
  .then(function(r) { return r.json(); })
  .then(function(donnees) {
    quetesSuppPossibles = donnees;
    verifierInactivite();
    afficherQuetesSupp();
  });

function sauvegarderQuetesSupp() {
  localStorage.setItem("quetesSuppActives", JSON.stringify(quetesSuppActives));
}

function verifierInactivite() {
  const derniereOuverture = localStorage.getItem("derniereOuverture");
  const maintenant = new Date();

  if (derniereOuverture) {
    const jours = (maintenant - new Date(derniereOuverture)) / (1000 * 60 * 60 * 24);
    const aucuneEnCours = quetesSuppActives.filter(function(q) { return !q.faite; }).length === 0;
    if (jours >= JOURS_INACTIVITE && quetesSuppPossibles.length > 0 && aucuneEnCours) {
      const choix = quetesSuppPossibles[Math.floor(Math.random() * quetesSuppPossibles.length)];
      quetesSuppActives.push({ nom: choix.nom, recompense: choix.recompense, faite: false });
      sauvegarderQuetesSupp();
    }
  }
  localStorage.setItem("derniereOuverture", maintenant.toISOString());
}

function validerQueteSupp(index) {
  if (quetesSuppActives[index].faite) return;
  quetesSuppActives[index].faite = true;
  ajouterTransaction(quetesSuppActives[index].nom, quetesSuppActives[index].recompense);
  sauvegarderQuetesSupp();
  afficherQuetesSupp();
}

function afficherQuetesSupp() {
  const c = document.getElementById("liste-quetes-supp");
  c.innerHTML = "";
  quetesSuppActives.forEach(function(q, i) {
    if (q.faite) return;
    c.innerHTML += `<p>${q.nom} — 💰 ${q.recompense} <button onclick="validerQueteSupp(${i})">Valider</button></p>`;
  });
}
