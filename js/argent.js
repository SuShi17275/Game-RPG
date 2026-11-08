const IMPOT_MENSUEL = 1100;
const DECOUVERT_AUTORISE = true; // autorise le solde négatif
const BASE_HISTORIQUE = "game-to-life-historique";
const VERSION_BASE_HISTORIQUE = 1;

function lireStockage(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle);
    if (brut === null) return defaut;
    try {
      return JSON.parse(brut);
    } catch (erreur) {
      console.warn("Donnée de stockage invalide pour « " + cle + " »; valeur par défaut utilisée.", erreur);
      return defaut;
    }
  } catch (e) {
    console.error("Impossible de lire la donnée de stockage « " + cle + " ».", e);
    return defaut;
  }
}

function ecrireStockage(cle, valeur) {
  try {
    localStorage.setItem(cle, valeur);
    return true;
  } catch (erreur) {
    alert("Impossible d’enregistrer les données. Le stockage est peut-être plein : fais un export dans Paramètres.");
    console.error("Impossible d’écrire la donnée de stockage « " + cle + " ».", erreur);
    return false;
  }
}

function ecrireHistoriqueLocal(operations) {
  if (!ecrireStockage("historique", JSON.stringify(operations))) {
    throw new Error("Impossible de sauvegarder l’historique des transactions.");
  }
}

let argent = Number(localStorage.getItem("argent")) || 0;
let historique = lireStockage("historique", []);
let baseHistorique = null;
let clesArchivees = new Set();
let ecritureHistorique = Promise.resolve();

function genererCleArchive() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return "transaction:" + window.crypto.randomUUID();
  }
  return "transaction:" + Date.now() + ":" + Math.random().toString(36).slice(2);
}

function attribuerClesArchive(operations) {
  const occurrencesParDate = Object.create(null);
  operations.forEach(function(operation) {
    const date = operation.date || "sans-date";
    occurrencesParDate[date] = (occurrencesParDate[date] || 0) + 1;
    if (!operation.archiveKey) {
      operation.archiveKey = "ancienne:" + date + ":" + occurrencesParDate[date];
    }
  });
}

function ouvrirBaseHistorique() {
  return new Promise(function(resolve, reject) {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB n’est pas disponible dans ce navigateur."));
      return;
    }
    const requete = window.indexedDB.open(BASE_HISTORIQUE, VERSION_BASE_HISTORIQUE);
    requete.onupgradeneeded = function() {
      const base = requete.result;
      if (!base.objectStoreNames.contains("transactions")) {
        base.createObjectStore("transactions", { keyPath: "archiveKey" });
      }
    };
    requete.onsuccess = function() { resolve(requete.result); };
    requete.onerror = function() { reject(requete.error); };
  });
}

function dateLimiteHistorique() {
  const limite = new Date();
  const jour = limite.getDate();
  limite.setDate(1);
  limite.setMonth(limite.getMonth() - 3);
  const dernierJour = new Date(limite.getFullYear(), limite.getMonth() + 1, 0).getDate();
  limite.setDate(Math.min(jour, dernierJour));
  return limite;
}

function separerHistorique(operations) {
  const limite = dateLimiteHistorique().getTime();
  const archives = [];
  const actifs = [];
  operations.forEach(function(operation) {
    const date = Date.parse(operation.date);
    if (Number.isFinite(date) && date < limite) archives.push(operation);
    else actifs.push(operation);
  });
  return { archives: archives, actifs: actifs };
}

function historiqueActifLocal(operations) {
  return baseHistorique ? separerHistorique(operations).actifs : operations;
}

function persisterHistorique() {
  if (!baseHistorique) {
    ecrireHistoriqueLocal(historique);
    return Promise.resolve();
  }

  attribuerClesArchive(historique);
  const groupes = separerHistorique(historique);
  const aArchiver = groupes.archives.filter(function(operation) {
    return !clesArchivees.has(operation.archiveKey);
  });
  if (aArchiver.length === 0) {
    ecrireHistoriqueLocal(groupes.actifs);
    return Promise.resolve();
  }
  return new Promise(function(resolve, reject) {
    const transaction = baseHistorique.transaction("transactions", "readwrite");
    const magasin = transaction.objectStore("transactions");
    aArchiver.forEach(function(operation) { magasin.put(operation); });
    transaction.oncomplete = function() {
      aArchiver.forEach(function(operation) { clesArchivees.add(operation.archiveKey); });
      try {
        ecrireHistoriqueLocal(groupes.actifs);
        resolve();
      } catch (erreur) {
        reject(erreur);
      }
    };
    transaction.onerror = function() { reject(transaction.error); };
    transaction.onabort = function() { reject(transaction.error); };
  });
}

