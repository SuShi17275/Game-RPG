const GAIN_PAR_TACHE = 10; // provisoire, à ajuster quand tu auras décidé

let argent = Number(localStorage.getItem("argent")) || 0;
let historique = JSON.parse(localStorage.getItem("historique")) || [];

function ajouterTransaction(libelle, montant) {
    if (montant > 0 && bonusActif()) montant *= 2;
    argent += montant;
    historique.push({date: new Date().toISOString(), libelle: libelle, montant: montant});
    localStorage.setItem("argent", argent);
    localStorage.setItem("historique", JSON.stringify(historique));
    afficherArgent();
    afficherHistorique();
}

function afficherArgent() {
    document.getElementById("solde").textContent = argent;
}