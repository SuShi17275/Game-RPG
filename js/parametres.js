const FORMAT_EXPORT = "game-to-life";
const VERSION_EXPORT = 1;
const CLES_APP = [
  "argent", "historique", "tachesFaites", "derniereDate", "moisAImposer",
  "progressionSkills", "skillsAchetes", "skillsDebloques", "niveauxEclats",
  "paliersCredites", "eclatsDepenses", "pet", "mails", "dernierTirageDefi",
  "derniereOuverture", "dernierExport"
];
const CLES_JSON = {
  historique: "array",
  tachesFaites: "array",
  progressionSkills: "object",
  skillsAchetes: "array",
  skillsDebloques: "array",
  niveauxEclats: "object",
  paliersCredites: "object",
  pet: "object",
  mails: "array"
};

function messageParametres(message, erreur) {
  const element = document.getElementById("parametres-message");
  element.textContent = message;
  element.classList.toggle("erreur", Boolean(erreur));
}

function lireDonneesApp() {
  const donnees = Object.create(null);
  CLES_APP.forEach(function(cle) {
    const valeur = localStorage.getItem(cle);
    if (valeur !== null) donnees[cle] = valeur;
  });
  return donnees;
}

function supprimerDonneesApp() {
  CLES_APP.forEach(function(cle) {
    localStorage.removeItem(cle);
  });
}

function ecrireDonneesApp(donnees) {
  supprimerDonneesApp();
  Object.keys(donnees).forEach(function(cle) {
    if (CLES_APP.indexOf(cle) === -1 || cle === "historique") return;
    if (!ecrireStockage(cle, donnees[cle])) {
      throw new Error("Échec de l’écriture de « " + cle + " ».");
    }
  });
}