function initialiserHistorique() {
  const historiqueInitial = historique.slice();
  return ouvrirBaseHistorique()
    .then(function(base) {
      baseHistorique = base;
      return new Promise(function(resolve, reject) {
        const transaction = base.transaction("transactions", "readonly");
        const requete = transaction.objectStore("transactions").getAll();
        requete.onsuccess = function() { resolve(requete.result); };
        requete.onerror = function() { reject(requete.error); };
      });
    })
    .then(function(archives) {
      clesArchivees = new Set(archives.map(function(operation) { return operation.archiveKey; }));
      const operationsAjoutees = historique.filter(function(operation) {
        return historiqueInitial.indexOf(operation) === -1;
      });
      attribuerClesArchive(historiqueInitial.concat(operationsAjoutees));
      const clesDejaArchivees = new Set(archives.map(function(operation) { return operation.archiveKey; }));
      historique = archives.concat(historiqueInitial.filter(function(operation) {
        return !clesDejaArchivees.has(operation.archiveKey);
      }), operationsAjoutees);
      historique.sort(function(a, b) { return Date.parse(a.date) - Date.parse(b.date); });
      return persisterHistorique();
    })
    .catch(function(erreur) {
      baseHistorique = null;
      clesArchivees = new Set();
      historique = historiqueInitial.concat(historique.filter(function(operation) {
        return historiqueInitial.indexOf(operation) === -1;
      }));
      console.error("Impossible d’initialiser l’archive des transactions; l’historique reste dans le stockage local.", erreur);
      try {
        ecrireHistoriqueLocal(historique);
      } catch (erreurSauvegarde) {
        console.error("Impossible de sauvegarder l’historique des transactions.", erreurSauvegarde);
      }
    })
    .then(function() {
      window.dispatchEvent(new Event("historique:pret"));
    });
}

const historiquePret = initialiserHistorique();

function remplacerHistorique(nouvellesOperations) {
  return historiquePret.then(function() { return ecritureHistorique; }).then(function() {
    const ancienHistorique = historique;
    const ancienneValeurLocale = localStorage.getItem("historique");
    const remplacement = nouvellesOperations.slice();
    attribuerClesArchive(remplacement);

    function ecrireDansBase(operations, vider) {
      if (!baseHistorique) {
        clesArchivees = new Set();
        ecrireHistoriqueLocal(operations);
        return Promise.resolve();
      }
      return new Promise(function(resolve, reject) {
        const transaction = baseHistorique.transaction("transactions", "readwrite");
        const magasin = transaction.objectStore("transactions");
        if (vider) magasin.clear();
        separerHistorique(operations).archives.forEach(function(operation) { magasin.put(operation); });
        transaction.oncomplete = function() {
          if (vider) {
            clesArchivees = new Set(separerHistorique(operations).archives.map(function(operation) {
              return operation.archiveKey;
            }));
          }
          resolve();
        };
        transaction.onerror = function() { reject(transaction.error); };
        transaction.onabort = function() { reject(transaction.error); };
      });
    }

    return ecrireDansBase(remplacement, true).then(function() {
      historique = remplacement;
      try {
        ecrireHistoriqueLocal(historiqueActifLocal(remplacement));
      } catch (erreur) {
        historique = ancienHistorique;
        return ecrireDansBase(ancienHistorique, true).then(function() {
          if (ancienneValeurLocale === null) localStorage.removeItem("historique");
          else if (!ecrireStockage("historique", ancienneValeurLocale)) {
            throw new Error("Impossible de restaurer l’historique des transactions.");
          }
          throw erreur;
        });
      }
    });
  });
}

function ajouterTransaction(libelle, montant, options) {
  options = options || {};
  if (montant > 0 && bonusActif()) montant *= 2;
  const ancienArgent = argent;
  argent += montant;
  historique.push({
    archiveKey: genererCleArchive(),
    date: options.date || new Date().toISOString(),
    libelle: libelle,
    montant: montant,
    type: options.type || "autre"
  });
  if (!ecrireStockage("argent", argent)) {
    argent = ancienArgent;
    historique.pop();
    return;
  }
  ecritureHistorique = ecritureHistorique
    .then(function() { return historiquePret; })
    .then(persisterHistorique)
    .catch(function(erreur) {
      console.error("Impossible de sauvegarder l’historique des transactions.", erreur);
      try {
        ecrireHistoriqueLocal(historique);
      } catch (erreurSauvegarde) {
        console.error("Impossible de sauvegarder l’historique des transactions dans le stockage local.", erreurSauvegarde);
      }
    });
  afficherArgent();
  const ecranBanque = document.getElementById("ecran-banque");
  if (ecranBanque && !ecranBanque.classList.contains("cache")) afficherHistorique();
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
  ecrireStockage("moisAImposer", aImposer);
}

document.addEventListener("visibilitychange", function() {
  if (!document.hidden) verifierImpot();
});

setInterval(verifierImpot, 60 * 60 * 1000);

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