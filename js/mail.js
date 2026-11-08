const CHANCE_DEFI = 0.3;           // chance d'un défi à chaque ouverture
const JOURS_INACTIVITE = 3;        // jours sans connexion avant une quête supplémentaire
const EXPEDITEURS = { event: "Events", defi: "Défi express", supp: "On t'attend !" };

let mails = lireStockage("mails", []);
let defisPossibles = [];
let quetesSuppPossibles = [];
let eventsFichier = [];
let ongletMail = "nouveau";
let validationQueteDepuisMail = false;

function sauvegarderMails() {
  return ecrireStockage("mails", JSON.stringify(mails));
}

function trouverMail(id) {
  return mails.find(function(m) { return m.id === id; });
}

function estActif(m) {
  return m.statut === "attente" || m.statut === "accepte";
}

function estNotificationQueteTerminee(m) {
  return m.type === "supp" && Boolean(m.skillId) && m.statut === "termine";
}

function estNouveau(m) {
  return !m.lu && (estActif(m) || estNotificationQueteTerminee(m));
}

function nettoyerMails() {
  const limite = Date.now() - 90 * 86400000;
  mails = mails.filter(function(m) {
    return estActif(m) || estNouveau(m) || m.type === "event" || Date.parse(m.date) > limite;
  });
  sauvegarderMails();
}

function echapper(texte) {
  return String(texte).replace(/[&<>"]/g, function(c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function formaterDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function libelleStatut(m) {
  return { accepte: "en cours", termine: "✓ terminé", refuse: "refusé", expire: "expiré" }[m.statut] || "";
}

function nomExpediteur(m) {
  if (m.type === "supp" && m.skillId) return "Quête conseillée";
  return EXPEDITEURS[m.type] || "Inconnu";
}

function ajouterMail(donnees) {
  const m = Object.assign({
    id: genererIdMail(),
    date: new Date().toISOString(),
    lu: false,
    statut: "attente"
  }, donnees);
  mails.push(m);
  sauvegarderMails();
  return m;
}

function genererIdMail() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return "m" + window.crypto.randomUUID();
  }
  let id;
  do {
    id = "m" + Date.now() + Math.random().toString(36).slice(2);
  } while (mails.some(function(m) { return m.id === id; }));
  return id;
}

// ---------- Chargement des données et vérifications à l'ouverture ----------

function chargerJSON(chemin, options) {
  return fetch(chemin, options)
    .then(function(r) { return r.json(); })
    .catch(function() { console.warn(chemin + " invalide ou introuvable"); return []; });
}

Promise.all([
  chargerJSON("data/defis.json"),
  chargerJSON("data/quetes-supp.json"),
  chargerJSON("data/events.json", { cache: "no-cache" })
]).then(function(res) {
  defisPossibles = res[0];
  quetesSuppPossibles = res[1];
  eventsFichier = res[2];
  nettoyerMails();
  livrerEvents();
  verifierExpirations();
  verifierNouveauDefi();
  verifierInactivite();
  verifierQueteConseillee();
  afficherMail();
});

document.addEventListener("visibilitychange", function() {
  if (!document.hidden) {
    verifierExpirations();
    nettoyerMails();
    afficherMail();
  }
});

function verifierExpirations() {
  const maintenant = new Date();
  mails.forEach(function(m) {
    if (m.statut === "accepte" && m.finAvant && new Date(m.finAvant) < maintenant) {
      ajouterTransaction(m.objet, -m.recompense, { type: m.type }); // pénalité du défi raté
      m.statut = "expire";
      m.lu = true;
    } else if (m.statut === "attente" && m.type === "event" && m.fin && new Date(m.fin + "T23:59:59") < maintenant) {
      m.statut = "expire"; // event non fait : pas de pénalité
      m.lu = true;
    }
  });
  sauvegarderMails();
}

function livrerEvents() {
  const maintenant = new Date();
  eventsFichier.forEach(function(e) {
    if (e.debut && new Date(e.debut + "T00:00:00") > maintenant) return; // pas encore commencé

    const existant = mails.find(function(m) { return m.eventId === e.id; });
    if (existant) {
      if (existant.statut === "attente") { // tu as modifié le fichier : on met à jour
        existant.objet = e.nom;
        existant.corps = e.description || "Pas de description.";
        existant.recompense = e.recompense;
        existant.fin = e.fin || "";
      }
      return;
    }

    ajouterMail({
      type: "event",
      eventId: e.id,
      expediteur: EXPEDITEURS.event,
      objet: e.nom,
      corps: e.description || "Pas de description.",
      recompense: e.recompense,
      fin: e.fin || ""
    });
  });
  sauvegarderMails();
}