function exporterDonnees() {
  historiquePret.then(function() { return ecritureHistorique; }).then(function() {
    try {
      const dernierExport = new Date().toISOString();
      const donnees = Object.create(null);
      CLES_APP.forEach(function(cle) {
        const valeur = localStorage.getItem(cle);
        if (valeur !== null) donnees[cle] = valeur;
      });
      donnees.dernierExport = dernierExport;
      donnees.historique = JSON.stringify(historique);
      const exportJSON = {
        application: FORMAT_EXPORT,
        version: VERSION_EXPORT,
        exporteLe: new Date().toISOString(),
        donnees: donnees
      };
      const blob = new Blob([JSON.stringify(exportJSON, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = "game-to-life-" + cleJour(new Date()) + ".json";
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
      if (!ecrireStockage("dernierExport", dernierExport)) {
        messageParametres("Export téléchargé, mais impossible d’enregistrer la date du dernier export.", true);
        return;
      }
      const rappel = document.getElementById("rappel-export");
      if (rappel) rappel.remove();
      messageParametres("Export téléchargé.", false);
    } catch (erreur) {
      messageParametres("Export impossible : " + erreur.message, true);
    }
  });
}

function validerExport(exportJSON) {
  if (!exportJSON || exportJSON.application !== FORMAT_EXPORT ||
      exportJSON.version !== VERSION_EXPORT || !exportJSON.donnees ||
      typeof exportJSON.donnees !== "object" || Array.isArray(exportJSON.donnees)) {
    throw new Error("Ce fichier n’est pas une sauvegarde Game to Life reconnue.");
  }

  const donneesApp = Object.create(null);
  Object.keys(exportJSON.donnees).forEach(function(cle) {
    const valeur = exportJSON.donnees[cle];
    if (typeof valeur !== "string") {
      throw new Error("La valeur de sauvegarde « " + cle + " » est invalide.");
    }
    if (CLES_APP.indexOf(cle) === -1) return;
    if ((cle === "argent" || cle === "eclatsDepenses") && !Number.isFinite(Number(valeur))) {
      throw new Error("La valeur numérique de « " + cle + " » est invalide.");
    }
    if (cle === "moisAImposer" && !/^\d{4}-\d{2}$/.test(valeur)) {
      throw new Error("Le mois de prélèvement enregistré est invalide.");
    }
    if (Object.prototype.hasOwnProperty.call(CLES_JSON, cle)) {
      let parsee;
      try {
        parsee = JSON.parse(valeur);
      } catch (erreur) {
        throw new Error("La donnée « " + cle + " » n’est pas un JSON valide.");
      }
      const attendu = CLES_JSON[cle];
      if (attendu === "array" && !Array.isArray(parsee) ||
          attendu === "object" && (parsee === null || typeof parsee !== "object" || Array.isArray(parsee))) {
        throw new Error("Le format de la donnée « " + cle + " » est invalide.");
      }
    }
    donneesApp[cle] = valeur;
  });

  return donneesApp;
}

function importerDonnees(evenement) {
  const fichier = evenement.target.files[0];
  evenement.target.value = "";
  if (!fichier) return;
  if (fichier.size > 50 * 1024 * 1024) {
    messageParametres("Le fichier dépasse la limite de 50 Mo.", true);
    return;
  }

  const lecteur = new FileReader();
  lecteur.onerror = function() {
    messageParametres("Impossible de lire ce fichier.", true);
  };
  lecteur.onload = function() {
    let donnees;
    try {
      donnees = validerExport(JSON.parse(lecteur.result));
    } catch (erreur) {
      messageParametres(erreur.message, true);
      return;
    }
    if (!confirm("Importer cette sauvegarde remplacera toutes les données actuelles. Continuer ?")) return;

    historiquePret.then(function() { return ecritureHistorique; }).then(function() {
      const anciennesDonnees = lireDonneesApp();
      const ancienHistorique = historique.slice();
      const nouveauHistorique = donnees.historique ? JSON.parse(donnees.historique) : [];
      return remplacerHistorique(nouveauHistorique).then(function() {
        try {
          ecrireDonneesApp(donnees);
          if (!ecrireStockage("historique", JSON.stringify(historiqueActifLocal(nouveauHistorique)))) {
            throw new Error("Échec de l’écriture de l’historique.");
          }
        } catch (erreur) {
          try {
            ecrireDonneesApp(anciennesDonnees);
            if (anciennesDonnees.historique !== undefined &&
                !ecrireStockage("historique", anciennesDonnees.historique)) {
              throw new Error("Échec de la restauration de l’historique.");
            }
          } catch (erreurRestauration) {
            messageParametres("Échec de l’import et de la restauration de la sauvegarde précédente : " +
              erreurRestauration.message, true);
            return;
          }
          return remplacerHistorique(ancienHistorique).then(function() {
            messageParametres("Import impossible ; les données précédentes ont été restaurées : " +
              erreur.message, true);
          }).catch(function(erreurRestauration) {
            messageParametres("Import impossible et restauration de l’archive échouée : " +
              erreurRestauration.message, true);
          });
        }
        location.reload();
      });
    }).catch(function(erreur) {
      messageParametres("Import impossible : " + erreur.message, true);
    });
  };
  lecteur.readAsText(fichier);
}

function reinitialiserDonnees() {
  if (!confirm("Effacer définitivement toutes les données de Game to Life sur cet appareil ? Fais un export avant si tu veux les conserver.")) return;
  historiquePret.then(function() { return ecritureHistorique; }).then(function() {
    const ancienHistorique = historique.slice();
    const anciennesDonnees = lireDonneesApp();
    return remplacerHistorique([]).then(function() {
      try {
        supprimerDonneesApp();
      } catch (erreur) {
        return remplacerHistorique(ancienHistorique).then(function() {
          ecrireDonneesApp(anciennesDonnees);
          if (anciennesDonnees.historique !== undefined) {
            ecrireStockage("historique", anciennesDonnees.historique);
          }
          throw erreur;
        });
      }
    });
  }).then(function() {
    location.reload();
  }).catch(function(erreur) {
    messageParametres("Impossible d’effacer toutes les données : " + erreur.message, true);
  });
}

function afficherParametres() {
  const conteneur = document.getElementById("ordi-parametres");
  if (!conteneur) return;
  let dateDernierExport = NaN;
  try {
    dateDernierExport = Date.parse(localStorage.getItem("dernierExport"));
  } catch (erreur) {
    console.error("Impossible de lire la date du dernier export.", erreur);
  }
  const rappelExport = !Number.isFinite(dateDernierExport) ||
    Date.now() - dateDernierExport > 7 * 86400000;
  conteneur.innerHTML = `
    <h2>⚙️ Paramètres</h2>
    <section class="parametres-carte">
      <h3>Sauvegarde</h3>
      <p>Exporte tes données avant de vider le navigateur ou de désinstaller la PWA.</p>
      ${rappelExport ? "<p id=\"rappel-export\">⚠️ Pense à exporter tes données : ton dernier export date de plus de 7 jours (ou n’a pas encore été effectué).</p>" : ""}
      <p>Les transactions de plus de trois mois sont archivées localement et restent incluses dans les exports.</p>
      <button onclick="exporterDonnees()">📥 Exporter mes données</button>
      <label class="parametres-import">
        📤 Choisir une sauvegarde à importer
        <input type="file" accept="application/json,.json" onchange="importerDonnees(event)">
      </label>
      <small>L’import remplace les données de cette application sans toucher au stockage des autres projets.</small>
    </section>
    <section class="parametres-carte parametres-reset">
      <h3>Réinitialisation</h3>
      <p>Efface la progression et les données de cette application sur cet appareil.</p>
      <button onclick="reinitialiserDonnees()">Réinitialiser toutes les données</button>
    </section>
    <p id="parametres-message" role="status" aria-live="polite"></p>`;
}
