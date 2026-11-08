const zoneObjets = document.getElementById("objets-chambre");
let clicDeposeJouet = null;
const canvasTest = document.createElement("canvas");
canvasTest.width = 1;
canvasTest.height = 1;
const ctxTest = canvasTest.getContext("2d", { willReadFrequently: true });

fetch("data/chambre.json?v=8")
  .then(function(r) { return r.json(); })
  .then(function(calques) {
    zoneObjets.innerHTML = "";
    calques.forEach(function(c) {
      const img = document.createElement("img");
      img.src = c.image;
      img.className = (c.tache || c.ouvre) ? "objet" : "objet decor";
      if (c.collision) img.dataset.collision = "true";
      if (c.interaction) img.dataset.interaction = c.interaction;
      if (c.tache) img.dataset.id = c.tache;
      if (c.ouvre) img.dataset.ouvre = c.ouvre;
      img.onerror = function() { img.remove(); }; // image pas encore dessinée : on ignore
      zoneObjets.appendChild(img);
    });
    afficherObjets();
    window.dispatchEvent(new Event("chambre:prete"));
  })
  .catch(function(error) {
    console.error("Impossible de charger les objets de la chambre :", error);
  });

// Grise les objets dont la tâche est faite
function afficherObjets() {
  zoneObjets.querySelectorAll("[data-id]").forEach(function(img) {
    img.classList.toggle("fait", tachesFaites.includes(img.dataset.id));
  });
}

// Le pixel touché est-il opaque dans cette image ?
function pixelOpaque(img, clientX, clientY) {
  const r = img.getBoundingClientRect();
  const x = Math.floor((clientX - r.left) * img.naturalWidth / r.width);
  const y = Math.floor((clientY - r.top) * img.naturalHeight / r.height);
  if (x < 0 || y < 0 || x >= img.naturalWidth || y >= img.naturalHeight) return false;
  ctxTest.clearRect(0, 0, 1, 1);
  ctxTest.drawImage(img, x, y, 1, 1, 0, 0, 1, 1);
  return ctxTest.getImageData(0, 0, 1, 1).data[3] > 10;
}

// La couche visible la plus haute sous le doigt prend le clic
window.addEventListener("chambre:glisser-termine", function(e) {
  clicDeposeJouet = e.detail;
});

document.getElementById("chambre").addEventListener("click", function(e) {
  const depotRecent = clicDeposeJouet &&
    performance.now() - clicDeposeJouet.temps <= 100 &&
    (typeof e.pointerId !== "number" || e.pointerId === clicDeposeJouet.pointerId) &&
    Math.abs(e.clientX - clicDeposeJouet.clientX) <= 2 &&
    Math.abs(e.clientY - clicDeposeJouet.clientY) <= 2;
  clicDeposeJouet = null;
  if (depotRecent) return;
  const couches = Array.from(zoneObjets.querySelectorAll("img"))
    .map(function(img, index) { return { element: img, index: index }; });
  const toilePet = zoneObjets.querySelector("#pet-chambre");
  if (toilePet) couches.push({ element: toilePet, index: couches.length });
  couches.sort(function(a, b) {
    return Number(b.element.style.zIndex || 0) - Number(a.element.style.zIndex || 0) ||
      b.index - a.index;
  });
  for (const couche of couches) {
    const img = couche.element;
    if (img.id === "pet-chambre") {
      if (typeof window.traiterClicPet === "function" && window.traiterClicPet(e)) return;
      continue;
    }
    if (pixelOpaque(img, e.clientX, e.clientY)) {
      if (img.dataset.id) cocherTache(img.dataset.id);
      else if (img.dataset.ouvre === "ordinateur") ouvrirOrdinateur(); // du décor : rien ne se passe
      else if (img.dataset.interaction === "gamelle") remplirGamelle();
      return;
    }
  }
});