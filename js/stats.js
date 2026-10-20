// ===== stats.js : statistiques des skills (à partir des dates de validation) =====
// Utilise skills.js (skills, progression, toutesLesQuetes, queteFaite, getCategorie, soldeEclats, echapper).

let statsPeriode = 30; // période du classement des skills : 7, 30 ou 0 (= depuis le début)
const NB_JOURS_GRAPHIQUE = 14;

// ---------- dates ----------
function cleJour(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function joursEntre(cleA, cleB) {
  const a = new Date(cleA + "T12:00:00");
  const b = new Date(cleB + "T12:00:00");
  return Math.round((b - a) / 86400000);
}

function dateCourte(cle) {
  return new Date(cle + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function jourDecale(decalage) {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return d;
}

// ---------- données ----------
// Toutes les quêtes faites, triées de la plus ancienne à la plus récente
function listeQuetesFaites() {
  const liste = [];
  skills.forEach(function(skill) {
    toutesLesQuetes(skill).forEach(function(quete) {
      if (!queteFaite(skill, quete)) return;
      const date = new Date(progression[skill.id][quete.nom]);
      if (isNaN(date.getTime())) return;
      liste.push({ skill: skill, quete: quete, date: date, jour: cleJour(date) });
    });
  });
  liste.sort(function(a, b) { return a.date - b.date; });
  return liste;
}

// { "2026-10-19": 3, ... }
function quetesParJour(liste) {
  const compte = {};
  liste.forEach(function(e) { compte[e.jour] = (compte[e.jour] || 0) + 1; });
  return compte;
}

// Série de jours consécutifs avec au moins une quête
function calculerSeries(compte) {
  const jours = Object.keys(compte).sort();
  let meilleure = 0;
  let enCours = 0;
  let precedent = null;
  jours.forEach(function(j) {
    enCours = precedent !== null && joursEntre(precedent, j) === 1 ? enCours + 1 : 1;
    if (enCours > meilleure) meilleure = enCours;
    precedent = j;
  });
  // la série "actuelle" compte si la dernière quête date d'aujourd'hui ou d'hier
  const dernier = jours[jours.length - 1];
  const actuelle = dernier === cleJour(new Date()) || dernier === cleJour(jourDecale(-1)) ? enCours : 0;
  return { actuelle: actuelle, meilleure: meilleure };
}

// Classement des skills par nombre de quêtes faites sur la période
function classementSkills(liste, periode) {
  const limite = periode > 0 ? cleJour(jourDecale(-(periode - 1))) : null;
  const compte = {};
  liste.forEach(function(e) {
    if (limite !== null && e.jour < limite) return;
    compte[e.skill.id] = (compte[e.skill.id] || 0) + 1;
  });
  return Object.keys(compte)
    .map(function(id) { return { skill: getSkill(id), nb: compte[id] }; })
    .sort(function(a, b) { return b.nb - a.nb || a.skill.nom.localeCompare(b.skill.nom); });
}

function changerPeriodeStats(jours) {
  statsPeriode = jours;
  afficherStats();
}

// ---------- affichage ----------
function afficherStats() {
  const conteneur = document.getElementById("ordi-stats");
  if (!conteneur) return;
  if (skills.length === 0) {
    conteneur.innerHTML = "<h2>📈 Statistiques</h2><p>Chargement…</p>";
    return;
  }

  const liste = listeQuetesFaites();
  const compte = quetesParJour(liste);
  const series = calculerSeries(compte);
  const xpTotal = liste.reduce(function(t, e) { return t + e.quete.recompense; }, 0);

  // meilleur jour
  let meilleurJour = null;
  Object.keys(compte).forEach(function(j) {
    if (meilleurJour === null || compte[j] > compte[meilleurJour]) meilleurJour = j;
  });

  let html = "<h2>📈 Statistiques</h2>";

  // --- tuiles ---
  html += `
    <div class="stats-tuiles">
      <div class="stats-tuile"><strong>${liste.length}</strong><span>quêtes faites</span></div>
      <div class="stats-tuile"><strong>${xpTotal}</strong><span>XP gagnée</span></div>
      <div class="stats-tuile"><strong>${series.actuelle} 🔥</strong><span>jours d'affilée</span></div>
      <div class="stats-tuile"><strong>${series.meilleure}</strong><span>meilleure série</span></div>
    </div>`;

  // --- graphique : quêtes par jour ---
  const jours = [];
  for (let i = NB_JOURS_GRAPHIQUE - 1; i >= 0; i--) jours.push(jourDecale(-i));
  const maxJour = Math.max(1, Math.max.apply(null, jours.map(function(d) { return compte[cleJour(d)] || 0; })));
  const aujourdhui = cleJour(new Date());

  html += `<h3>Quêtes par jour</h3><div class="stats-barres">`;
  jours.forEach(function(d) {
    const cle = cleJour(d);
    const nb = compte[cle] || 0;
    const hauteur = nb === 0 ? 2 : Math.max(8, Math.round(nb / maxJour * 100));
    const lettre = d.toLocaleDateString("fr-FR", { weekday: "narrow" });
    html += `
      <div class="stats-col${cle === aujourdhui ? " aujourdhui" : ""}">
        <span class="stats-nb">${nb > 0 ? nb : ""}</span>
        <span class="stats-barre${nb === 0 ? " vide" : ""}" style="height:${hauteur}px"></span>
        <span class="stats-jour">${echapper(lettre)}<br>${d.getDate()}</span>
      </div>`;
  });
  html += `</div>`;

  // --- classement des skills ---
  const classement = classementSkills(liste, statsPeriode).slice(0, 5);
  const maxSkill = classement.length > 0 ? classement[0].nb : 1;
  const bouton = function(jours, texte) {
    return `<button class="${statsPeriode === jours ? "actif" : ""}" onclick="changerPeriodeStats(${jours})">${texte}</button>`;
  };

  html += `
    <h3>Skills les plus travaillés</h3>
    <div class="stats-periodes">${bouton(7, "7 jours")}${bouton(30, "30 jours")}${bouton(0, "Tout")}</div>`;

  if (classement.length === 0) {
    html += `<p class="stats-vide">Aucune quête sur cette période.</p>`;
  }
  classement.forEach(function(e, i) {
    const cat = getCategorie(e.skill.categorie);
    html += `
      <div class="stats-skill" style="border-left-color:${cat.couleur}">
        <span class="stats-skill-nom">${i === 0 ? "🏆 " : ""}${cat.icone} ${echapper(e.skill.nom)}</span>
        <span class="stats-skill-nb">${e.nb} quête${e.nb > 1 ? "s" : ""}</span>
        <span class="skill-barre"><span style="width:${Math.round(e.nb / maxSkill * 100)}%;background:${cat.couleur}"></span></span>
      </div>`;
  });

  // --- records ---
  const derniere = liste.length > 0 ? liste[liste.length - 1] : null;
  html += `<h3>Records</h3><ul class="stats-records">`;
  html += `<li>✨ Éclats disponibles : <strong>${soldeEclats()}</strong></li>`;
  html += meilleurJour !== null
    ? `<li>📅 Meilleur jour : <strong>${compte[meilleurJour]} quête${compte[meilleurJour] > 1 ? "s" : ""}</strong> (${echapper(dateCourte(meilleurJour))})</li>`
    : `<li>📅 Meilleur jour : pas encore de quête</li>`;
  html += derniere !== null
    ? `<li>🕒 Dernière quête : <strong>${echapper(derniere.quete.nom)}</strong> (${echapper(dateCourte(derniere.jour))})</li>`
    : `<li>🕒 Dernière quête : aucune</li>`;
  html += `</ul>`;

  conteneur.innerHTML = html;
}
