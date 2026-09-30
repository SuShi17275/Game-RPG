let skills = JSON.parse(localStorage.getItem("skills")) || [];

fetch("data/skills.json")
  .then(function(reponse) { return reponse.json(); })
  .then(function(donnees) {
    if (skills.length === 0) {
      skills = donnees;
      sauvegarderSkills();
    }
    afficherSkills();
  });

function sauvegarderSkills() {
  localStorage.setItem("skills", JSON.stringify(skills));
}

function estMaitrise(skill) {
  return skill.quetes.every(function(q) { return q.faite; });
}

function estDebloque(skill) {
  if (skill.debloqueDes === "debut") return true;
  const parent = skills.find(function(s) { return s.id === skill.debloqueDes; });
  return parent && estMaitrise(parent);
}

function afficherSkills() {
  const conteneurSkills = document.getElementById("liste-skills");
  conteneurSkills.innerHTML = "";
  skills.forEach(function(skill, index) {
    if (!estDebloque(skill)) return;
    const faites = skill.quetes.filter(function(q) { return q.faite; }).length;
    conteneurSkills.innerHTML += `
      <div class="skill">
        <button onclick="ouvrirSkill(${index})">
          ${skill.nom} (${faites}/${skill.quetes.length})
        </button>
      </div>
    `;
  });
}

function ouvrirSkill(indexSkill) {
  const skill = skills[indexSkill];
  const conteneurQuetes = document.getElementById("ecran-skill-detail");
  conteneurQuetes.innerHTML = `<h2>${skill.nom}</h2>`;
  skill.quetes.forEach(function(quete, indexQuete) {
    conteneurQuetes.innerHTML += `
      <div class="quete">
        <p>${quete.nom}</p>
        <p>Difficulté : ${quete.difficulte} — Durée : ${quete.duree} — 💰 ${quete.recompense}</p>
        <button onclick="validerQuete(${indexSkill}, ${indexQuete})" ${quete.faite ? "disabled" : ""}>
          ${quete.faite ? "Complétée" : "Valider"}
        </button>
      </div>
    `;
  });
  afficherEcran("skill-detail");
}

function validerQuete(indexSkill, indexQuete) {
  const quete = skills[indexSkill].quetes[indexQuete];
  if (quete.faite) return;
  quete.faite = true;
  sauvegarderSkills();
  ajouterTransaction(quete.nom, quete.recompense);
  ouvrirSkill(indexSkill);
  afficherSkills();
}