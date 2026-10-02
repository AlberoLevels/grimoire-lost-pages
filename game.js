(() => {
  "use strict";

  const els = {
    game: document.getElementById("game"),
    battlefield: document.getElementById("battlefield"),

    intro: document.getElementById("intro-screen"),
    start: document.getElementById("start-game"),

    result: document.getElementById("result-screen"),
    resultTitle: document.getElementById("result-title"),
    resultText: document.getElementById("result-text"),
    restart: document.getElementById("restart-game"),

    inspect: document.getElementById("inspect-overlay"),
    inspectCard: document.getElementById("inspect-card"),
    closeInspect: document.getElementById("close-inspect"),

    deckOverlay: document.getElementById("deck-overlay"),
    deckTitle: document.getElementById("deck-overlay-title"),
    deckSubtitle: document.getElementById("deck-overlay-subtitle"),
    deckList: document.getElementById("deck-list"),
    closeDeck: document.getElementById("close-deck"),
    deckCloseBottom: document.getElementById("deck-close-bottom"),

    openGrimoire: document.getElementById("open-grimoire"),
    openAshes: document.getElementById("open-ashes"),
    grimoireCount: document.getElementById("grimoire-count"),
    ashesCount: document.getElementById("ashes-count"),

    playerHp: document.getElementById("player-hp"),
    playerEffects: document.getElementById("player-effects"),

    ink: document.getElementById("ink-value"),

    enemyName: document.getElementById("enemy-name"),
    enemyHp: document.getElementById("enemy-hp"),
    enemyIntent: document.getElementById("enemy-intent"),

    hand: document.getElementById("hand"),
    endTurn: document.getElementById("end-turn"),

    message: document.getElementById("battle-message"),
    floats: document.getElementById("floating-text-layer")
  };

  if (!els.game || !els.hand || !els.endTurn) {
    console.error("Grimoire: Lost Pages — faltan elementos HTML necesarios.");
    return;
  }

  let state = null;
  let started = false;

  let longPressTimer = null;
  let activeCardElement = null;
  let pressStartedAt = 0;
  let pressStartX = 0;
  let pressStartY = 0;
  let pressMoved = false;

  const LONG_PRESS_MS = 500;
  const MOVE_THRESHOLD = 10;

  /* ==========================================================================
     EFECTO AMBIENTAL: MIRADA ARCANA
     Android: giroscopio
     PC: ratón
     iOS: fuera de alcance
     ========================================================================== */

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const look = {
    enabled: !prefersReducedMotion,
    sensorActive: false,
    neutralBeta: null,
    neutralGamma: null,
    maxMove: 10,
    runeRatio: 0.55,
    ease: 0.08,
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    targetRuneX: 0,
    targetRuneY: 0,
    currentRuneX: 0,
    currentRuneY: 0,
    rafId: null
  };

  function clampValue(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function setLookTargets(normalizedX, normalizedY) {
    if (!look.enabled) return;

    const x = clampValue(normalizedX, -1, 1);
    const y = clampValue(normalizedY, -1, 1);

    look.targetX = x * look.maxMove;
    look.targetY = y * look.maxMove;

    look.targetRuneX = look.targetX * look.runeRatio;
    look.targetRuneY = look.targetY * look.runeRatio;
  }

  function resetSensorNeutral() {
    look.neutralBeta = null;
    look.neutralGamma = null;
    look.targetX = 0;
    look.targetY = 0;
    look.targetRuneX = 0;
    look.targetRuneY = 0;
  }

  function onDeviceOrientation(event) {
    if (!look.enabled) return;

    const hasBeta = typeof event.beta === "number" && Number.isFinite(event.beta);
    const hasGamma = typeof event.gamma === "number" && Number.isFinite(event.gamma);

    if (!hasBeta || !hasGamma) return;

    look.sensorActive = true;

    if (look.neutralBeta === null || look.neutralGamma === null) {
      look.neutralBeta = event.beta;
      look.neutralGamma = event.gamma;
      return;
    }

    const deltaGamma = event.gamma - look.neutralGamma;
    const deltaBeta = event.beta - look.neutralBeta;

    const range = 30;
    const nx = clampValue(deltaGamma / range, -1, 1);
    const ny = clampValue(deltaBeta / range, -1, 1);

    setLookTargets(nx, ny);
  }

  function onPointerMove(event) {
    if (!look.enabled || look.sensorActive) return;

    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;

    const nx = (event.clientX / width - 0.5) * 2;
    const ny = (event.clientY / height - 0.5) * 2;

    setLookTargets(nx, ny);
  }

  function applyLookVariables() {
    if (!look.enabled) return;

    const root = document.documentElement;

    root.style.setProperty("--look-x", `${look.currentX.toFixed(2)}px`);
    root.style.setProperty("--look-y", `${look.currentY.toFixed(2)}px`);
    root.style.setProperty("--rune-x", `${look.currentRuneX.toFixed(2)}px`);
    root.style.setProperty("--rune-y", `${look.currentRuneY.toFixed(2)}px`);
  }

  function lookLoop() {
    if (!look.enabled) return;

    look.currentX += (look.targetX - look.currentX) * look.ease;
    look.currentY += (look.targetY - look.currentY) * look.ease;
    look.currentRuneX += (look.targetRuneX - look.currentRuneX) * look.ease;
    look.currentRuneY += (look.targetRuneY - look.currentRuneY) * look.ease;

    applyLookVariables();

    look.rafId = window.requestAnimationFrame(lookLoop);
  }

  function initLookEffects() {
    if (!look.enabled) return;

    window.addEventListener("deviceorientation", onDeviceOrientation, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    look.rafId = window.requestAnimationFrame(lookLoop);
  }

  /* ==========================================================================
     UTILIDADES BÁSICAS
     ========================================================================== */

  function createGameState() {
    if (typeof GameState === "undefined") {
      throw new Error("GameState no está definido. Revisa src/logic.js.");
    }

    if (typeof GameState === "function") {
      return new GameState();
    }

    if (GameState && typeof GameState === "object") {
      return GameState;
    }

    throw new Error("GameState no tiene una forma válida.");
  }

  function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        case "'": return "&#39;";
        default: return char;
      }
    });
  }

  function setMessage(text) {
    if (els.message) {
      els.message.textContent = text;
    }
  }

  function shake(element) {
    if (!element || typeof element.animate !== "function") return;

    element.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" }
      ],
      {
        duration: 180,
        easing: "ease-in-out"
      }
    );
  }

  /* ==========================================================================
     LECTURA SEGURA DEL ESTADO
     ========================================================================== */

  function getEnergy() {
    return num(state?.energy);
  }

  function getMaxEnergy() {
    return num(state?.maxEnergy, getEnergy());
  }

  function getPlayerHp() {
    return num(state?.playerHp);
  }

  function getMaxPlayerHp() {
    return num(state?.maxPlayerHp, getPlayerHp());
  }

  function getEnemyHp() {
    return num(state?.enemy?.hp);
  }

  function getEnemyName() {
    return state?.enemy?.name || "Amenaza";
  }

  function getBlock() {
    return num(state?.block ?? state?.playerBlock ?? state?.shield);
  }

  function getBurn() {
    return num(state?.burn ?? state?.playerBurn);
  }

  function getEnemyBlock() {
    return num(state?.enemy?.block ?? state?.enemyBlock);
  }

  function getEnemyBurn() {
    return num(state?.enemy?.burn ?? state?.enemyBurn);
  }

  function cardCost(card) {
    return num(card?.cost);
  }

  function canPlayCard(card) {
    return cardCost(card) <= getEnergy();
  }

  function typeLabel(card) {
    const type = String(card?.type || "").toLowerCase();

    if (type === "attack") return "Ataque";
    if (type === "power") return "Poder";
    if (type === "skill") {
      return card?.heal ? "Curación" : "Defensa";
    }
    if (card?.heal) return "Curación";
    if (card?.curse) return "Maldición";
    if (card?.corrupted) return "Corrupción";

    return "Página";
  }

  /* ==========================================================================
     LECTURA SEGURA DE MAZO / DESCARTE
     No inventa mecánicas. Solo intenta leer nombres comunes.
     ========================================================================== */

  function firstArray(...values) {
    for (const value of values) {
      if (Array.isArray(value)) return value;
    }
    return null;
  }

  function firstNumber(...values) {
    for (const value of values) {
      if (value === null || value === undefined) continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function getDrawPileArray() {
    return firstArray(
      state?.drawPile,
      state?.deck,
      state?.library,
      state?.grimoire,
      state?.remainingCards,
      state?.drawCards
    ) || [];
  }

  function getDrawCount() {
    const arr = firstArray(
      state?.drawPile,
      state?.deck,
      state?.library,
      state?.grimoire,
      state?.remainingCards,
      state?.drawCards
    );

    if (arr) return arr.length;

    const n = firstNumber(
      state?.drawCount,
      state?.deckCount,
      state?.remainingCount,
      state?.grimoireCount,
      state?.libraryCount
    );

    return num(n, 0);
  }

  function getDiscardPileArray() {
    return firstArray(
      state?.discardPile,
      state?.discard,
      state?.ashes,
      state?.cenizas,
      state?.discardedCards
    ) || [];
  }

  function getDiscardCount() {
    const arr = firstArray(
      state?.discardPile,
      state?.discard,
      state?.ashes,
      state?.cenizas,
      state?.discardedCards
    );

    if (arr) return arr.length;

    const n = firstNumber(
      state?.discardCount,
      state?.ashesCount,
      state?.cenizasCount,
      state?.discardedCount
    );

    return num(n, 0);
  }

  /* ==========================================================================
     HUD
     ========================================================================== */

  function addBadge(container, label, value, extraClass = "") {
    if (!container) return;
    if (value <= 0) return;

    const badge = document.createElement("span");
    badge.className = `effect-badge ${extraClass}`.trim();
    badge.textContent = `${label} ${value}`;
    container.appendChild(badge);
  }

  function renderHUD() {
    if (!state) return;

    if (els.playerHp) {
      els.playerHp.textContent = `${getPlayerHp()}/${getMaxPlayerHp()}`;
    }

    if (els.playerEffects) {
      els.playerEffects.innerHTML = "";
      addBadge(els.playerEffects, "Bloqueo", getBlock(), "block");
      addBadge(els.playerEffects, "Quemadura", getBurn(), "burn");
    }

    if (els.ink) {
      els.ink.textContent = `${getEnergy()}/${getMaxEnergy()}`;
    }

    if (els.enemyName) {
      els.enemyName.textContent = getEnemyName();
    }

    if (els.enemyHp) {
      els.enemyHp.textContent = `${getEnemyHp()}`;
    }

    if (els.enemyIntent) {
      els.enemyIntent.innerHTML = "";
      addBadge(els.enemyIntent, "Bloqueo", getEnemyBlock(), "block");
      addBadge(els.enemyIntent, "Quemadura", getEnemyBurn(), "burn");
    }
  }

  function renderDeckStatus() {
    if (els.grimoireCount) {
      els.grimoireCount.textContent = getDrawCount();
    }

    if (els.ashesCount) {
      els.ashesCount.textContent = getDiscardCount();
    }
  }

  /* ==========================================================================
     TEXTOS FLOTANTES
     ========================================================================== */

  function spawnFloat(text, type = "damage", side = "center") {
    if (!els.floats) return;

    const float = document.createElement("div");
    float.className = `float-text ${type}`;
    float.textContent = text;

    let leftPercent = 50;

    if (side === "player") leftPercent = 36;
    if (side === "enemy") leftPercent = 64;

    leftPercent += Math.random() * 10 - 5;

    const topPercent = 32 + Math.random() * 20;

    float.style.left = `${leftPercent}%`;
    float.style.top = `${topPercent}%`;

    els.floats.appendChild(float);

    setTimeout(() => {
      float.remove();
    }, 950);
  }

  function snapshot() {
    return {
      playerHp: getPlayerHp(),
      enemyHp: getEnemyHp(),
      energy: getEnergy(),
      block: getBlock(),
      burn: getBurn(),
      enemyBlock: getEnemyBlock(),
      enemyBurn: getEnemyBurn(),
      handLength: Array.isArray(state?.hand) ? state.hand.length : 0
    };
  }

  function showDiffs(before, after) {
    const enemyDamage = before.enemyHp - after.enemyHp;
    if (enemyDamage > 0) {
      spawnFloat(`-${enemyDamage}`, "damage", "enemy");
    }

    const playerDamage = before.playerHp - after.playerHp;
    if (playerDamage > 0) {
      spawnFloat(`-${playerDamage}`, "damage", "player");
    }

    const playerHeal = after.playerHp - before.playerHp;
    if (playerHeal > 0) {
      spawnFloat(`+${playerHeal}`, "heal", "player");
    }

    const blockGain = after.block - before.block;
    if (blockGain > 0) {
      spawnFloat(`+${blockGain} bloqueo`, "block", "player");
    }

    const burnGain = after.burn - before.burn;
    if (burnGain > 0) {
      spawnFloat(`${burnGain} quemadura`, "burn", "player");
    }

    const enemyBlockGain = after.enemyBlock - before.enemyBlock;
    if (enemyBlockGain > 0) {
      spawnFloat(`+${enemyBlockGain} bloqueo`, "block", "enemy");
    }

    const enemyBurnGain = after.enemyBurn - before.enemyBurn;
    if (enemyBurnGain > 0) {
      spawnFloat(`${enemyBurnGain} quemadura`, "burn", "enemy");
    }
  }

  /* ==========================================================================
     PÁGINAS / CARTAS
     ========================================================================== */

  function createPageElement(card, index = null, large = false) {
    const element = document.createElement("article");

    element.className = large
      ? "page-card page-card-large"
      : "page-card";

    if (card?.type) {
      element.dataset.type = String(card.type);
    }

    if (card?.heal) {
      element.classList.add("is-heal");
    }

    if (card?.curse) {
      element.classList.add("is-curse");
    }

    if (card?.corrupted) {
      element.classList.add("is-corrupted");
    }

    if (!large && !canPlayCard(card)) {
      element.classList.add("is-disabled");
    }

    if (!large) {
      element.tabIndex = 0;
      element.setAttribute("role", "listitem");
      element.setAttribute(
        "aria-label",
        `${card?.name || "Página"}, coste ${cardCost(card)}, ${card?.desc || "sin descripción"}`
      );
    }

    element.innerHTML = `
      <div class="page-header">
        <span class="page-cost">${escapeHtml(cardCost(card))}</span>
        <h3 class="page-name">${escapeHtml(card?.name || "Página sin nombre")}</h3>
      </div>
      <p class="page-type">${escapeHtml(typeLabel(card))}</p>
      <p class="page-desc">${escapeHtml(card?.desc || "Sin descripción.")}</p>
    `;

    if (!large && typeof index === "number") {
      attachCardEvents(element, card, index);
    }

    return element;
  }

  function attachCardEvents(element, card, index) {
    element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    element.addEventListener("pointerdown", (event) => {
      activeCardElement = element;
      pressStartedAt = Date.now();
      pressStartX = event.clientX;
      pressStartY = event.clientY;
      pressMoved = false;

      clearTimeout(longPressTimer);

      longPressTimer = setTimeout(() => {
        if (activeCardElement === element && !pressMoved) {
          openInspect(card);
          activeCardElement = null;
        }
      }, LONG_PRESS_MS);
    });

    element.addEventListener("pointermove", (event) => {
      if (activeCardElement !== element) return;

      const dx = event.clientX - pressStartX;
      const dy = event.clientY - pressStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > MOVE_THRESHOLD) {
        pressMoved = true;
        clearTimeout(longPressTimer);
      }
    });

    element.addEventListener("pointerup", () => {
      clearTimeout(longPressTimer);

      if (
        activeCardElement === element &&
        !pressMoved &&
        Date.now() - pressStartedAt < LONG_PRESS_MS
      ) {
        tryPlayCard(index, element);
      }

      activeCardElement = null;
    });

    element.addEventListener("pointercancel", () => {
      clearTimeout(longPressTimer);
      activeCardElement = null;
    });

    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        tryPlayCard(index, element);
      }

      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        openInspect(card);
      }
    });
  }

  function renderHand() {
    if (!els.hand) return;

    els.hand.innerHTML = "";

    const hand = Array.isArray(state?.hand) ? state.hand : [];

    if (hand.length === 0) {
      const empty = document.createElement("p");
      empty.className = "battle-message";
      empty.style.position = "static";
      empty.style.transform = "none";
      empty.style.margin = "0";
      empty.textContent = "No hay páginas abiertas.";
      els.hand.appendChild(empty);
      return;
    }

    hand.forEach((card, index) => {
      const page = createPageElement(card, index, false);
      els.hand.appendChild(page);
    });
  }

  /* ==========================================================================
     INSPECCIÓN
     ========================================================================== */

  function openInspect(card) {
    if (!els.inspect || !els.inspectCard) return;

    els.inspectCard.replaceChildren(createPageElement(card, null, true));
    els.inspect.hidden = false;
  }

  function closeInspect() {
    if (!els.inspect) return;
    els.inspect.hidden = true;
  }

  /* ==========================================================================
     OVERLAY DE GRIMORIO / CENIZAS
     ========================================================================== */

  function createDeckItem(card) {
    const element = document.createElement("article");
    element.className = "deck-item";
    element.setAttribute("role", "listitem");

    element.innerHTML = `
      <span class="mini-cost">${escapeHtml(cardCost(card))}</span>
      <div class="deck-item-body">
        <h3 class="deck-item-name">${escapeHtml(card?.name || "Página sin nombre")}</h3>
        <p class="deck-item-meta">${escapeHtml(typeLabel(card))}</p>
        <p class="deck-item-desc">${escapeHtml(card?.desc || "Sin descripción.")}</p>
      </div>
    `;

    return element;
  }

  function openDeckOverlay(mode) {
    if (!els.deckOverlay || !els.deckList) return;

    const isGrimoire = mode === "grimoire";

    if (els.deckTitle) {
      els.deckTitle.textContent = isGrimoire ? "Grimorio" : "Cenizas";
    }

    if (els.deckSubtitle) {
      els.deckSubtitle.textContent = isGrimoire
        ? "Páginas que aún puedes robar."
        : "Páginas ya usadas o descartadas.";
    }

    els.deckList.innerHTML = "";

    const pile = isGrimoire ? getDrawPileArray() : getDiscardPileArray();
    const count = isGrimoire ? getDrawCount() : getDiscardCount();

    if (pile.length > 0) {
      pile.forEach((card) => {
        els.deckList.appendChild(createDeckItem(card));
      });
    } else if (count > 0) {
      const empty = document.createElement("p");
      empty.className = "deck-empty";
      empty.textContent = isGrimoire
        ? "El grimorio oculta estas páginas por ahora."
        : "Las cenizas guardan silencio por ahora.";
      els.deckList.appendChild(empty);
    } else {
      const empty = document.createElement("p");
      empty.className = "deck-empty";
      empty.textContent = isGrimoire
        ? "No quedan páginas por robar."
        : "No hay cenizas todavía.";
      els.deckList.appendChild(empty);
    }

    els.deckOverlay.hidden = false;
  }

  function closeDeckOverlay() {
    if (!els.deckOverlay) return;
    els.deckOverlay.hidden = true;
  }

  /* ==========================================================================
     ACCIONES DE JUEGO
     ========================================================================== */

  function isResultVisible() {
    return els.result && els.result.hidden === false;
  }

  function tryPlayCard(index, element) {
    if (!started || isResultVisible()) return;

    const card = state?.hand?.[index];
    if (!card) return;

    if (!canPlayCard(card)) {
      setMessage("No hay tinta suficiente para esta página.");
      shake(element);
      return;
    }

    const before = snapshot();
    let result;

    try {
      result = state.playCard(index);
    } catch (error) {
      console.error(error);
      setMessage("El grimorio rechaza esa página.");
      shake(element);
      return;
    }

    if (result === false) {
      setMessage("No se pudo lanzar la página.");
      shake(element);
      return;
    }

    const after = snapshot();
    showDiffs(before, after);

    setMessage(`Has usado: ${card.name || "una página"}.`);

    renderAll();
    checkResult();
  }

  function endTurn() {
    if (!started || isResultVisible()) return;

    const before = snapshot();

    try {
      state.endTurn();
    } catch (error) {
      console.error(error);
      setMessage("El ritual se ha interrumpido.");
      return;
    }

    const after = snapshot();
    showDiffs(before, after);

    if (getEnemyHp() <= 0) {
      setMessage("La amenaza ha sido sellada.");
    } else if (getPlayerHp() <= 0) {
      setMessage("El grimorio te ha consumido.");
    } else {
      setMessage("El enemigo ha actuado.");
    }

    renderAll();
    checkResult();
  }

  /* ==========================================================================
     RESULTADO
     ========================================================================== */

  function showResult(victory) {
    if (!els.result) return;

    started = false;

    if (els.resultTitle) {
      els.resultTitle.textContent = victory
        ? "Página recuperada"
        : "El grimorio te reclama";
    }

    if (els.resultText) {
      els.resultText.textContent = victory
        ? "Has sobrevivido al ritual y has recuperado una página perdida del grimorio."
        : "Tu vitalidad se ha agotado. El libro te incorpora como una página más.";
    }

    els.result.hidden = false;
  }

  function checkResult() {
    if (!state) return;

    if (getEnemyHp() <= 0) {
      showResult(true);
      return;
    }

    if (getPlayerHp() <= 0) {
      showResult(false);
    }
  }

  /* ==========================================================================
     RENDER GENERAL
     ========================================================================== */

  function renderAll() {
    renderHUD();
    renderDeckStatus();
    renderHand();
  }

  /* ==========================================================================
     INICIO / REINICIO
     ========================================================================== */

  function startGame() {
    try {
      state = createGameState();
      started = true;

      if (els.intro) els.intro.hidden = true;
      if (els.result) els.result.hidden = true;

      closeInspect();
      closeDeckOverlay();
      resetSensorNeutral();
      renderAll();

      setMessage("El grimorio se abre. Recupera las páginas perdidas.");
    } catch (error) {
      console.error(error);
      setMessage(`Error: ${error.message}`);
    }
  }

  function restartGame() {
    startGame();
  }

  /* ==========================================================================
     EVENTOS GLOBALES
     ========================================================================== */

  function bindGlobalEvents() {
    els.start?.addEventListener("click", startGame);
    els.restart?.addEventListener("click", restartGame);
    els.endTurn?.addEventListener("click", endTurn);

    els.closeInspect?.addEventListener("click", closeInspect);

    els.inspect?.addEventListener("click", (event) => {
      if (event.target === els.inspect) {
        closeInspect();
      }
    });

    els.openGrimoire?.addEventListener("click", () => openDeckOverlay("grimoire"));
    els.openAshes?.addEventListener("click", () => openDeckOverlay("ashes"));

    els.closeDeck?.addEventListener("click", closeDeckOverlay);
    els.deckCloseBottom?.addEventListener("click", closeDeckOverlay);

    els.deckOverlay?.addEventListener("click", (event) => {
      if (event.target === els.deckOverlay) {
        closeDeckOverlay();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeInspect();
        closeDeckOverlay();
      }
    });
  }

  /* ==========================================================================
     INIT
     ========================================================================== */

  function init() {
    bindGlobalEvents();
    initLookEffects();
    setMessage("Pulsa “Abrir el Grimorio” para comenzar.");
  }

  init();
})();