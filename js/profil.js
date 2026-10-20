// ===== profil.js : profil radar (rang E → S par catégorie) =====
// Utilise skills.js (skills, categories, configSkills, toutesLesQuetes, queteFaite, echapper).
// Les seuils de rang se modifient dans data/config-skills.json, bloc "rangs" (sinon valeurs par défaut ci-dessous).

const RANGS_DEFAUT = [
  { lettre: "E", xp: 0 },
  { lettre: "D", xp: 50 },
  { lettre: "C", xp: 150 },
  { lettre: "B", xp: 350 },
  { lettre: "A", xp: 700 },
  { lettre: "S", xp: 1200 }
];

function listeRangs() {
  const r = configSkills && configSkills.rangs;
  return Array.isArray(r) && r.length >= 2 ? r : RANGS_DEFAUT;
}

// ---------- calculs ----------
// XP d'un skill = somme des récompenses des quêtes faites
function xpSkill(skill) {
  return toutesLesQuetes(skill)
    .filter(function(q) { return queteFaite(skill, q); })
    .reduce(function(total, q) { return total + q.recompense; }, 0);
}

function xpCategorie(idCategorie) {
  return skills
    .filter(function(s) { return s.categorie === idCategorie; })
    .reduce(function(total, s) { return total + xpSkill(s); }, 0);
}

// Transforme l'XP en valeur continue : 0 = début de E, 1 = début de D, ... (dernier rang = valeur max)
function valeurRang(xp) {
  const rangs = listeRangs();
  let i = 0;
  while (i + 1 < rangs.length && xp >= rangs[i + 1].xp) i++;
  if (i === rangs.length - 1) return i;
  const debut = rangs[i].xp;
  const fin = rangs[i + 1].xp;
  return i + (xp - debut) / (fin - debut);
}

function lettreRang(valeur) {
  const rangs = listeRangs();
  return rangs[Math.min(Math.floor(valeur), rangs.length - 1)].lettre;
}

// XP qui manque pour le rang suivant (null si déjà au rang max)
function xpProchainRang(xp) {
  const rangs = listeRangs();
  for (let i = 0; i < rangs.length; i++) {
    if (xp < rangs[i].xp) return rangs[i].xp;
  }
  return null;
}

