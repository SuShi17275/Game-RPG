IMPOT_MENSUEL = 1100
DECOUVERT_AUTORISE = true // autorise le solde négatif

let argent = Number(localStorage.getItem("argent")) || 0;
let historique = JSON.parse(localStorage.getItem("historique")) || [];

function ajouterTransaction(libelle, montant, options) {
  options = options || {};
  if (montant > 0 && bonusActif()) montant *= 2;
  argent += montant;
  historique.push({
    date: options.date || new Date().toISOString(),
    libelle: libelle,
    montant: montant,
    type: options.type || "autre"
  });
  localStorage.setItem("argent", argent);
  localStorage.setItem("historique", JSON.stringify(historique));
  afficherArgent();
  afficherHistorique();
}

// ---------- Impôt mensuel ----------

function cleMois(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function moisSuivant(cle) {
  const a = Number(cle.split("-")[0]);
  const m = Number(cle.split("-")[1]);
  return m === 12 ? (a + 1) + "-01" : a + "-" + String(m + 1).padStart(2, "0");
}

function verifierImpot() {
  const moisCourant = cleMois(new Date());
  // Premier lancement : on commence à compter à partir du mois en cours
  let aImposer = localStorage.getItem("moisAImposer") || moisCourant;

  while (aImposer < moisCourant) { // un mois terminé = un prélèvement
    const a = Number(aImposer.split("-")[0]);
    const m = Number(aImposer.split("-")[1]);
    const nomMois = new Date(a, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const dateIso = new Date(a, m, 1).toISOString(); // le 1er du mois suivant
    const montant = DECOUVERT_AUTORISE ? IMPOT_MENSUEL : Math.min(IMPOT_MENSUEL, Math.max(0, argent));
    if (montant > 0) ajouterTransaction("Impôts — " + nomMois, -montant, { type: "impot", date: dateIso });
    aImposer = moisSuivant(aImposer);
  }
  localStorage.setItem("moisAImposer", aImposer);
}

document.addEventListener("visibilitychange", function() {
  if (!document.hidden) verifierImpot();
});

// ---------- Affichage ----------

function revenusDuMois() {
  const cle = cleMois(new Date());
  return historique
    .filter(function(t) { return t.montant > 0 && cleMois(new Date(t.date)) === cle; })
    .reduce(function(somme, t) { return somme + t.montant; }, 0);
}

function afficherArgent() {
  const solde = document.getElementById("solde");
  solde.textContent = argent;
  solde.parentElement.classList.toggle("negatif", argent < 0);

  const revenus = revenusDuMois();
  document.getElementById("revenus-mois").textContent = revenus;
  document.getElementById("impot-montant").textContent = IMPOT_MENSUEL;

  const barre = document.getElementById("barre-revenus");
  barre.style.width = Math.min(100, revenus / IMPOT_MENSUEL * 100) + "%";
  barre.classList.toggle("ok", revenus >= IMPOT_MENSUEL);

  const maintenant = new Date();
  const prochain = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 1);
  document.getElementById("prochain-impot").textContent =
    "Prochain impôt : " + IMPOT_MENSUEL + " 💰 le " + prochain.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}