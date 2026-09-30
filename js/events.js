let events = JSON.parse(localStorage.getItem("events")) || [];

fetch("data/events.json")
  .then(function(r) { return r.json(); })
  .then(function(donnees) {
    if (events.length === 0) { events = donnees; sauvegarderEvents(); }
    afficherEvents();
  });

function sauvegarderEvents() {
  localStorage.setItem("events", JSON.stringify(events));
}

function afficherEvents() {
  const c = document.getElementById("liste-events");
  c.innerHTML = "";
  events.forEach(function(e, i) {
    c.innerHTML += `
      <div class="event">
        <p>${e.nom} — ${e.description} — 💰 ${e.recompense}</p>
        <button onclick="validerEvent(${i})" ${e.terminee ? "disabled" : ""}>
          ${e.terminee ? "Terminé" : "Valider"}
        </button>
      </div>
    `;
  });
}

function validerEvent(i) {
  if (events[i].terminee) return;
  events[i].terminee = true;
  sauvegarderEvents();
  ajouterTransaction(events[i].nom, events[i].recompense);
  afficherEvents();
}