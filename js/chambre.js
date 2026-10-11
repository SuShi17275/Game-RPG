const zoneObjets = document.getElementById("objets-chambre");
const canvasTest = document.createElement("canvas");
canvasTest.width = 1;
canvasTest.height = 1;
const ctxTest = canvasTest.getContext("2d", { willReadFrequently: true });

fetch("data/chambre.json")
  .then(function(r) { return r.json(); })
  .then(function(calques) {
    zoneObjets.innerHTML = "";
    calques.forEach(function(c) {
      const img = document.createElement("img");
      img.src = c.image;
      img.className = c.tache ? "objet" : "objet decor";
      if (c.tache) img.dataset.id = c.tache;
      img.onerror = function() { img.remove(); }; // image pas encore dessinée : on ignore
      zoneObjets.appendChild(img);
    });
    afficherObjets();
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
document.getElementById("chambre").addEventListener("click", function(e) {
  const couches = Array.from(zoneObjets.querySelectorAll("img")).reverse();
  for (const img of couches) {
    if (pixelOpaque(img, e.clientX, e.clientY)) {
      if (img.dataset.id) cocherTache(img.dataset.id); // du décor : rien ne se passe
      return;
    }
  }
});