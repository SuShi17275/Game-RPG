if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(function() { console.log("Service worker enregistré"); })
    .catch(function(error) { console.log("Erreur :", error); });
}

afficherTaches();
afficherArgent();
verifierNouveauJour();
appliquerTempsEcoule();
afficherPet();
verifierBonusAleatoire();