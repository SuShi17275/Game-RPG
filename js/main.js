if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(function() { console.log("Service worker enregistré"); })
    .catch(function(error) { console.log("Erreur :", error); });
}

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(function(error) {
    console.warn("Impossible de demander le stockage persistant.", error);
  });
}

verifierImpot();
afficherArgent();
appliquerTempsEcoule();
verifierBonusAleatoire();
afficherPet();