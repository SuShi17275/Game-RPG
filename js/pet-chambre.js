(function() {
  const zoneObjets = document.getElementById("objets-chambre");
  const fond = document.getElementById("fond-chambre");

  function attendreChambre() {
    if (zoneObjets.querySelectorAll("img").length) return Promise.resolve();
    return new Promise(function(resolve) {
      window.addEventListener("chambre:prete", resolve, { once: true });
    });
  }

  function attendreImage(img) {
    if (img.complete) return Promise.resolve();
    return new Promise(function(resolve) {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  }

  function pointSurImage(m, u, v) {
    const w = m.g * u + m.h * v + 1;
    return {
      x: (m.a * u + m.b * v + m.c) / w,
      y: (m.d * u + m.e * v + m.f) / w
    };
  }

  function matricePerspective(coins) {
    const p0 = { x: coins[0][0], y: coins[0][1] };
    const p1 = { x: coins[1][0], y: coins[1][1] };
    const p2 = { x: coins[2][0], y: coins[2][1] };
    const p3 = { x: coins[3][0], y: coins[3][1] };
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x;
    const dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
    const dy3 = p0.y - p1.y + p2.y - p3.y;
    let g = 0, h = 0;
    if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
      const determinant = dx1 * dy2 - dy1 * dx2;
      g = (dx3 * dy2 - dy3 * dx2) / determinant;
      h = (dx1 * dy3 - dy1 * dx3) / determinant;
    }
    return {
      a: p1.x - p0.x + g * p1.x,
      b: p3.x - p0.x + h * p3.x,
      c: p0.x,
      d: p1.y - p0.y + g * p1.y,
      e: p3.y - p0.y + h * p3.y,
      f: p0.y,
      g: g,
      h: h
    };
  }

  function profondeur(img, ctx, largeur, hauteur) {
    ctx.clearRect(0, 0, largeur, hauteur);
    ctx.drawImage(img, 0, 0, largeur, hauteur);
    const pixels = ctx.getImageData(0, 0, largeur, hauteur).data;
    for (let y = hauteur - 1; y >= 0; y--) {
      for (let x = 0; x < largeur; x++) {
        if (pixels[(y * largeur + x) * 4 + 3] > 10) return y;
      }
    }
    return 0;
  }

  function bloquerCasesObjets(grille, calques, ctx, largeur, hauteur, taillePet, position) {
    calques.filter(function(calque) {
      return calque.img.dataset.collision === "true";
    }).forEach(function(calque) {
      ctx.clearRect(0, 0, largeur, hauteur);
      ctx.drawImage(calque.img, 0, 0, largeur, hauteur);
      const pixels = ctx.getImageData(0, 0, largeur, hauteur).data;
      const rayon = Math.ceil(taillePet / 2);
      grille.forEach(function(ligne, indexLigne) {
        ligne.forEach(function(bloquee, indexColonne) {
          if (bloquee) return;
          const pied = position({ colonne: indexColonne, ligne: indexLigne });
          const gauche = Math.max(0, Math.floor(pied.x - rayon));
          const droite = Math.min(largeur - 1, Math.ceil(pied.x + rayon));
          const haut = Math.max(0, Math.floor(pied.y - 18));
          const bas = Math.min(hauteur - 1, Math.ceil(pied.y + 3));
          for (let y = haut; y <= bas; y++) {
            for (let x = gauche; x <= droite; x++) {
              if (pixels[(y * largeur + x) * 4 + 3] > 10) {
                ligne[indexColonne] = true;
                return;
              }
            }
          }
        });
      });
    });
  }

  function voisins(grille, cellule) {
    const directions = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],             [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ];
    return directions.reduce(function(resultat, direction) {
      const colonne = cellule.colonne + direction[0];
      const ligne = cellule.ligne + direction[1];
      if (ligne < 0 || ligne >= grille.length || colonne < 0 || colonne >= grille[ligne].length ||
          grille[ligne][colonne]) return resultat;
      if (direction[0] && direction[1] &&
          (grille[cellule.ligne][colonne] || grille[ligne][cellule.colonne])) return resultat;
      resultat.push({ colonne: colonne, ligne: ligne });
      return resultat;
    }, []);
  }

  function cheminsDepuis(grille, depart) {
    const file = [depart];
    const precedents = new Map();
    const cle = function(cellule) { return cellule.colonne + "," + cellule.ligne; };
    precedents.set(cle(depart), null);
    for (let index = 0; index < file.length; index++) {
      const courant = file[index];
      voisins(grille, courant).forEach(function(suivant) {
        if (precedents.has(cle(suivant))) return;
        precedents.set(cle(suivant), courant);
        file.push(suivant);
      });
    }
    return { file: file, precedents: precedents, cle: cle };
  }

  function initialiser(grilleConfig, petConfig) {
    if (!fond.naturalWidth || !grilleConfig.coins || grilleConfig.coins.length !== 4 ||
        !grilleConfig.bloquees || grilleConfig.bloquees.length !== grilleConfig.lignes ||
        grilleConfig.bloquees.some(function(ligne) {
          return ligne.length !== grilleConfig.colonnes;
        })) {
      throw new Error("La grille du pet est invalide ou l'image de la chambre est indisponible.");
    }

    const grille = grilleConfig.bloquees.map(function(ligne) {
      return Array.from(ligne, function(caseGrille) { return caseGrille === "#"; });
    });
    const coins = grilleConfig.coins.map(function(coin) {
      return [coin[0] * fond.naturalWidth, coin[1] * fond.naturalHeight];
    });
    const matrice = matricePerspective(coins);
    const toile = document.createElement("canvas");
    const ctx = toile.getContext("2d");
    const canvasObjets = document.createElement("canvas");
    const ctxObjets = canvasObjets.getContext("2d", { willReadFrequently: true });
    const largeur = fond.naturalWidth;
    const hauteur = fond.naturalHeight;
    toile.id = "pet-chambre";
    toile.width = largeur;
    toile.height = hauteur;
    canvasObjets.width = largeur;
    canvasObjets.height = hauteur;
    zoneObjets.appendChild(toile);
    const bulleInfo = document.createElement("div");
    bulleInfo.id = "pet-info-bulle";
    bulleInfo.className = "pet-info-bulle cache";
    bulleInfo.setAttribute("aria-live", "polite");
    bulleInfo.innerHTML =
      "<strong>🐾 Ton compagnon</strong>" +
      "<p>État : <span id=\"pet-etat\"></span></p>" +
      "<p>Faim : <span id=\"pet-faim\"></span></p>" +
      "<p>Énergie : <span id=\"pet-energie\"></span></p>" +
      "<p>Amitié : <span id=\"pet-amitie\"></span></p>" +
      "<p id=\"pet-jeu\"></p>" +
      "<p id=\"pet-gamelle\"></p>" +
      "<p id=\"pet-bonus\"></p>" +
      "<p id=\"pet-caresser\"></p>";
    zoneObjets.appendChild(bulleInfo);

    const calques = Array.from(zoneObjets.querySelectorAll("img")).map(function(img, ordre) {
      return {
        img: img,
        ordre: ordre,
        profondeur: profondeur(img, ctxObjets, largeur, hauteur)
      };
    });
    const taille = petConfig.taille;
    ["repos", "manger", "dormir", "jouer"].forEach(function(nom) {
      if (!petConfig.animations[nom]) {
        throw new Error("Animation manquante dans data/pet.json : " + nom);
      }
    });
    const positions = new Map();
    function position(cellule) {
      const cle = cellule.colonne + "," + cellule.ligne;
      if (!positions.has(cle)) {
        positions.set(cle, pointSurImage(
          matrice,
          (cellule.colonne + 0.5) / grilleConfig.colonnes,
          (cellule.ligne + 0.5) / grilleConfig.lignes
        ));
      }
      return positions.get(cle);
    }

    bloquerCasesObjets(grille, calques, ctxObjets, largeur, hauteur, taille, position);

    function cellulesProches(interaction) {
      const calque = calques.find(function(element) {
        return element.img.dataset.interaction === interaction;
      });
      if (!calque) return [];

      ctxObjets.clearRect(0, 0, largeur, hauteur);
      ctxObjets.drawImage(calque.img, 0, 0, largeur, hauteur);
      const pixels = ctxObjets.getImageData(0, 0, largeur, hauteur).data;
      let gauche = largeur, droite = -1, haut = hauteur, bas = -1;
      for (let y = 0; y < hauteur; y++) {
        for (let x = 0; x < largeur; x++) {
          if (pixels[(y * largeur + x) * 4 + 3] <= 10) continue;
          gauche = Math.min(gauche, x);
          droite = Math.max(droite, x);
          haut = Math.min(haut, y);
          bas = Math.max(bas, y);
        }
      }
      if (droite < gauche) return [];

      const rayon = taille * 1.1;
      const cases = [];
      grille.forEach(function(ligne, indexLigne) {
        ligne.forEach(function(bloquee, indexColonne) {
          if (bloquee) return;
          const point = position({ colonne: indexColonne, ligne: indexLigne });
          const dx = Math.max(gauche - point.x, 0, point.x - droite);
          const dy = Math.max(haut - point.y, 0, point.y - bas);
          if (Math.hypot(dx, dy) <= rayon) {
            cases.push({ colonne: indexColonne, ligne: indexLigne });
          }
        });
      });
      return cases;
    }

    function pixelOpaqueObjet(img, clientX, clientY) {
      const rect = img.getBoundingClientRect();
      const pixelX = Math.floor((clientX - rect.left) * largeur / rect.width);
      const pixelY = Math.floor((clientY - rect.top) * hauteur / rect.height);
      if (pixelX < 0 || pixelY < 0 || pixelX >= largeur || pixelY >= hauteur) return false;
      ctxObjets.clearRect(0, 0, largeur, hauteur);
      ctxObjets.drawImage(img, 0, 0, largeur, hauteur);
      return ctxObjets.getImageData(pixelX, pixelY, 1, 1).data[3] > 10;
    }

    const casesLit = cellulesProches("lit-pet");
    const casesGamelle = cellulesProches("gamelle");
    const casesLibres = [];
    grille.forEach(function(ligne, indexLigne) {
      ligne.forEach(function(bloquee, indexColonne) {
        if (!bloquee) casesLibres.push({ colonne: indexColonne, ligne: indexLigne });
      });
    });
    if (!casesLibres.length) throw new Error("La grille du pet ne contient aucune case libre.");

    let cellule = casesLibres[Math.floor(Math.random() * casesLibres.length)];
    let trajet = [];
    let x = position(cellule).x;
    let y = position(cellule).y;
    let animation = "repos";
    let frame = 0;
    let tempsFrame = 0;
    let actionEnCours = null;
    let repasDisponibles = 0;
    let deplacementObjet = null;
    let clicPetEnAttente = null;
    let minuterieBulleInfo = null;
    const DELAI_DOUBLE_CLIC_MS = 300;
    const DUREE_BULLE_INFO_MS = 10000;
    let pauseJusqua = performance.now() + 800;
    let dernierTemps = performance.now();
    const imagePet = new Image();
    imagePet.src = petConfig.image;

    function choisirDestination() {
      const resultats = cheminsDepuis(grille, cellule);
      if (repasDisponibles > 0 && casesGamelle.length) {
        const cible = resultats.file.find(function(option) {
          return casesGamelle.some(function(caseGamelle) {
            return option.colonne === caseGamelle.colonne && option.ligne === caseGamelle.ligne;
          });
        });
        if (cible) {
          const cheminGamelle = [];
          let courantGamelle = cible;
          while (courantGamelle &&
              (courantGamelle.colonne !== cellule.colonne || courantGamelle.ligne !== cellule.ligne)) {
            cheminGamelle.unshift(courantGamelle);
            courantGamelle = resultats.precedents.get(resultats.cle(courantGamelle));
          }
          if (!cheminGamelle.length) demarrerAction("manger");
          else trajet = cheminGamelle;
          return;
        }
      }
      const choix = resultats.file.filter(function(option) {
        return option.colonne !== cellule.colonne || option.ligne !== cellule.ligne;
      });
      const eloignes = choix.filter(function(option) {
        return Math.max(Math.abs(option.colonne - cellule.colonne),
          Math.abs(option.ligne - cellule.ligne)) >= 3;
      });
      const destinations = eloignes.length ? eloignes : choix;
      if (!destinations.length) return;
      const destination = destinations[Math.floor(Math.random() * destinations.length)];
      const chemin = [];
      let courant = destination;
      while (courant && (courant.colonne !== cellule.colonne || courant.ligne !== cellule.ligne)) {
        chemin.unshift(courant);
        courant = resultats.precedents.get(resultats.cle(courant));
      }
      trajet = chemin;
    }

    function demarrerAction(nom) {
      if (actionEnCours) return;
      actionEnCours = { nom: nom, framesJouees: 0 };
      animation = nom;
      frame = 0;
      tempsFrame = 0;
      trajet = [];
    }

    function verifierInteraction(cellulePet) {
      if (repasDisponibles > 0 && casesGamelle.some(function(c) {
        return c.colonne === cellulePet.colonne && c.ligne === cellulePet.ligne;
      })) {
        demarrerAction("manger");
      } else if (casesLit.some(function(c) {
        return c.colonne === cellulePet.colonne && c.ligne === cellulePet.ligne;
      }) && typeof peutDormirPet === "function" && peutDormirPet()) {
        demarrerAction("dormir");
      }
    }

    function imageAnimation(nom) {
      const definition = petConfig.animations[nom] || petConfig.animations.repos;
      if (definition.copie) {
        return {
          definition: petConfig.animations[definition.copie],
          miroir: !!definition.miroir
        };
      }
      return { definition: definition, miroir: false };
    }

    function dessiner() {
      ctx.clearRect(0, 0, largeur, hauteur);
      if (!imagePet.complete || !imagePet.naturalWidth) return;
      const animationPet = imageAnimation(animation);
      const definition = animationPet.definition;
      const largeurFrame = petConfig.taille;
      const hauteurFrame = petConfig.taille;
      const sx = (frame % definition.frames) * largeurFrame;
      const sy = definition.ligne * hauteurFrame;
      const dx = x - taille / 2;
      const dy = y - taille + 3;
      ctx.save();
      if (animationPet.miroir) {
        ctx.translate(dx * 2 + largeurFrame, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(imagePet, sx, sy, largeurFrame, hauteurFrame, dx, dy, largeurFrame, hauteurFrame);
      ctx.restore();
    }

    function mettreAJourProfondeur() {
      let indexPet = 0;
      let conflitsMinimum = Infinity;
      let conflits = calques.filter(function(calque) { return calque.profondeur <= y; }).length;
      for (let candidat = 0; candidat <= calques.length; candidat++) {
        if (conflits < conflitsMinimum) {
          indexPet = candidat;
          conflitsMinimum = conflits;
        }
        if (candidat < calques.length) {
          conflits += calques[candidat].profondeur > y ? 1 : -1;
        }
      }
      calques.forEach(function(calque, index) {
        if (deplacementObjet && deplacementObjet.img === calque.img) {
          calque.img.style.zIndex = "1000";
          return;
        }
        calque.img.style.zIndex = String(10 + index * 2 + (index >= indexPet ? 1 : 0));
      });
      toile.style.zIndex = String(10 + indexPet * 2);
    }

    function positionnerBulleInfo() {
      bulleInfo.style.left = (x / largeur * 100) + "%";
      bulleInfo.style.top = (Math.max(4, y - taille - 4) / hauteur * 100) + "%";
    }

    function afficherInfoPet() {
      if (minuterieBulleInfo) clearTimeout(minuterieBulleInfo);
      bulleInfo.classList.remove("cache");
      positionnerBulleInfo();
      minuterieBulleInfo = setTimeout(function() {
        bulleInfo.classList.add("cache");
        minuterieBulleInfo = null;
      }, DUREE_BULLE_INFO_MS);
    }

    window.afficherInfoPet = afficherInfoPet;
    window.traiterClicPet = function(evenement) {
      const rect = toile.getBoundingClientRect();
      const pixelX = Math.floor((evenement.clientX - rect.left) * largeur / rect.width);
      const pixelY = Math.floor((evenement.clientY - rect.top) * hauteur / rect.height);
      if (pixelX < 0 || pixelY < 0 || pixelX >= largeur || pixelY >= hauteur ||
          ctx.getImageData(pixelX, pixelY, 1, 1).data[3] <= 10) return false;

      if (clicPetEnAttente) {
        clearTimeout(clicPetEnAttente);
        clicPetEnAttente = null;
        caresserPet();
        afficherInfoPet();
      } else {
        clicPetEnAttente = setTimeout(function() {
          clicPetEnAttente = null;
          afficherInfoPet();
        }, DELAI_DOUBLE_CLIC_MS);
      }
      return true;
    };

    function terminerAction() {
      const action = actionEnCours;
      actionEnCours = null;
      animation = "repos";
      frame = 0;
      tempsFrame = 0;
      pauseJusqua = performance.now() + 700;
      window.dispatchEvent(new CustomEvent("pet:action-terminee", {
        detail: { action: action.nom }
      }));
    }

    function commencerGlisser(img, evenement) {
      if (evenement.button !== 0 || actionEnCours ||
          !pixelOpaqueObjet(img, evenement.clientX, evenement.clientY)) return;
      evenement.preventDefault();
      evenement.stopPropagation();
      deplacementObjet = {
        img: img,
        pointerId: evenement.pointerId,
        debutX: evenement.clientX,
        debutY: evenement.clientY,
        transform: img.style.transform,
        zIndex: img.style.zIndex
      };
      img.setPointerCapture(evenement.pointerId);
      mettreAJourProfondeur();
    }

    function deplacerJouet(evenement) {
      if (!deplacementObjet || evenement.pointerId !== deplacementObjet.pointerId) return;
      const rect = fond.getBoundingClientRect();
      const dx = (evenement.clientX - deplacementObjet.debutX) * largeur / rect.width;
      const dy = (evenement.clientY - deplacementObjet.debutY) * hauteur / rect.height;
      deplacementObjet.img.style.transform =
        `translate(${dx}px, ${dy}px) ${deplacementObjet.transform || ""}`.trim();
    }

    function deposerJouet(evenement) {
      if (!deplacementObjet || evenement.pointerId !== deplacementObjet.pointerId) return;
      evenement.preventDefault();
      evenement.stopPropagation();
      const drag = deplacementObjet;
      const calque = calques.find(function(element) { return element.img === drag.img; });
      const rect = fond.getBoundingClientRect();
      let gauche = largeur, droite = -1, haut = hauteur, bas = -1;
      if (calque) {
        ctxObjets.clearRect(0, 0, largeur, hauteur);
        ctxObjets.drawImage(calque.img, 0, 0, largeur, hauteur);
        const donnees = ctxObjets.getImageData(0, 0, largeur, hauteur).data;
        for (let y = 0; y < hauteur; y++) {
          for (let x = 0; x < largeur; x++) {
            if (donnees[(y * largeur + x) * 4 + 3] <= 10) continue;
            gauche = Math.min(gauche, x);
            droite = Math.max(droite, x);
            haut = Math.min(haut, y);
            bas = Math.max(bas, y);
          }
        }
      }
      const centreJouetX = rect.left + ((gauche + droite) / 2) * rect.width / largeur +
        (evenement.clientX - drag.debutX);
      const centreJouetY = rect.top + ((haut + bas) / 2) * rect.height / hauteur +
        (evenement.clientY - drag.debutY);
      const centrePetX = rect.left + x * rect.width / largeur;
      const centrePetY = rect.top + (y - taille / 2) * rect.height / hauteur;
      const porte = Math.max(32, taille * rect.width / largeur);
      drag.img.style.transform = drag.transform;
      drag.img.style.zIndex = drag.zIndex;
      deplacementObjet = null;
      mettreAJourProfondeur();
      window.dispatchEvent(new CustomEvent("chambre:glisser-termine", {
        detail: {
          pointerId: evenement.pointerId,
          clientX: evenement.clientX,
          clientY: evenement.clientY,
          temps: performance.now()
        }
      }));
      if (droite >= gauche && Math.hypot(centreJouetX - centrePetX, centreJouetY - centrePetY) <= porte) {
        if (typeof peutJouerPet !== "function" || peutJouerPet()) {
          demarrerAction("jouer");
        } else {
          alert("La limite de parties pour aujourd'hui est atteinte.");
        }
      }
    }

    function annulerGlisser(evenement) {
      if (!deplacementObjet || evenement.pointerId !== deplacementObjet.pointerId) return;
      deplacementObjet.img.style.transform = deplacementObjet.transform;
      deplacementObjet.img.style.zIndex = deplacementObjet.zIndex;
      deplacementObjet = null;
      mettreAJourProfondeur();
    }

    const jouet = calques.find(function(calque) {
      return calque.img.dataset.interaction === "jouet";
    });
    if (jouet) jouet.img.addEventListener("pointerdown", function(e) {
      commencerGlisser(jouet.img, e);
    });
    document.addEventListener("pointermove", deplacerJouet);
    document.addEventListener("pointerup", deposerJouet);
    document.addEventListener("pointercancel", annulerGlisser);

    window.addEventListener("pet:gamelle-change", function(e) {
      repasDisponibles = e.detail.repasDisponibles;
      if (repasDisponibles > 0 && !actionEnCours) {
        trajet = [];
        pauseJusqua = performance.now();
      }
    });
    window.dispatchEvent(new Event("pet:popup-prete"));

    function avancer(temps) {
      const delta = Math.min((temps - dernierTemps) / 1000, 0.05);
      dernierTemps = temps;
      if (actionEnCours) {
        const configAnimation = imageAnimation(animation).definition;
        tempsFrame += delta;
        if (tempsFrame >= 1 / configAnimation.fps) {
          tempsFrame = 0;
          actionEnCours.framesJouees += 1;
          frame = (frame + 1) % configAnimation.frames;
          const repetitions = configAnimation.repetitions || 1;
          if (actionEnCours.framesJouees >= configAnimation.frames * repetitions) {
            terminerAction();
          }
        }
      } else if (trajet.length) {
        const prochain = position(trajet[0]);
        const dx = prochain.x - x;
        const dy = prochain.y - y;
        const distance = Math.hypot(dx, dy);
        const pas = 34 * delta;
        if (distance <= pas || distance < 0.01) {
          cellule = trajet.shift();
          x = prochain.x;
          y = prochain.y;
          verifierInteraction(cellule);
          if (!trajet.length) {
            if (!actionEnCours) {
              animation = "repos";
              pauseJusqua = temps + 700 + Math.random() * 1500;
            }
          }
        } else {
          x += dx / distance * pas;
          y += dy / distance * pas;
          animation = dy < 0 ? "marche-haut-droite" : "marche-bas-droite";
          if (dx < 0) animation = animation.replace("-droite", "-gauche");
          const configAnimation = imageAnimation(animation).definition;
          tempsFrame += delta;
          if (tempsFrame >= 1 / configAnimation.fps) {
            frame = (frame + 1) % configAnimation.frames;
            tempsFrame = 0;
          }
        }
      } else if (temps >= pauseJusqua) {
        choisirDestination();
        if (!trajet.length) pauseJusqua = temps + 1000;
      } else {
        const configAnimation = imageAnimation(animation).definition;
        tempsFrame += delta;
        if (tempsFrame >= 1 / configAnimation.fps) {
          frame = (frame + 1) % configAnimation.frames;
          tempsFrame = 0;
        }
      }
      mettreAJourProfondeur();
      dessiner();
      if (!bulleInfo.classList.contains("cache")) positionnerBulleInfo();
      requestAnimationFrame(avancer);
    }

    imagePet.onload = dessiner;
    imagePet.onerror = function() {
      console.error("Impossible de charger le sprite du pet :", petConfig.image);
    };
    window.dispatchEvent(new Event("pet:pret"));
    mettreAJourProfondeur();
    requestAnimationFrame(avancer);
  }

  Promise.all([
    attendreChambre().then(function() {
      return Promise.all(Array.from(zoneObjets.querySelectorAll("img"), attendreImage));
    }),
    fetch("data/grille-pet.json?v=1").then(function(response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }),
    fetch("data/pet.json?v=2").then(function(response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }),
    attendreImage(fond)
  ]).then(function(resultats) {
    initialiser(resultats[1], resultats[2]);
  }).catch(function(error) {
    console.error("Impossible d'initialiser le déplacement du pet :", error);
  });
})();