function verifierNouveauDefi() {
  const enCours = mails.some(function(m) { return m.type === "defi" && estActif(m); });
  if (enCours || defisPossibles.length === 0) return;
  const date = new Date();
  const aujourdHui = date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
  if (localStorage.getItem("dernierTirageDefi") === aujourdHui) return;
  ecrireStockage("dernierTirageDefi", aujourdHui);
  if (Math.random() < CHANCE_DEFI) {
    const d = defisPossibles[Math.floor(Math.random() * defisPossibles.length)];
    ajouterMail({
      type: "defi",
      expediteur: EXPEDITEURS.defi,
      objet: d.nom,
      corps: "Un défi t'attend : " + d.nom + ". Une fois accepté, tu as " + d.dureeMinutes + " minutes. Réussi, tu gagnes " + d.recompense + " 💰 ; raté, tu les perds. Refuser ne coûte rien.",
      recompense: d.recompense,
      dureeMinutes: d.dureeMinutes
    });
  }
}

function verifierInactivite() {
  const derniere = localStorage.getItem("derniereOuverture");
  const maintenant = new Date();
  if (derniere && quetesSuppPossibles.length > 0) {
    const jours = (maintenant - new Date(derniere)) / (1000 * 60 * 60 * 24);
    const enAttente = mails.some(function(m) {
      return m.type === "supp" && !m.skillId && estActif(m);
    });
    if (jours >= JOURS_INACTIVITE && !enAttente) {
      const q = quetesSuppPossibles[Math.floor(Math.random() * quetesSuppPossibles.length)];
      ajouterMail({
        type: "supp",
        expediteur: EXPEDITEURS.supp,
        objet: q.nom,
        corps: "Ça fait " + Math.floor(jours) + " jours qu'on ne t'a pas vu ! " + q.nom + ". Pas de limite de temps ni de pénalité : " + q.recompense + " 💰 à la clé.",
        recompense: q.recompense
      });
    }
  }
  ecrireStockage("derniereOuverture", maintenant.toISOString());
}

function verifierQueteConseillee() {
  synchroniserQuetesConseillees();
  const enAttente = mails.some(function(m) {
    return m.type === "supp" && m.skillId && estActif(m);
  });
  if (enAttente || typeof selectionnerQueteConseillee !== "function") return;

  const suggestion = selectionnerQueteConseillee();
  if (!suggestion) return;
  ajouterMail({
    type: "supp",
    expediteur: EXPEDITEURS.supp,
    objet: "Quête conseillée : " + suggestion.quete.nom,
    corps: "On te propose de reprendre le skill « " + suggestion.skill.nom +
      " » avec cette quête : " + suggestion.quete.nom +
      ". Pas de limite de temps ni de pénalité.",
    recompense: suggestion.quete.recompense,
    skillId: suggestion.skill.id,
    queteId: suggestion.quete.id
  });
}

function synchroniserQuetesConseillees() {
  if (typeof getSkill !== "function" ||
      typeof toutesLesQuetes !== "function" ||
      typeof queteFaite !== "function") return;

  let modifie = false;
  mails.forEach(function(m) {
    if (m.type !== "supp" || !m.skillId || !m.queteId || !estActif(m)) return;
    const skill = getSkill(m.skillId);
    if (!skill) return;
    const quete = toutesLesQuetes(skill).find(function(q) { return q.id === m.queteId; });
    if (!quete || !queteFaite(skill, quete)) return;
    m.statut = "termine";
    m.corps = (m.corps || "") + " Cette quête a été validée depuis l'application Skills.";
    m.lu = false;
    modifie = true;
  });
  if (modifie) sauvegarderMails();
}

window.addEventListener("skills:pretes", function() {
  verifierQueteConseillee();
  afficherMail();
});

window.addEventListener("skills:progression-change", function() {
  if (!validationQueteDepuisMail) synchroniserQuetesConseillees();
  afficherMail();
});

// ---------- Affichage ----------

function montrerVue(nom) {
  document.getElementById("mail-vue-liste").classList.toggle("cache", nom !== "liste");
  document.getElementById("mail-detail").classList.toggle("cache", nom !== "detail");
}

