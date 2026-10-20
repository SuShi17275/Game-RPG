const CHANCE_DEFI = 0.3;           // chance d'un défi à chaque ouverture
const JOURS_INACTIVITE = 3;        // jours sans connexion avant une quête supplémentaire
const EXPEDITEURS = { event: "Events", defi: "Défi express", supp: "On t'attend !" };

let mails = JSON.parse(localStorage.getItem("mails")) || [];
let defisPossibles = [];
let quetesSuppPossibles = [];
let eventsFichier = [];
let ongletMail = "nouveau";

function sauvegarderMails() {
  localStorage.setItem("mails", JSON.stringify(mails));
}

function trouverMail(id) {
  return mails.find(function(m) { return m.id === id; });
}

function estActif(m) {
  return m.statut === "attente" || m.statut === "accepte";
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

function ajouterMail(donnees) {
  const m = Object.assign({
    id: "m" + Date.now() + Math.floor(Math.random() * 1000),
    date: new Date().toISOString(),
    lu: false,
    statut: "attente"
  }, donnees);
  mails.push(m);
  sauvegarderMails();
  return m;
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
  livrerEvents();
  verifierExpirations();
  verifierNouveauDefi();
  verifierInactivite();
  afficherMail();
});

document.addEventListener("visibilitychange", function() {
  if (!document.hidden) {
    verifierExpirations();
    afficherMail();
  }
});

function verifierExpirations() {
  const maintenant = new Date();
  mails.forEach(function(m) {
    if (m.statut === "accepte" && m.finAvant && new Date(m.finAvant) < maintenant) {
      ajouterTransaction(m.objet, -m.recompense); // pénalité du défi raté
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
    const enAttente = mails.some(function(m) { return m.type === "supp" && estActif(m); });
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
  localStorage.setItem("derniereOuverture", maintenant.toISOString());
}

// ---------- Affichage ----------

function montrerVue(nom) {
  document.getElementById("mail-vue-liste").classList.toggle("cache", nom !== "liste");
  document.getElementById("mail-detail").classList.toggle("cache", nom !== "detail");
}

function afficherMail() {
  const nonLus = mails.filter(function(m) { return !m.lu && estActif(m); }).length;
  document.getElementById("compteur-nouveau").textContent = nonLus ? "(" + nonLus + ")" : "";
  const badge = document.getElementById("badge-mail");
  badge.textContent = nonLus;
  badge.classList.toggle("cache", nonLus === 0);

  document.querySelectorAll("#mail-onglets button").forEach(function(b) {
    b.classList.toggle("actif", b.dataset.onglet === ongletMail);
  });

  const affiches = mails.filter(function(m) {
    if (ongletMail === "nouveau") return !m.lu && estActif(m);
    if (ongletMail === "afaire") return m.lu && estActif(m);
    return !estActif(m);
  }).sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

  const liste = document.getElementById("mail-liste");
  if (affiches.length === 0) {
    liste.innerHTML = '<p class="mail-vide">Rien ici pour le moment.</p>';
    return;
  }
  liste.innerHTML = affiches.map(function(m) {
    const statut = libelleStatut(m);
    return `
      <div class="mail-ligne ${m.lu ? "" : "non-lu"}" onclick="ouvrirMail('${m.id}')">
        <div class="avatar avatar-${m.type}">${EXPEDITEURS[m.type][0]}</div>
        <div class="mail-texte">
          <div class="mail-expediteur">${EXPEDITEURS[m.type]}</div>
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
  document.getElementById("mail-detail").innerHTML = `
    <button onclick="retourListe()">← Retour</button>
    <h3>${echapper(m.objet)}</h3>
    <div class="mail-entete">
      <div class="avatar avatar-${m.type}">${EXPEDITEURS[m.type][0]}</div>
      <div><strong>${EXPEDITEURS[m.type]}</strong><br><small>${formaterDate(m.date)}</small></div>
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
  m.statut = "termine";
  sauvegarderMails();
  ajouterTransaction(m.objet, m.recompense);
  if (m.type === "defi") validerTacheAuto("quete-defi");
  retourListe();
}