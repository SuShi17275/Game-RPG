const telephone = document.getElementById("telephone");

document.getElementById("btn-telephone").onclick = function() {
  telephone.classList.remove("cache");
  afficherEcran("accueil");
};

function fermerTelephone() {
  telephone.classList.add("cache");
}

function afficherEcran(nom) {
  document.querySelectorAll(".ecran").forEach(function(e) { e.classList.add("cache"); });
  document.getElementById("ecran-" + nom).classList.remove("cache");
  if (nom === "banque") { afficherArgent(); afficherHistorique(); }
  if (nom === "bonus") afficherBonus();
  if (nom === "events") retourListe();
} 

function libelleJour(date) {
  const aujourdhui = new Date();
  const hier = new Date();
  hier.setDate(hier.getDate() - 1);
  if (date.toDateString() === aujourdhui.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === hier.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

const ICONES_OPERATION = {
  tache: "✅",
  skill: "🌱",
  event: "🎯",
  defi: "⚡",
  supp: "📬",
  impot: "🏛️",
  pet: "🐾",
  autre: "💰"
};

function typeOperation(t) {
  if (t.type) return t.type;
  // anciennes opérations enregistrées sans type
  if (t.libelle && t.libelle.indexOf("Impôts") === 0) return "impot";
  return "autre";
}

function afficherHistorique() {
  const liste = document.getElementById("liste-historique");

  const operations = historique.slice().sort(function(a, b) {
    return new Date(b.date) - new Date(a.date);
  });

  if (operations.length === 0) {
    liste.innerHTML = '<li class="operation-vide">Aucune opération pour le moment.</li>';
    return;
  }

  // Regroupe les opérations par jour
  const groupes = [];
  operations.forEach(function(t) {
    const jour = libelleJour(new Date(t.date));
    let g = groupes[groupes.length - 1];
    if (!g || g.jour !== jour) {
      g = { jour: jour, total: 0, ops: [] };
      groupes.push(g);
    }
    g.total += t.montant;
    g.ops.push(t);
  });

  // On affiche les 14 derniers jours qui contiennent des opérations
  liste.innerHTML = groupes.slice(0, 14).map(function(g) {
    const lignes = g.ops.map(function(t) {
      const positif = t.montant > 0;
      const icone = ICONES_OPERATION[typeOperation(t)] || ICONES_OPERATION.autre;
      return `
        <li class="operation ${positif ? "plus" : "moins"}">
          <span class="operation-icone">${icone}</span>
          <span class="operation-libelle">${echapper(t.libelle)}</span>
          <span class="operation-montant">${positif ? "+" : ""}${t.montant}</span>
        </li>
      `;
    }).join("");
    return `
      <li class="operation-jour">
        <span>${g.jour}</span>
        <span class="${g.total >= 0 ? "plus" : "moins"}">${g.total > 0 ? "+" : ""}${g.total}</span>
      </li>
      ${lignes}
    `;
  }).join("");
}


function afficherBonus() {
  const c = document.getElementById("liste-bonus");
  if (bonusActif()) {
    const minutes = Math.ceil((new Date(pet.finBonus) - new Date()) / 60000);
    c.innerHTML = `<p>🐾 Pet heureux : argent x2, encore ${minutes} min</p>`;
  } else {
    c.innerHTML = "<p>Aucun bonus actif pour le moment.</p>";
  }
}