// ---------- affichage ----------
function afficherProfil() {
  const conteneur = document.getElementById("ordi-profil");
  if (!conteneur) return;
  if (categories.length === 0) {
    conteneur.innerHTML = "<h2>🕸️ Profil</h2><p>Chargement…</p>";
    return;
  }

  const rangs = listeRangs();
  const niveauMax = rangs.length - 1;
  const n = categories.length;

  const donnees = categories.map(function(cat) {
    const listeSkills = skills
      .filter(function(skill) { return skill.categorie === cat.id; })
      .map(function(skill) {
        const quetes = toutesLesQuetes(skill);
        const faites = quetes.filter(function(quete) { return queteFaite(skill, quete); }).length;
        const xp = xpSkill(skill);
        return {
          skill: skill,
          xp: xp,
          faites: faites,
          total: quetes.length,
          pourcentage: quetes.length === 0 ? 0 : Math.round(faites / quetes.length * 100)
        };
      })
      .sort(function(a, b) {
        return b.xp - a.xp || b.faites - a.faites || a.skill.nom.localeCompare(b.skill.nom);
      });
    const xp = listeSkills.reduce(function(total, detail) { return total + detail.xp; }, 0);
    const valeur = valeurRang(xp);
    return { cat: cat, xp: xp, valeur: valeur, lettre: lettreRang(valeur), skills: listeSkills };
  });

  const moyenne = donnees.reduce(function(t, d) { return t + d.valeur; }, 0) / n;
  const xpTotal = donnees.reduce(function(t, d) { return t + d.xp; }, 0);

  // --- radar en SVG ---
  const C = 160;   // centre
  const R = 100;   // rayon du rang max
  const angle = function(i) { return -Math.PI / 2 + i * 2 * Math.PI / n; };
  const point = function(i, rayon) {
    return [C + Math.cos(angle(i)) * rayon, C + Math.sin(angle(i)) * rayon];
  };
  const chaine = function(pts) {
    return pts.map(function(p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
  };

  let svg = `<svg class="radar" viewBox="0 0 320 320" role="img" aria-label="Profil radar">`;

  // anneaux : un par rang (E au centre, S au bord)
  for (let r = 1; r <= niveauMax; r++) {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(point(i, R * r / niveauMax));
    svg += `<polygon class="radar-anneau" points="${chaine(pts)}"/>`;
  }
  // axes
  for (let i = 0; i < n; i++) {
    const p = point(i, R);
    svg += `<line class="radar-axe" x1="${C}" y1="${C}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}"/>`;
  }
  // lettres des rangs le long du premier axe
  for (let r = 1; r <= niveauMax; r++) {
    const p = point(0, R * r / niveauMax);
    svg += `<text class="radar-rang" x="${(p[0] + 4).toFixed(1)}" y="${(p[1] + 3).toFixed(1)}">${echapper(rangs[r].lettre)}</text>`;
  }
  // forme du joueur (jamais réduite à un point pour rester visible)
  const forme = donnees.map(function(d, i) {
    return point(i, R * Math.max(d.valeur / niveauMax, 0.04));
  });
  svg += `<polygon class="radar-forme" points="${chaine(forme)}"/>`;
  forme.forEach(function(p, i) {
    svg += `<circle class="radar-point" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" style="fill:${donnees[i].cat.couleur}"/>`;
  });
  // icône + lettre de rang à chaque sommet
  donnees.forEach(function(d, i) {
    const p = point(i, R + 26);
    svg += `<text class="radar-icone" x="${p[0].toFixed(1)}" y="${(p[1] - 2).toFixed(1)}">${d.cat.icone}</text>`;
    svg += `<text class="radar-lettre" x="${p[0].toFixed(1)}" y="${(p[1] + 14).toFixed(1)}" style="fill:${d.cat.couleur}">${echapper(d.lettre)}</text>`;
  });
  svg += `</svg>`;

  // --- en-tête et détail par catégorie ---
  let html = `
    <h2>🕸️ Profil</h2>
    <div class="profil-global">
      <span class="profil-global-lettre">${echapper(lettreRang(moyenne))}</span>
      <span>Rang global<br><small>${xpTotal} XP au total</small></span>
    </div>
    ${svg}
    <div class="profil-liste">`;

  donnees.forEach(function(d) {
    const suivant = xpProchainRang(d.xp);
    const texte = suivant === null ? d.xp + " XP · rang max !" : d.xp + " / " + suivant + " XP";
    const pctRang = d.valeur >= niveauMax ? 100 : Math.round((d.valeur - Math.floor(d.valeur)) * 100);
    const skillLePlusTravaille = d.skills.find(function(detail) { return detail.xp > 0; });
    let detailsSkills = "";
    d.skills.forEach(function(detail) {
      const partXp = d.xp === 0 ? 0 : Math.round(detail.xp / d.xp * 100);
      detailsSkills += `
        <div class="profil-skill">
          <div class="profil-skill-entete">
            <strong>${echapper(detail.skill.nom)}</strong>
            <span>${detail.xp} XP · ${partXp}%</span>
          </div>
          <div class="skill-barre"><span style="width:${detail.pourcentage}%;background:${d.cat.couleur}"></span></div>
          <small>${detail.faites}/${detail.total} quêtes complétées</small>
        </div>`;
    });
    const resumeSkill = skillLePlusTravaille
      ? `Plus travaillé : <strong>${echapper(skillLePlusTravaille.skill.nom)}</strong> · ${skillLePlusTravaille.xp} XP`
      : "Aucun XP gagné pour le moment";
    html += `
      <div class="profil-ligne" style="border-left-color:${d.cat.couleur}">
        <span class="profil-ligne-nom">${d.cat.icone} ${echapper(d.cat.nom)}</span>
        <span class="profil-ligne-lettre" style="color:${d.cat.couleur}">${echapper(d.lettre)}</span>
        <span class="skill-barre"><span style="width:${pctRang}%;background:${d.cat.couleur}"></span></span>
        <small>${texte}</small>
        <div class="profil-detail-categorie">
          <p>${resumeSkill}</p>
          <details class="profil-details">
            <summary>Détail des skills (${d.skills.length})</summary>
            <div class="profil-skills">${detailsSkills || "<small>Aucun skill dans cette catégorie.</small>"}</div>
          </details>
        </div>
      </div>`;
  });

  html += `</div>`;
  conteneur.innerHTML = html;
}