function afficherMail() {
  const nonLus = mails.filter(estNouveau).length;
  document.getElementById("compteur-nouveau").textContent = nonLus ? "(" + nonLus + ")" : "";
  const badge = document.getElementById("badge-mail");
  badge.textContent = nonLus;
  badge.classList.toggle("cache", nonLus === 0);

  document.querySelectorAll("#mail-onglets button").forEach(function(b) {
    b.classList.toggle("actif", b.dataset.onglet === ongletMail);
  });

  const affiches = mails.filter(function(m) {
    if (ongletMail === "nouveau") return estNouveau(m);
    if (ongletMail === "afaire") return m.lu && estActif(m);
    return !estActif(m) && !(estNotificationQueteTerminee(m) && !m.lu);
  }).sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

  const liste = document.getElementById("mail-liste");
  if (affiches.length === 0) {
    liste.innerHTML = '<p class="mail-vide">Rien ici pour le moment.</p>';
    return;
  }
  liste.innerHTML = affiches.map(function(m) {
    const statut = libelleStatut(m);
    const expediteur = nomExpediteur(m);
    return `
      <div class="mail-ligne ${m.lu ? "" : "non-lu"}" onclick="ouvrirMail('${m.id}')">
        <div class="avatar avatar-${m.type}">${expediteur[0]}</div>
        <div class="mail-texte">
          <div class="mail-expediteur">${expediteur}</div>
          <div class="mail-objet">${echapper(m.objet)}</div>
          <div class="mail-apercu">💰 ${m.recompense}${statut ? " · " + statut : ""}</div>
        </div>
        <div class="mail-date">${formaterDate(m.date)}</div>
      </div>
    `;
  }).join("");
}

function actionsMail(m) {
  if (m.statut === "attente" && m.type === "defi") {
    return `<button onclick="accepterDefi('${m.id}')">Accepter</button>
            <button onclick="refuserDefi('${m.id}')">Refuser</button>`;
  }
  if (m.statut === "accepte") {
    const restant = Math.max(0, Math.ceil((new Date(m.finAvant) - new Date()) / 60000));
    return `<p>⏳ Encore ${restant} min</p>
            <button onclick="validerMail('${m.id}')">Valider (terminé)</button>`;
  }
  if (m.statut === "attente") {
    return `<button onclick="validerMail('${m.id}')">Valider</button>`;
  }
  return `<p>Statut : ${libelleStatut(m)}</p>`;
}

function afficherDetail(m) {
  const expediteur = nomExpediteur(m);
  document.getElementById("mail-detail").innerHTML = `
    <button onclick="retourListe()">← Retour</button>
    <h3>${echapper(m.objet)}</h3>
    <div class="mail-entete">
      <div class="avatar avatar-${m.type}">${expediteur[0]}</div>
      <div><strong>${expediteur}</strong><br><small>${formaterDate(m.date)}</small></div>
    </div>
    <p>${echapper(m.corps)}</p>
    <p>💰 ${m.recompense}${m.fin ? " · jusqu'au " + new Date(m.fin).toLocaleDateString("fr-FR") : ""}</p>
    ${actionsMail(m)}
  `;
  montrerVue("detail");
}

// ---------- Navigation ----------

function ouvrirMail(id) {
  const m = trouverMail(id);
  if (!m) return;
  if (!m.lu) { m.lu = true; sauvegarderMails(); }
  afficherMail();
  afficherDetail(m);
}

function retourListe() {
  afficherMail();
  montrerVue("liste");
}

function changerOnglet(nom) {
  ongletMail = nom;
  retourListe();
}

// ---------- Actions ----------

function accepterDefi(id) {
  const m = trouverMail(id);
  if (!m || m.statut !== "attente") return;
  if (!confirm("Accepter ? Si tu rates, tu perds " + m.recompense + " 💰.")) return;
  m.statut = "accepte";
  m.finAvant = new Date(Date.now() + m.dureeMinutes * 60000).toISOString();
  sauvegarderMails();
  afficherMail();
  afficherDetail(m);
}

function refuserDefi(id) {
  const m = trouverMail(id);
  if (!m || m.statut !== "attente") return;
  m.statut = "refuse";
  sauvegarderMails();
  retourListe();
}

function validerMail(id) {
  verifierExpirations(); // au cas où le délai serait passé entre-temps
  const m = trouverMail(id);
  if (!m || !estActif(m)) { retourListe(); return; }
  if (m.type === "defi" && m.statut !== "accepte") return;
  if (!confirm("Valider « " + m.objet + " » ?")) return;
  let queteValidee = true;
  if (m.skillId) {
    validationQueteDepuisMail = true;
    try {
      queteValidee = validerQueteConseillee(m);
    } finally {
      validationQueteDepuisMail = false;
    }
  }
  if (!queteValidee) {
    alert("Cette quête n'est plus disponible. Elle a été retirée de ta liste.");
    m.statut = "expire";
    m.lu = true;
    sauvegarderMails();
    retourListe();
    return;
  }
  m.statut = "termine";
  m.lu = true;
  sauvegarderMails();
  if (!m.skillId) ajouterTransaction(m.objet, m.recompense, { type: m.type });
  if (m.type === "defi") validerTacheAuto("quete-defi");
  retourListe();
}