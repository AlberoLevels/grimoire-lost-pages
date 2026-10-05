(() => {
  "use strict";

  // G0.6: tope de mano (espejo del HAND_MAX de logic.js, para feedback de UI).
  const HAND_MAX = 10;

  const els = {
    game: document.getElementById("game"),
    battlefield: document.getElementById("battlefield"),
    intro: document.getElementById("intro-screen"),
    start: document.getElementById("start-game"),
    continueGame: document.getElementById("continue-game"),
    openHistory: document.getElementById("open-history"),
    openSettings: document.getElementById("open-settings"),
    openLore: document.getElementById("open-lore"),
    historyScreen: document.getElementById("history-screen"),
    settingsScreen: document.getElementById("settings-screen"),
    loreScreen: document.getElementById("lore-screen"),
    closeHistory: document.getElementById("close-history"),
    closeSettings: document.getElementById("close-settings"),
    closeLore: document.getElementById("close-lore"),
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
    floats: document.getElementById("floating-text-layer"),

    // G2.1 CAPA 1 — intro previa
    ritualIntro: document.getElementById("ritual-intro"),
    ritualGlyph: document.getElementById("ritual-glyph"),
    ritualCore: document.querySelector("#ritual-intro .ritual-core"),
    ritualStar: document.querySelector("#ritual-intro .ritual-star"),
    ritualHint: document.getElementById("ritual-hint")
  };

  if (!els.game || !els.hand || !els.endTurn) {
    console.error("Grimoire: Lost Pages — faltan elementos HTML necesarios.");
    return;
  }

  let state = null;
  let started = false;
  let currentScreen = "menu";
  let longPressTimer = null;
  let activeCardElement = null;
  let pressStartedAt = 0;
  let pressStartX = 0;
  let pressStartY = 0;
  let pressMoved = false;
  let ritualIntroHandled = false;

  const LONG_PRESS_MS = 500;
  const MOVE_THRESHOLD = 10;

  const SAVE_KEY = "grimoire-save";
  const FIRST_TIME_KEY = "grimoire-first-time";
  const SETTINGS_KEY = "grimoire-settings";
  const HISTORY_KEY = "grimoire-history"; // reservada para M3/E4 (Cronología)

  let pendingLoadedState = null;
  let saveToastEl = null;
  let saveToastTimer = null;

  /* ==================== AJUSTES (M2 + G1 audio) ==================== */

  const systemReduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp01(v) {
    const p = Number(v);
    if (!Number.isFinite(p)) return 0;
    return Math.min(1, Math.max(0, p));
  }

  function loadSettings() {
    const defaults = { reduceMotion: systemReduceMotion, oled: false, music: 0.7, sfx: 0.9, muted: false };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return defaults;
      return {
        reduceMotion: parsed.reduceMotion === true,
        oled: parsed.oled === true,
        music: typeof parsed.music === "number" ? clamp01(parsed.music) : defaults.music,
        sfx: typeof parsed.sfx === "number" ? clamp01(parsed.sfx) : defaults.sfx,
        muted: parsed.muted === true
      };
    } catch (e) {
      return defaults;
    }
  }

  let settings = loadSettings();

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  function isMotionReduced() {
    return systemReduceMotion || settings.reduceMotion === true;
  }

  /* ---- Puentes seguros hacia AudioFX (G1). Si el módulo no existe, no-op. ---- */
  function sfx(name) {
    if (window.AudioFX && typeof window.AudioFX.play === "function") window.AudioFX.play(name);
  }
  function sting(name) {
    // CAPA 2: one-shot narrativo (ritual_sting). Cola+flush dentro de AudioFX
    // respetando la política de autoplay: no se fuerza con contexto suspended.
    if (window.AudioFX && typeof window.AudioFX.playSting === "function") window.AudioFX.playSting(name);
  }
  function setAudioIntensity(mode) {
    if (window.AudioFX && typeof window.AudioFX.setIntensity === "function") window.AudioFX.setIntensity(mode);
  }
  function applyAudioSettings() {
    if (window.AudioFX && typeof window.AudioFX.applySettings === "function") {
      window.AudioFX.applySettings({ music: settings.music, sfx: settings.sfx, muted: settings.muted });
    }
  }
  function initAudio() {
    if (window.AudioFX && typeof window.AudioFX.init === "function") window.AudioFX.init();
  }

  function applySettingsToDOM() {
    const root = document.documentElement;
    root.classList.toggle("app-reduce-motion", isMotionReduced());
    root.classList.toggle("app-oled", settings.oled === true);

    look.enabled = !isMotionReduced();

    if (isMotionReduced()) {
      const container = document.getElementById("artifact-particles");
      if (container) container.innerHTML = "";

      const wrapper = document.querySelector(".arcane-orb-wrapper");
      if (wrapper) wrapper.style.transform = "";

      menuTargetX = 0;
      menuTargetY = 0;
      menuCurrentX = 0;
      menuCurrentY = 0;

      stopHubRingsLive();
      stopHubEntityAnimations();
      stopIntroLook();
    }

    applyAudioSettings();

    // Si estamos en el hub y cambian los ajustes de movimiento, refrescar ente/halos.
    if (currentScreen === "menu" && els.intro && !els.intro.hidden) {
      if (isMotionReduced()) {
        stopHubRingsLive();
        stopHubEntityAnimations();
      } else {
        animateEntityAwakening();
        animateHubRingsLive();
      }
    }
  }

  /* ==================== G2.1 — EL ENTE VIVO (GSAP) ====================
     Reglas grabadas:
     - El ente NO es un ojo literal: sin parpadeo, sin anatomía. Solo luz,
       energía, gravedad, tensión. El "latido" es pulso de energía.
     - La tinta es SOLO del libro/cartas. Aquí no hay una gota de tinta.
     - La HOSTILIDAD narrativa (el ente te rechaza) vive en la INTRO PREVIA
       (showRitualIntro), NO aquí. Esta función solo da vida al glifo del HUB.
     - Reversible: borra esta función, showRitualIntro, beginRitualFromIntro y
       sus llamadas, y vuelves al menú CSS estático.
     - Respeta isMotionReduced(): sin animar si el jugador reduce movimiento.
     - NO toca .arcane-orb-wrapper: ese lo mueve el orbit RAF (animateMenuOrbit);
       si GSAP lo pisara, pelearían. Se deja fuera a propósito.
  ======================================================================== */

  function animateEntityAwakening() {
    if (!window.gsap || typeof gsap.to !== "function") return;
    if (isMotionReduced()) return;

    const glyph = document.getElementById("menu-star-glyph");
    const core = document.querySelector(".orb-core");
    if (!glyph || !core) return;

    gsap.killTweensOf([glyph, core]);

    // Despertar corto del glifo del hub (sin hostilidad: eso ya pasó en la intro).
    gsap.set(glyph, { opacity: 0.3, scale: 0.85, filter: "brightness(0.6) blur(1px)", x: 0, y: 0 });
    gsap.set(core, { scale: 0.92, boxShadow: "0 0 12px rgba(168,85,247,0.25)" });

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    tl.to(glyph, {
      duration: 1.0,
      opacity: 1,
      scale: 1,
      filter: "brightness(1.2) blur(0px)",
      ease: "elastic.out(1, 0.55)"
    })
    .to(core, {
      duration: 1.0,
      scale: 1,
      boxShadow: "0 0 28px rgba(168,85,247,0.55), inset 0 0 14px rgba(96,165,250,0.3)",
      ease: "power2.inOut"
    }, "-=0.85")
    // Latido perpetuo: glifo y core a ritmos distintos (rompe la sincronía CSS).
    .call(() => {
      gsap.to(glyph, {
        duration: 2.4,
        scale: 1.045,
        opacity: 0.92,
        filter: "brightness(1.15)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });

      gsap.to(core, {
        duration: 3.1,
        boxShadow: "0 0 36px rgba(168,85,247,0.65), inset 0 0 16px rgba(96,165,250,0.32)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    });

    return tl;
  }

  function stopHubEntityAnimations() {
    const glyph = document.getElementById("menu-star-glyph");
    const core = document.querySelector(".orb-core");

    if (window.gsap) {
      if (glyph) gsap.killTweensOf(glyph);
      if (core) gsap.killTweensOf(core);
    }

    if (glyph) {
      glyph.style.removeProperty("opacity");
      glyph.style.removeProperty("transform");
      glyph.style.removeProperty("filter");
    }

    if (core) {
      core.style.removeProperty("box-shadow");
      core.style.removeProperty("transform");
    }
  }

  /* ==================== G2.1 CAPA 1b (v8) — HALOS QUE ABRAZAN LA BOLA ==========
     La bola NO se toca (forma y halo de fábrica intactos = "como al principio").
     Los halos difusos son un DIV HIJO de .orb-core con inset en %, que hereda su
     forma y centro sin medirla ni deformarla. GSAP anima las vars --r1/--r2/--o1/
     --o2 sobre ese div; los ::before/::after del CSS hacen el resto. Reversible.
  ================================================================================ */

  let hubHaloLayer = null;
  let hubRingTweens = [];

  function stopHubRingsLive() {
    hubRingTweens.forEach((t) => {
      if (t && typeof t.kill === "function") t.kill();
    });
    hubRingTweens = [];

    if (hubHaloLayer && hubHaloLayer.parentNode) {
      hubHaloLayer.parentNode.removeChild(hubHaloLayer);
    }
    hubHaloLayer = null;
  }

  function animateHubRingsLive() {
    if (!window.gsap || typeof gsap.to !== "function" || isMotionReduced()) {
      stopHubRingsLive();
      return;
    }

    const core = document.querySelector(".orb-core");
    if (!core) return;

    stopHubRingsLive();

    // Div hijo que hereda forma/centro de la bola por inset% (sin medirla).
    const layer = document.createElement("div");
    layer.className = "orb-halo-layer";
    layer.setAttribute("aria-hidden", "true");
    core.insertBefore(layer, core.firstChild); // detrás del glifo
    hubHaloLayer = layer;

    // Estado base + aparición suave del campo de halos.
    gsap.set(layer, { opacity: 0, "--r1": "0deg", "--r2": "0deg", "--o1": 0.55, "--o2": 0.45 });
    gsap.to(layer, { opacity: 1, duration: 1.2, ease: "power2.out" });

    // Luz viajera: cada halo rota en sentido opuesto, a su ritmo.
    hubRingTweens.push(gsap.to(layer, { "--r1": "360deg", duration: 14, repeat: -1, ease: "none" }));
    hubRingTweens.push(gsap.to(layer, { "--r2": "-360deg", duration: 10, repeat: -1, ease: "none" }));

    // Pulso desfasado de brillo.
    hubRingTweens.push(gsap.to(layer, { "--o1": 0.92, duration: 3.3, repeat: -1, yoyo: true, ease: "sine.inOut" }));
    hubRingTweens.push(gsap.to(layer, { "--o2": 0.86, duration: 4.1, repeat: -1, yoyo: true, ease: "sine.inOut" }));
  }

  /* ==================== G2.1 CAPA 1.1 — PARALLAJ DEL ENTE EN LA INTRO PREVIA ==========
     El ente de la intro previa reacciona al puntero (PC) o al giroscopio
     (móvil/tablet), igual que el del menú, pero de forma independiente y reversible.
     No usa GSAP para el desplazamiento: usa requestAnimationFrame para no pisar
     las animaciones de escala/brillo que hace GSAP sobre el glifo.
  ======================================================================================= */

  let introLookActive = false;
  let introLookRafId = null;
  let introTargetX = 0;
  let introTargetY = 0;
  let introCurrentX = 0;
  let introCurrentY = 0;

  const INTRO_EASE = 0.07;
  const INTRO_MAX_MOVE = 14;

  function updateIntroLookTargets(nx, ny) {
    if (!introLookActive || isMotionReduced()) return;

    const x = clampValue(nx, -1, 1);
    const y = clampValue(ny, -1, 1);

    introTargetX = x * INTRO_MAX_MOVE;
    introTargetY = y * INTRO_MAX_MOVE;
  }

  function onIntroPointerMove(event) {
    if (!introLookActive) return;

    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    updateIntroLookTargets(
      (event.clientX / w - 0.5) * 2,
      (event.clientY / h - 0.5) * 2
    );
  }

  function onIntroDeviceOrientation(event) {
    if (!introLookActive || isMotionReduced()) return;

    const hasBeta = typeof event.beta === "number" && Number.isFinite(event.beta);
    const hasGamma = typeof event.gamma === "number" && Number.isFinite(event.gamma);

    if (!hasBeta || !hasGamma) return;

    updateIntroLookTargets(
      clampValue(event.gamma / 45, -1, 1),
      clampValue((event.beta - 45) / 45, -1, 1)
    );
  }

  function introLookLoop() {
    if (!introLookActive) {
      introLookRafId = null;
      return;
    }

    introCurrentX += (introTargetX - introCurrentX) * INTRO_EASE;
    introCurrentY += (introTargetY - introCurrentY) * INTRO_EASE;

    const glyph = els.ritualGlyph;
    if (glyph) {
      glyph.style.transform =
        `translate3d(${introCurrentX.toFixed(2)}px, ${introCurrentY.toFixed(2)}px, 0)`;
    }

    introLookRafId = window.requestAnimationFrame(introLookLoop);
  }

  function startIntroLook() {
    if (isMotionReduced()) return;

    introLookActive = true;

    window.addEventListener("pointermove", onIntroPointerMove, { passive: true });
    window.addEventListener("deviceorientation", onIntroDeviceOrientation, { passive: true });

    if (introLookRafId) {
      cancelAnimationFrame(introLookRafId);
    }

    introLookLoop();
  }

  function stopIntroLook() {
    introLookActive = false;

    window.removeEventListener("pointermove", onIntroPointerMove);
    window.removeEventListener("deviceorientation", onIntroDeviceOrientation);

    if (introLookRafId) {
      cancelAnimationFrame(introLookRafId);
      introLookRafId = null;
    }

    introTargetX = 0;
    introTargetY = 0;
    introCurrentX = 0;
    introCurrentY = 0;

    if (els.ritualGlyph) {
      els.ritualGlyph.style.transform = "";
    }
  }

  /* ---- Intro previa (primera apertura): el ente esperando en negro puro. ----
     Opción B: tenue PERO lleno. Respira en rango medio-alto y nunca cae a
     "casi negro". La plenitud se la reserva al hub (al tocarlo se enciende).
     Requiere el relleno interno del paso 1 en style.css.
     CAPA 1.1: el ente también reacciona al puntero/giroscopio. */
  function showRitualIntro() {
    ritualIntroHandled = false;

    // FIX BUG: durante la intro previa no debe sonar música del menú.
    // Tocar fuera del ente seguirá desbloqueando audio en silencio,
    // pero el pad no arranca hasta showMenu().
    setAudioIntensity("none");

    // El menú principal no se ve detrás durante la intro previa.
    if (els.intro) els.intro.hidden = true;

    if (els.ritualIntro) {
      els.ritualIntro.hidden = false;
      els.ritualIntro.style.opacity = "1";
    }

    // Parallax/órbita del ente en la intro previa.
    startIntroLook();

    // Sin GSAP o con movimiento reducido: el ente se ve estático (CSS base),
    // el hint queda visible, y el toque sigue siendo válido.
    if (!window.gsap || typeof gsap.to !== "function" || isMotionReduced()) return;

    const star = els.ritualStar;
    const core = els.ritualCore;
    const hint = els.ritualHint;

    if (!star || !core) return;

    gsap.killTweensOf([star, core, hint].filter(Boolean));

    // Estado inicial: el ente YA lleno, pero tenue (dormido, no apagado).
    gsap.set(star, { opacity: 0.72, scale: 0.94, filter: "brightness(1.0)" });
    gsap.set(core, { boxShadow: "0 0 22px rgba(168,85,247,0.42)" });
    if (hint) gsap.set(hint, { opacity: 0 });

    // Respiración lenta: latido de energía en rango medio-alto.
    gsap.to(star, {
      duration: 3.0,
      scale: 1.04,
      opacity: 0.95,
      filter: "brightness(1.18)",
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    gsap.to(core, {
      duration: 3.8,
      boxShadow: "0 0 40px rgba(168,85,247,0.58), 0 0 72px rgba(96,165,250,0.22)",
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    // El hint entra y late sutil para invitar al toque.
    if (hint) {
      gsap.to(hint, { duration: 1.2, opacity: 0.85, ease: "power2.out" });
      gsap.to(hint, {
        duration: 2.2,
        opacity: 0.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 1.2
      });
    }
  }

  /* ---- El toque al ente: comienza el ritual y da paso al menú principal. ----
     FIX BUG (intro previa -> menú principal): antes desvanecíamos #ritual-intro
     ENTERO (fondo opaco incluido). Durante el fade el fondo se volvía
     translúcido y, como el menú principal está hidden, asomaba el COMBATE de
     debajo. Fix: desvanecer SOLO los hijos de la intro previa; el fondo negro
     opaco aguanta hasta el final y luego se oculta limpio. Nunca asoma nada. */
  function beginRitualFromIntro() {
    if (ritualIntroHandled) return;
    if (!els.ritualIntro || els.ritualIntro.hidden) return;

    ritualIntroHandled = true;

    // Consumir la "primera vez" SOLO al completar el gesto.
    try { localStorage.setItem(FIRST_TIME_KEY, "1"); } catch (e) {}

    // CAPA 2: el ritual suena en el instante del contacto. One-shot con cola+flush
    // dentro de AudioFX: si el contexto aún se está desbloqueando (resume() es
    // asíncrono, ver política de autoplay), el sting se encola y se dispara al
    // pasar a running, en vez de fallar por start() sobre suspended.
    sting("ritual_sting");

    // Hijos de la intro previa (glifo, hint...): son los únicos que se desvanecen.
    const children = Array.from(els.ritualIntro.children);

    // Matamos los tweens previos de la intro para que no peleen con el fade.
    if (window.gsap) {
      gsap.killTweensOf([els.ritualStar, els.ritualCore, els.ritualHint].filter(Boolean));
      gsap.killTweensOf(children);
    }

    const leave = () => {
      // Detener parallax/giroscopio de la intro previa.
      stopIntroLook();

      els.ritualIntro.hidden = true;
      els.ritualIntro.style.opacity = "1";

      showMenu();
    };

    // FIX: fade sobre los hijos, NO sobre la capa entera. El fondo opaco de
    // #ritual-intro se mantiene a opacity 1 mientras sus hijos se apagan, así
    // no se ve a través de él el combate. Al terminar, se oculta de golpe.
    if (window.gsap && !isMotionReduced() && children.length) {
      gsap.to(children, {
        duration: 0.6,
        opacity: 0,
        ease: "power2.in",
        onComplete: leave
      });
    } else {
      leave();
    }
  }

  /* ==================== EFECTO AMBIENTAL: MIRADA ARCANA ==================== */

  const look = {
    enabled: !isMotionReduced(),
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

  function clampValue(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function setLookTargets(nx, ny) {
    if (!look.enabled) return;

    const x = clampValue(nx, -1, 1);
    const y = clampValue(ny, -1, 1);

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

    const hasB = typeof event.beta === "number" && Number.isFinite(event.beta);
    const hasG = typeof event.gamma === "number" && Number.isFinite(event.gamma);

    if (!hasB || !hasG) return;

    look.sensorActive = true;

    if (look.neutralBeta === null || look.neutralGamma === null) {
      look.neutralBeta = event.beta;
      look.neutralGamma = event.gamma;
      return;
    }

    const range = 30;

    setLookTargets(
      clampValue((event.gamma - look.neutralGamma) / range, -1, 1),
      clampValue((event.beta - look.neutralBeta) / range, -1, 1)
    );
  }

  function onPointerMove(event) {
    if (!look.enabled || look.sensorActive) return;

    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    setLookTargets(
      (event.clientX / w - 0.5) * 2,
      (event.clientY / h - 0.5) * 2
    );
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

  /* ==================== UTILIDADES ==================== */

  function createGameState() {
    if (typeof GameState === "undefined") {
      throw new Error("GameState no está definido. Revisa src/logic.js.");
    }
    if (typeof GameState === "function") return new GameState();
    if (GameState && typeof GameState === "object") return GameState;
    throw new Error("GameState no tiene una forma válida.");
  }

  function num(v, fb = 0) {
    const p = Number(v);
    return Number.isFinite(p) ? p : fb;
  }

  function escapeHtml(v) {
    return String(v ?? " ").replace(/[&<>"']/g, (c) => {
      switch (c) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        case "'": return "&#39;";
        default: return c;
      }
    });
  }

  function setMessage(t) {
    if (els.message) els.message.textContent = t;
  }

  function shake(el) {
    if (!el || typeof el.animate !== "function") return;
    el.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" }
      ],
      { duration: 180, easing: "ease-in-out" }
    );
  }

  /* ==================== LECTURA SEGURA DEL ESTADO ==================== */

  function getEnergy() { return num(state?.energy); }
  function getMaxEnergy() { return num(state?.maxEnergy, getEnergy()); }
  function getPlayerHp() { return num(state?.playerHp); }
  function getMaxPlayerHp() { return num(state?.maxPlayerHp, getPlayerHp()); }
  function getEnemyHp() { return num(state?.enemy?.hp); }
  function getEnemyName() { return state?.enemy?.name || "Amenaza"; }
  function getBlock() { return num(state?.block ?? state?.playerBlock ?? state?.shield); }
  function getBurn() { return num(state?.burn ?? state?.playerBurn); }
  function getEnemyBlock() { return num(state?.enemy?.block ?? state?.enemyBlock); }
  function getEnemyBurn() { return num(state?.enemy?.burn ?? state?.enemyBurn ?? state?.enemyBurnStacks); }
  function cardCost(card) { return num(card?.cost); }
  function canPlayCard(card) { return cardCost(card) <= getEnergy(); }

  function getEnemyIntent() {
    const intent = state?.enemy?.intent;
    if (!intent || typeof intent !== "object") return null;

    const kind = String(intent.kind || "").toLowerCase();
    if (kind !== "attack" && kind !== "block" && kind !== "burn") return null;

    return {
      kind,
      value: num(intent.value),
      label: intent.label || (kind === "attack" ? "Ataque" : kind === "block" ? "Bloqueo" : "Quemadura")
    };
  }

  function hasEffect(card, type) {
    return Array.isArray(card?.effects) && card.effects.some((e) => e.type === type);
  }

  function effectLabel(e) {
    switch (e.type) {
      case "damage": return e.hits > 1 ? `Daño ${e.value} ×${e.hits}` : `Daño ${e.value}`;
      case "self_damage": return `Auto-daño ${e.value}`;
      case "block": return `Bloqueo ${e.value}`;
      case "heal": return `Curación ${e.value}`;
      case "burn_enemy": return `Quema ${e.value}`;
      case "burn_player": return `Te quema ${e.value}`;
      case "draw": return `Roba ${e.value}`;
      case "energy": return e.value >= 0 ? `Tinta +${e.value}` : `Tinta ${e.value}`;
      default: return "";
    }
  }

  function describeEffects(card) {
    return (Array.isArray(card?.effects) ? card.effects : []).map(effectLabel).filter(Boolean);
  }

  function describeKeywords(card) {
    const k = [];
    if (card?.exhaust) k.push("Se agota");
    if (card?.retain) k.push("Permanece");
    if (card?.innate) k.push("Innata");
    return k;
  }

  function typeLabel(card) {
    if (card?.curse) return "Maldición";
    if (card?.corrupted) return "Corrupción";

    const type = String(card?.type || "").toLowerCase();

    if (type === "attack") return "Ataque";
    if (type === "power") return "Poder";

    if (type === "skill") {
      if (hasEffect(card, "heal") && !hasEffect(card, "block")) return "Curación";
      if (hasEffect(card, "block")) return "Defensa";
      return "Truco";
    }

    return "Página";
  }

  /* G1: sonido de cast según el tipo de carta. */
  function cardSound(card) {
    if (!card) return "card_skill";
    if (card.type === "attack") return "card_attack";
    if (card.type === "power") return "card_power";
    if (hasEffect(card, "heal")) return "card_heal";
    return "card_skill";
  }

  /* ==================== MAZO / DESCARTE ==================== */

  function firstArray(...vals) {
    for (const v of vals) if (Array.isArray(v)) return v;
    return null;
  }

  function firstNumber(...vals) {
    for (const v of vals) {
      if (v == null) continue;
      const p = Number(v);
      if (Number.isFinite(p)) return p;
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
    const a = firstArray(
      state?.drawPile,
      state?.deck,
      state?.library,
      state?.grimoire,
      state?.remainingCards,
      state?.drawCards
    );
    if (a) return a.length;
    return num(
      firstNumber(
        state?.drawCount,
        state?.deckCount,
        state?.remainingCount,
        state?.grimoireCount,
        state?.libraryCount
      ),
      0
    );
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
    const a = firstArray(
      state?.discardPile,
      state?.discard,
      state?.ashes,
      state?.cenizas,
      state?.discardedCards
    );
    if (a) return a.length;
    return num(
      firstNumber(
        state?.discardCount,
        state?.ashesCount,
        state?.cenizasCount,
        state?.discardedCount
      ),
      0
    );
  }

  /* ==================== HUD ==================== */

  function addBadge(container, label, value, extraClass = "") {
    if (!container || value <= 0) return;

    const b = document.createElement("span");
    b.className = `effect-badge ${extraClass}`.trim();
    b.textContent = `${label} ${value}`;
    container.appendChild(b);
  }

  function intentGlyph(kind) {
    if (kind === "block") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 L19 6 L19 12 C19 16.5 15.5 19.8 12 21 C8.5 19.8 5 16.5 5 12 L5 6 Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 6.4 L12 18.4" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.55"/></svg>`;
    }

    if (kind === "burn") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 C13.8 6.6 16.8 8 16.2 12.4 C15.8 15.6 13.6 18 12 20.6 C10.4 18 8.2 15.6 7.8 12.4 C7.2 8.4 10.2 7 12 3 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9.4 C12.9 11 13.2 12.2 12.4 13.8 C12 14.6 11.4 13.9 11.4 13 C11.4 11.8 11.2 11 12 9.4 Z" fill="currentColor" opacity="0.5"/></svg>`;
    }

    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 L14.2 13 L12 15.2 L9.8 13 Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.2 13.6 L15.8 13.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 15.2 L12 19.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="20.4" r="1.1" fill="currentColor"/></svg>`;
  }

  function buildIntentElement(intent) {
    const card = document.createElement("div");
    card.className = `enemy-intent-card intent-${intent.kind}`;
    card.setAttribute("role", "img");
    card.setAttribute("aria-label", `El enemigo preparará ${intent.label} ${intent.value}`);

    const g = document.createElement("span");
    g.className = "intent-glyph";
    g.setAttribute("aria-hidden", "true");
    g.innerHTML = intentGlyph(intent.kind);

    const v = document.createElement("span");
    v.className = "intent-value";
    v.setAttribute("aria-hidden", "true");
    v.textContent = intent.value;

    const l = document.createElement("span");
    l.className = "intent-label";
    l.setAttribute("aria-hidden", "true");
    l.textContent = intent.label;

    card.appendChild(g);
    card.appendChild(v);
    card.appendChild(l);

    return card;
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

      const intent = getEnemyIntent();
      if (intent && getEnemyHp() > 0) {
        els.enemyIntent.appendChild(buildIntentElement(intent));
      }

      const er = document.createElement("div");
      er.className = "enemy-current-effects";
      addBadge(er, "Bloqueo", getEnemyBlock(), "block");
      addBadge(er, "Quemadura", getEnemyBurn(), "burn");

      if (er.childNodes.length > 0) {
        els.enemyIntent.appendChild(er);
      }
    }

    renderCombatReadouts();
  }

  /* ==================== G0 / G0.5: LECTURA DE COMBATE (barras de vida + turno) ==================== */

  let enemyHpFillEl = null;
  let playerHpFillEl = null;
  let turnLabelEl = null;

  function renderCombatReadouts() {
    if (!enemyHpFillEl) enemyHpFillEl = document.getElementById("enemy-hp-fill");
    if (!playerHpFillEl) playerHpFillEl = document.getElementById("player-hp-fill");
    if (!turnLabelEl) turnLabelEl = document.getElementById("turn-label");

    if (enemyHpFillEl) {
      const max = num(state?.enemy?.maxHp, 0) || num(state?.enemy?.hp, 0) || 1;
      const pct = Math.max(0, Math.min(1, getEnemyHp() / max));
      enemyHpFillEl.style.width = `${(pct * 100).toFixed(1)}%`;
    }

    if (playerHpFillEl) {
      const max = getMaxPlayerHp() || 1;
      const pct = Math.max(0, Math.min(1, getPlayerHp() / max));
      playerHpFillEl.style.width = `${(pct * 100).toFixed(1)}%`;
    }

    if (turnLabelEl) {
      turnLabelEl.textContent = `Turno ${num(state?.turnCount, 0)}`;
    }
  }

  /* ==================== G0.6: FEEDBACK MANO LLENA ==================== */

  function checkHandFull(prefix) {
    if (!state || !Array.isArray(state.hand)) return;

    if (state.hand.length >= HAND_MAX) {
      const text = prefix
        ? `${prefix} La mano está llena (${HAND_MAX}).`
        : `La mano está llena (${HAND_MAX}). Las páginas sobrantes se vuelven ceniza.`;
      setMessage(text);
    }
  }

  function renderDeckStatus() {
    if (els.grimoireCount) els.grimoireCount.textContent = getDrawCount();
    if (els.ashesCount) els.ashesCount.textContent = getDiscardCount();
  }

  /* ==================== TEXTOS FLOTANTES ==================== */

  function spawnFloat(text, type = "damage", side = "center") {
    if (!els.floats) return;

    const f = document.createElement("div");
    f.className = `float-text ${type}`;
    f.textContent = text;

    let lp = 50;
    if (side === "player") lp = 36;
    if (side === "enemy") lp = 64;

    lp += Math.random() * 10 - 5;

    f.style.left = `${lp}%`;
    f.style.top = `${32 + Math.random() * 20}%`;

    els.floats.appendChild(f);
    setTimeout(() => f.remove(), 950);
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

  // G1: además de los floats, dispara los SFX de impacto correspondientes.
  function showDiffs(before, after) {
    const ed = before.enemyHp - after.enemyHp;
    if (ed > 0) {
      spawnFloat(`-${ed}`, "damage", "enemy");
      sfx("enemy_hit");
    }

    const pd = before.playerHp - after.playerHp;
    if (pd > 0) {
      spawnFloat(`-${pd}`, "damage", "player");
      sfx("player_hit");
    }

    const ph = after.playerHp - before.playerHp;
    if (ph > 0) spawnFloat(`+${ph}`, "heal", "player");

    const bg = after.block - before.block;
    if (bg > 0) {
      spawnFloat(`+${bg} bloqueo`, "block", "player");
      sfx("block");
    }

    const brg = after.burn - before.burn;
    if (brg > 0) {
      spawnFloat(`${brg} quemadura`, "burn", "player");
      sfx("burn");
    }

    const ebg = after.enemyBlock - before.enemyBlock;
    if (ebg > 0) spawnFloat(`+${ebg} bloqueo`, "block", "enemy");

    const ebrg = after.enemyBurn - before.enemyBurn;
    if (ebrg > 0) {
      spawnFloat(`${ebrg} quemadura`, "burn", "enemy");
      sfx("burn");
    }
  }

  /* ==================== CARTAS (mano) ==================== */

  function createInspectButton(card) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-inspect-btn";
    btn.setAttribute("aria-label", `Inspeccionar ${card?.name || "página"}`);
    btn.title = "Inspeccionar página";
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12 C 6 5.5, 18 5.5, 21.5 12 C 18 18.5, 6 18.5, 2.5 12 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle class="eye-iris" cx="12" cy="12" r="3.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="#05070f"/><circle cx="13.1" cy="10.9" r="0.7" fill="#f8fafc" opacity="0.85"/></svg>`;

    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("pointerup", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      sfx("ui_click");
      openInspect(card);
    });

    return btn;
  }

  function buildMechHtml(card) {
    const effects = describeEffects(card);
    const keywords = describeKeywords(card);

    let html = '<div class="page-mech">';

    if (effects.length) {
      html += '<ul class="page-effects">' +
        effects.map((t) => `<li class="effect-line">${escapeHtml(t)}</li>`).join("") +
        "</ul>";
    }

    if (keywords.length) {
      html += '<div class="page-keywords">' +
        keywords.map((t) => `<span class="keyword-badge">${escapeHtml(t)}</span>`).join("") +
        "</div>";
    }

    html += "</div>";
    return html;
  }

  function createPageElement(card, index = null) {
    const element = document.createElement("article");
    element.className = "page-card";

    if (card?.type) element.dataset.type = String(card.type);
    if (hasEffect(card, "heal")) element.classList.add("is-heal");
    if (card?.curse) element.classList.add("is-curse");
    if (card?.corrupted) element.classList.add("is-corrupted");
    if (!canPlayCard(card)) element.classList.add("is-disabled");

    element.tabIndex = 0;
    element.setAttribute("role", "listitem");

    const eff = describeEffects(card).join(", ");
    const kw = describeKeywords(card).join(", ");

    element.setAttribute(
      "aria-label",
      `${card?.name || "Página"}, coste ${cardCost(card)}. ${eff}${kw ? ". " + kw : ""}. ${card?.desc || ""}`
    );

    element.innerHTML = `
      <div class="page-header">
        <span class="page-cost">${escapeHtml(cardCost(card))}</span>
        <h3 class="page-name">${escapeHtml(card?.name || "Página sin nombre")}</h3>
      </div>
      <p class="page-type">${escapeHtml(typeLabel(card))}</p>
      ${buildMechHtml(card)}
      <p class="page-desc">${escapeHtml(card?.desc || "Sin descripción.")}</p>
    `;

    element.appendChild(createInspectButton(card));

    if (typeof index === "number") attachCardEvents(element, card, index);

    return element;
  }

  function attachCardEvents(element, card, index) {
    element.addEventListener("contextmenu", (e) => e.preventDefault());

    element.addEventListener("pointerdown", (e) => {
      activeCardElement = element;
      pressStartedAt = Date.now();
      pressStartX = e.clientX;
      pressStartY = e.clientY;
      pressMoved = false;

      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (activeCardElement === element && !pressMoved) {
          openInspect(card);
          activeCardElement = null;
        }
      }, LONG_PRESS_MS);
    });

    element.addEventListener("pointermove", (e) => {
      if (activeCardElement !== element) return;

      const dx = e.clientX - pressStartX;
      const dy = e.clientY - pressStartY;

      if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
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

    element.addEventListener("keydown", (e) => {
      if (e.target !== element) return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        tryPlayCard(index, element);
      }

      if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        openInspect(card);
      }
    });
  }

  function renderHand() {
    if (!els.hand) return;

    els.hand.innerHTML = "";

    const hand = Array.isArray(state?.hand) ? state.hand : [];

    if (hand.length === 0) {
      const e = document.createElement("p");
      e.className = "battle-message";
      e.style.cssText = "position:static;transform:none;margin:0";
      e.textContent = "No hay páginas abiertas.";
      els.hand.appendChild(e);
      return;
    }

    hand.forEach((card, i) => els.hand.appendChild(createPageElement(card, i)));
  }

  /* ==================== INSPECCIÓN ==================== */

  function fillInspectCard(card) {
    if (!els.inspectCard) return;

    els.inspectCard.className = "page-card page-card-large";

    if (card?.type) els.inspectCard.dataset.type = String(card.type);
    else delete els.inspectCard.dataset.type;

    if (hasEffect(card, "heal")) els.inspectCard.classList.add("is-heal");
    if (card?.curse) els.inspectCard.classList.add("is-curse");
    if (card?.corrupted) els.inspectCard.classList.add("is-corrupted");

    const art = document.createElement("div");
    art.className = "page-art";
    art.setAttribute("aria-hidden", "true");
    art.innerHTML = `<span class="page-art-glyph">✦</span>`;

    const body = document.createElement("div");
    body.className = "page-body";
    body.innerHTML = `
      <div class="page-header">
        <span class="page-cost">${escapeHtml(cardCost(card))}</span>
        <h3 class="page-name">${escapeHtml(card?.name || "Página sin nombre")}</h3>
      </div>
      <p class="page-type">${escapeHtml(typeLabel(card))}</p>
      ${buildMechHtml(card)}
      <p class="page-desc">${escapeHtml(card?.desc || "Sin descripción.")}</p>
    `;

    els.inspectCard.replaceChildren(art, body);
  }

  function openInspect(card) {
    if (!els.inspect || !els.inspectCard) return;
    sfx("ui_click");
    fillInspectCard(card);
    els.inspect.hidden = false;
  }

  function closeInspect() {
    if (els.inspect) els.inspect.hidden = true;
  }

  /* ==================== OVERLAY GRIMORIO / CENIZAS ==================== */

  function createDeckItem(card) {
    const element = document.createElement("article");
    element.className = "deck-item";
    element.setAttribute("role", "listitem");

    const effects = describeEffects(card);
    const keywords = describeKeywords(card);

    let mechHtml = "";

    if (effects.length || keywords.length) {
      mechHtml = '<div class="deck-item-mech">';

      if (effects.length) {
        mechHtml += '<ul class="deck-item-effects">' +
          effects.map((t) => `<li>${escapeHtml(t)}</li>`).join("") +
          "</ul>";
      }

      if (keywords.length) {
        mechHtml += '<div class="deck-item-keywords">' +
          keywords.map((t) => `<span class="deck-keyword-badge">${escapeHtml(t)}</span>`).join("") +
          "</div>";
      }

      mechHtml += "</div>";
    }

    element.innerHTML = `
      <span class="mini-cost">${escapeHtml(cardCost(card))}</span>
      <div class="deck-item-body">
        <h3 class="deck-item-name">${escapeHtml(card?.name || "Página sin nombre")}</h3>
        <p class="deck-item-meta">${escapeHtml(typeLabel(card))}</p>
        ${mechHtml}
        <p class="deck-item-desc">${escapeHtml(card?.desc || "Sin descripción.")}</p>
      </div>
    `;

    return element;
  }

  function openDeckOverlay(mode) {
    if (!els.deckOverlay || !els.deckList) return;

    sfx("ui_click");

    const isG = mode === "grimoire";

    if (els.deckTitle) els.deckTitle.textContent = isG ? "Grimorio" : "Cenizas";
    if (els.deckSubtitle) {
      els.deckSubtitle.textContent = isG
        ? "Páginas que aún puedes robar."
        : "Páginas ya usadas o descartadas.";
    }

    els.deckList.innerHTML = "";

    const pile = isG ? getDrawPileArray() : getDiscardPileArray();
    const count = isG ? getDrawCount() : getDiscardCount();

    if (pile.length > 0) {
      pile.forEach((c) => els.deckList.appendChild(createDeckItem(c)));
    } else if (count > 0) {
      const e = document.createElement("p");
      e.className = "deck-empty";
      e.textContent = isG
        ? "El grimorio oculta estas páginas por ahora."
        : "Las cenizas guardan silencio por ahora.";
      els.deckList.appendChild(e);
    } else {
      const e = document.createElement("p");
      e.className = "deck-empty";
      e.textContent = isG
        ? "No quedan páginas por robar."
        : "No hay cenizas todavía.";
      els.deckList.appendChild(e);
    }

    els.deckOverlay.hidden = false;
  }

  function closeDeckOverlay() {
    if (els.deckOverlay) els.deckOverlay.hidden = true;
  }

  /* ==================== AUTOGUARDADO ==================== */

  function peekSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);

      if (typeof GameState === "undefined" || typeof GameState.fromSave !== "function") {
        return null;
      }

      const inst = GameState.fromSave(data);
      if (!inst) {
        clearSave();
        return null;
      }

      return inst;
    } catch (e) {
      console.warn("No se pudo leer la partida guardada:", e);
      clearSave();
      return null;
    }
  }

  function saveGame() {
    if (!state || typeof state.serialize !== "function") return;

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state.serialize()));
      showToast();
    } catch (e) {
      console.warn("No se pudo guardar:", e);
    }
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  function persistAfterAction() {
    if (isResultVisible()) clearSave();
    else saveGame();
  }

  function showToast(text = "Progreso guardado") {
    if (!saveToastEl) {
      saveToastEl = document.createElement("div");
      saveToastEl.className = "save-toast";
      saveToastEl.setAttribute("role", "status");
      saveToastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(saveToastEl);
    }

    saveToastEl.textContent = text;
    saveToastEl.classList.add("is-visible");

    clearTimeout(saveToastTimer);
    saveToastTimer = setTimeout(() => {
      if (saveToastEl) saveToastEl.classList.remove("is-visible");
    }, 1200);
  }

  /* ==================== M1: NAVEGACIÓN ==================== */

  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  function refreshContinueButton() {
    if (els.continueGame) els.continueGame.hidden = !hasSave();
  }

  function showMenu() {
    stopIntroLook();

    // Robustez: si alguien llama showMenu sin pasar por la intro previa, la intro
    // previa no debe quedar visible.
    if (els.ritualIntro) {
      els.ritualIntro.hidden = true;
      els.ritualIntro.style.opacity = "1";
    }

    currentScreen = "menu";
    started = false;
    state = null;

    hideAllSubScreens();
    closeInspect();
    closeDeckOverlay();

    if (els.result) els.result.hidden = true;

    if (els.intro) {
      els.intro.hidden = false;
      els.intro.classList.remove("menu-hub--leaving");

      if (!isMotionReduced()) {
        els.intro.classList.remove("menu-hub--entering");
        void els.intro.offsetWidth;
        els.intro.classList.add("menu-hub--entering");
      }
    }

    refreshContinueButton();
    setMenuVisualMode(true);
    setAudioIntensity("menu"); // G1

    animateEntityAwakening();  // G2.1: el ente vivo en el hub
    animateHubRingsLive();     // G2.1 CAPA 1b v8: halos que abrazan la bola sin tocarla
  }

  function showCombat() {
    currentScreen = "combat";

    hideAllSubScreens();

    if (els.result) els.result.hidden = true;

    setMenuVisualMode(false);

    if (els.intro) {
      if (isMotionReduced()) {
        els.intro.hidden = true;
        els.intro.classList.remove("menu-hub--entering", "menu-hub--leaving");
      } else {
        els.intro.classList.remove("menu-hub--entering");
        els.intro.classList.add("menu-hub--leaving");

        setTimeout(() => {
          if (currentScreen === "combat" && els.intro) {
            els.intro.hidden = true;
            els.intro.classList.remove("menu-hub--leaving");
          }
        }, 420);
      }
    }

    setAudioIntensity("combat"); // G1
  }

  function hideAllSubScreens() {
    if (els.historyScreen) els.historyScreen.hidden = true;
    if (els.settingsScreen) els.settingsScreen.hidden = true;
    if (els.loreScreen) els.loreScreen.hidden = true;
  }

  function openSubScreen(el) {
    if (!el) return;

    hideAllSubScreens();
    el.hidden = false;

    sfx("ui_click"); // G1

    if (el === els.settingsScreen) syncSettingsUI();
  }

  function showConfirmDiscard(onYes) {
    if (document.getElementById("confirm-discard-overlay")) return;

    const ov = document.createElement("div");
    ov.id = "confirm-discard-overlay";
    ov.className = "overlay";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.innerHTML = `
      <div class="overlay-card">
        <h2>¿Descartar el ritual actual?</h2>
        <p>Queda una página sin cerrar entre las cenizas. Si abres el grimorio de nuevo, se perderá.</p>
        <div class="continue-actions">
          <button id="confirm-discard-yes" class="ritual-button" type="button">Descartar y abrir</button>
          <button id="confirm-discard-no" class="ritual-button secondary-button" type="button">Volver</button>
        </div>
      </div>
    `;

    document.body.appendChild(ov);

    ov.querySelector("#confirm-discard-yes").addEventListener("click", () => {
      ov.remove();
      onYes();
    });

    ov.querySelector("#confirm-discard-no").addEventListener("click", () => {
      ov.remove();
      sfx("ui_click");
    });
  }

  function startNewRun() {
    hideContinueOverlay();

    pendingLoadedState = null;
    state = createGameState();
    started = true;

    showCombat();

    closeInspect();
    closeDeckOverlay();
    resetSensorNeutral();

    renderAll();

    sfx("draw"); // G1: robo inicial

    checkHandFull("El grimorio se abre.");

    if (state && Array.isArray(state.hand) && state.hand.length < HAND_MAX) {
      setMessage("El grimorio se abre. Recupera las páginas perdidas.");
    }
  }

  function handleNewRunClick() {
    sfx("ui_click"); // G1

    if (hasSave()) {
      showConfirmDiscard(() => {
        clearSave();
        startNewRun();
      });
    } else {
      startNewRun();
    }
  }

  function continueFromSave() {
    if (!pendingLoadedState) {
      hideContinueOverlay();
      handleNewRunClick();
      return;
    }

    state = pendingLoadedState;
    pendingLoadedState = null;
    started = true;

    hideContinueOverlay();
    showCombat();

    closeInspect();
    closeDeckOverlay();
    resetSensorNeutral();

    renderAll();

    sfx("draw"); // G1
    setMessage("El ritual continúa donde lo dejaste.");
  }

  function showContinueOverlay() {
    if (document.getElementById("continue-overlay")) return;

    const ov = document.createElement("div");
    ov.id = "continue-overlay";
    ov.className = "overlay continue-overlay";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-labelledby", "continue-title");
    ov.innerHTML = `
      <div class="overlay-card continue-card">
        <h2 id="continue-title">El grimorio recuerda</h2>
        <p>Queda un ritual sin cerrar entre sus páginas. ¿Deseas continuarlo, o abrir el libro de nuevo?</p>
        <div class="continue-actions">
          <button id="continue-resume" class="ritual-button" type="button">Continuar el ritual</button>
          <button id="continue-new" class="ritual-button secondary-button" type="button">Nueva página</button>
        </div>
      </div>
    `;

    document.body.appendChild(ov);

    ov.querySelector("#continue-resume").addEventListener("click", () => {
      sfx("ui_click");
      continueFromSave();
    });

    ov.querySelector("#continue-new").addEventListener("click", () => {
      sfx("ui_click");
      hideContinueOverlay();
      startNewRun();
    });
  }

  function hideContinueOverlay() {
    const el = document.getElementById("continue-overlay");
    if (el) el.remove();
  }

  /* ==================== M2 + G1: UI DE AJUSTES (toggles + sliders de audio) ==================== */

  function buildSettingsUI() {
    const card = els.settingsScreen ? els.settingsScreen.querySelector(".overlay-card") : null;
    if (!card) return;

    const placeholder = card.querySelector(".subscreen-placeholder");
    if (placeholder) placeholder.remove();

    const body = document.createElement("div");
    body.className = "settings-body";
    body.innerHTML = `
      <label class="setting-row">
        <span class="setting-text">
          <span class="setting-name">Reducir movimiento</span>
          <span class="setting-desc">Apaga el aleteo del libro: giros, pulsos y transiciones.</span>
        </span>
        <input type="checkbox" id="setting-reduce-motion" class="setting-toggle">
        <span class="setting-switch" aria-hidden="true"></span>
      </label>

      <label class="setting-row">
        <span class="setting-text">
          <span class="setting-name">Modo OLED</span>
          <span class="setting-desc">Negro vivo y brillos contenidos para pantallas AMOLED.</span>
        </span>
        <input type="checkbox" id="setting-oled" class="setting-toggle">
        <span class="setting-switch" aria-hidden="true"></span>
      </label>

      <label class="setting-row setting-row-slider">
        <span class="setting-text">
          <span class="setting-name">Música</span>
          <span class="setting-desc">Volumen del pad ambiental del grimorio.</span>
        </span>
        <input type="range" id="setting-music" class="setting-slider" min="0" max="100" step="5">
      </label>

      <label class="setting-row setting-row-slider">
        <span class="setting-text">
          <span class="setting-name">Efectos</span>
          <span class="setting-desc">Volumen de los SFX del ritual.</span>
        </span>
        <input type="range" id="setting-sfx" class="setting-slider" min="0" max="100" step="5">
      </label>

      <label class="setting-row">
        <span class="setting-text">
          <span class="setting-name">Silencio</span>
          <span class="setting-desc">Apaga todo el sonido del grimorio.</span>
        </span>
        <input type="checkbox" id="setting-mute" class="setting-toggle">
        <span class="setting-switch" aria-hidden="true"></span>
      </label>

      <button id="setting-wipe" class="ritual-button danger-button" type="button">Borrar progreso</button>
    `;

    if (els.closeSettings) card.insertBefore(body, els.closeSettings);
    else card.appendChild(body);

    body.querySelector("#setting-reduce-motion").addEventListener("change", (e) => {
      settings.reduceMotion = e.target.checked === true;
      saveSettings();
      applySettingsToDOM();
      sfx("ui_click");
    });

    body.querySelector("#setting-oled").addEventListener("change", (e) => {
      settings.oled = e.target.checked === true;
      saveSettings();
      applySettingsToDOM();
      sfx("ui_click");
    });

    // G1: sliders de audio (actualizan en vivo al arrastrar, clic al soltar).
    const musicSlider = body.querySelector("#setting-music");
    const sfxSlider = body.querySelector("#setting-sfx");
    const muteToggle = body.querySelector("#setting-mute");

    musicSlider.addEventListener("input", (e) => {
      settings.music = clamp01(Number(e.target.value) / 100);
      saveSettings();
      applyAudioSettings();
    });

    musicSlider.addEventListener("change", () => sfx("ui_click"));

    sfxSlider.addEventListener("input", (e) => {
      settings.sfx = clamp01(Number(e.target.value) / 100);
      saveSettings();
      applyAudioSettings();
    });

    sfxSlider.addEventListener("change", () => sfx("ui_click"));

    muteToggle.addEventListener("change", (e) => {
      settings.muted = e.target.checked === true;
      saveSettings();
      applyAudioSettings();
      if (!settings.muted) sfx("ui_click");
    });

    body.querySelector("#setting-wipe").addEventListener("click", showWipeConfirm);
  }

  function syncSettingsUI() {
    const rm = document.getElementById("setting-reduce-motion");
    const ol = document.getElementById("setting-oled");
    const mu = document.getElementById("setting-music");
    const sx = document.getElementById("setting-sfx");
    const mt = document.getElementById("setting-mute");

    if (rm) rm.checked = isMotionReduced();
    if (ol) ol.checked = settings.oled === true;
    if (mu) mu.value = String(Math.round(settings.music * 100));
    if (sx) sx.value = String(Math.round(settings.sfx * 100));
    if (mt) mt.checked = settings.muted === true;
  }

  function showWipeConfirm() {
    if (document.getElementById("wipe-confirm-overlay")) return;

    sfx("ui_click");

    const ov = document.createElement("div");
    ov.id = "wipe-confirm-overlay";
    ov.className = "overlay";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.innerHTML = `
      <div class="overlay-card">
        <h2>¿Borrar todo el progreso?</h2>
        <p>Se perderán la partida guardada, la cronología, los ajustes y el recuerdo de tu primera apertura. El libro volverá a estar en blanco.</p>
        <div class="continue-actions">
          <button id="wipe-yes" class="ritual-button danger-button" type="button">Borrar todo</button>
          <button id="wipe-no" class="ritual-button secondary-button" type="button">Volver</button>
        </div>
      </div>
    `;

    document.body.appendChild(ov);

    ov.querySelector("#wipe-yes").addEventListener("click", () => {
      ov.remove();
      wipeAllProgress();
    });

    ov.querySelector("#wipe-no").addEventListener("click", () => {
      ov.remove();
      sfx("ui_click");
    });
  }

  function wipeAllProgress() {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(HISTORY_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(FIRST_TIME_KEY);
    } catch (e) {}

    settings = { reduceMotion: false, oled: false, music: 0.7, sfx: 0.9, muted: false };

    applySettingsToDOM();

    pendingLoadedState = null;
    state = null;
    started = false;

    syncSettingsUI();

    // Nota: wipe borra FIRST_TIME_KEY, así que la intro previa volverá en la
    // PRÓXIMA apertura. No te manda a la intro en medio de ajustes (sería
    // sorpresivo); si quieres que wipe abra la intro ya, cambia showMenu() por
    // showRitualIntro() aquí y me lo dices.
    showMenu();

    showToast("Progreso borrado");
  }

  /* ==================== M1-HUB: ÓRBITA Y PARTÍCULAS ==================== */

  let menuOrbitActive = false;
  let menuOrbitRafId = null;
  let menuParticleInterval = null;
  let menuTargetX = 0;
  let menuTargetY = 0;
  let menuCurrentX = 0;
  let menuCurrentY = 0;

  const MENU_EASE = 0.05;
  const MENU_MAX_MOVE = 12;

  function updateMenuOrbitTargets(nx, ny) {
    if (!menuOrbitActive || isMotionReduced()) return;

    const x = clampValue(nx, -1, 1);
    const y = clampValue(ny, -1, 1);

    menuTargetX = x * MENU_MAX_MOVE;
    menuTargetY = y * MENU_MAX_MOVE;
  }

  function onMenuPointerMove(event) {
    if (!menuOrbitActive) return;

    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    updateMenuOrbitTargets(
      (event.clientX / w - 0.5) * 2,
      (event.clientY / h - 0.5) * 2
    );
  }

  function onMenuDeviceOrientation(event) {
    if (!menuOrbitActive || isMotionReduced()) return;

    const hasBeta = typeof event.beta === "number" && Number.isFinite(event.beta);
    const hasGamma = typeof event.gamma === "number" && Number.isFinite(event.gamma);

    if (!hasBeta || !hasGamma) return;

    updateMenuOrbitTargets(
      clampValue(event.gamma / 45, -1, 1),
      clampValue((event.beta - 45) / 45, -1, 1)
    );
  }

  function animateMenuOrbit() {
    if (!menuOrbitActive) {
      menuOrbitRafId = null;
      return;
    }

    menuCurrentX += (menuTargetX - menuCurrentX) * MENU_EASE;
    menuCurrentY += (menuTargetY - menuCurrentY) * MENU_EASE;

    const wrapper = document.querySelector(".arcane-orb-wrapper");
    if (wrapper) {
      wrapper.style.transform =
        `translate3d(${menuCurrentX.toFixed(2)}px, ${menuCurrentY.toFixed(2)}px, 0)`;
    }

    menuOrbitRafId = window.requestAnimationFrame(animateMenuOrbit);
  }

  function spawnMenuParticles() {
    const container = document.getElementById("artifact-particles");
    if (!container || isMotionReduced()) return;

    if (menuParticleInterval) {
      clearInterval(menuParticleInterval);
      menuParticleInterval = null;
    }

    for (let i = 0; i < 15; i++) createParticle(container);

    menuParticleInterval = setInterval(() => {
      if (menuOrbitActive && container.children.length < 20) {
        createParticle(container);
      }
    }, 2000);
  }

  function createParticle(container) {
    const p = document.createElement("div");

    const size = Math.random() * 3 + 1;
    const isGold = Math.random() > 0.5;

    p.style.position = "absolute";
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.borderRadius = "50%";
    p.style.background = isGold ? "var(--gold)" : "var(--purple-light)";
    p.style.boxShadow = `0 0 ${size * 2}px ${isGold ? "rgba(251,191,36,0.6)" : "rgba(192,132,252,0.6)"}`;
    p.style.pointerEvents = "none";
    p.style.opacity = "0";
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${Math.random() * 100}%`;

    container.appendChild(p);

    const duration = 4000 + Math.random() * 4000;
    const driftX = (Math.random() - 0.5) * 50;
    const driftY = -(50 + Math.random() * 100);

    const anim = p.animate(
      [
        { transform: "translate(0, 0)", opacity: 0 },
        { transform: `translate(${driftX}px, ${driftY / 2}px)`, opacity: 0.8, offset: 0.2 },
        { transform: `translate(${driftX * 2}px, ${driftY}px)`, opacity: 0 }
      ],
      { duration: duration, easing: "ease-out", fill: "forwards" }
    );

    anim.onfinish = () => p.remove();
  }

  function setMenuVisualMode(active) {
    menuOrbitActive = active;

    if (active) {
      window.addEventListener("pointermove", onMenuPointerMove, { passive: true });
      window.addEventListener("deviceorientation", onMenuDeviceOrientation, { passive: true });

      if (menuOrbitRafId) cancelAnimationFrame(menuOrbitRafId);

      animateMenuOrbit();
      spawnMenuParticles();
    } else {
      window.removeEventListener("pointermove", onMenuPointerMove);
      window.removeEventListener("deviceorientation", onMenuDeviceOrientation);

      if (menuOrbitRafId) {
        cancelAnimationFrame(menuOrbitRafId);
        menuOrbitRafId = null;
      }

      if (menuParticleInterval) {
        clearInterval(menuParticleInterval);
        menuParticleInterval = null;
      }

      const container = document.getElementById("artifact-particles");
      if (container) container.innerHTML = "";

      stopHubRingsLive();
      stopHubEntityAnimations();
    }
  }

  /* ==================== ACCIONES DE JUEGO ==================== */

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

    const drawsFromCard = Array.isArray(card.effects)
      ? card.effects
          .filter((e) => e.type === "draw")
          .reduce((acc, e) => acc + (Number(e.value) || 0), 0)
      : 0;

    let result;

    try {
      result = state.playCard(index);
    } catch (e) {
      console.error(e);
      setMessage("El grimorio rechaza esa página.");
      shake(element);
      return;
    }

    if (result === false) {
      setMessage("No se pudo lanzar la página.");
      shake(element);
      return;
    }

    sfx(cardSound(card)); // G1: sonido de cast según tipo

    const after = snapshot();
    showDiffs(before, after);

    if (drawsFromCard > 0) {
      sfx("draw"); // G1
      checkHandFull(`Has usado ${card.name || "una página"}.`);
    } else {
      setMessage(`Has usado: ${card.name || "una página"}.`);
    }

    renderAll();
    checkResult();
    persistAfterAction();
  }

  function endTurn() {
    if (!started || isResultVisible()) return;

    const before = snapshot();

    try {
      state.endTurn();
    } catch (e) {
      console.error(e);
      setMessage("El ritual se ha interrumpido.");
      return;
    }

    const after = snapshot();
    showDiffs(before, after);

    sfx("turn_end"); // G1: campana de fin de turno
    sfx("draw");     // G1: robo de la nueva mano

    if (getEnemyHp() <= 0) {
      setMessage("La amenaza ha sido sellada.");
    } else if (getPlayerHp() <= 0) {
      setMessage("El grimorio te ha consumido.");
    } else {
      setMessage("El enemigo ha actuado.");
      checkHandFull("El enemigo ha actuado.");
    }

    renderAll();
    checkResult();
    persistAfterAction();
  }

  /* ==================== RESULTADO ==================== */

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

    sfx(victory ? "victory" : "defeat"); // G1
  }

  function checkResult() {
    if (!state) return;

    if (getEnemyHp() <= 0) {
      showResult(true);
      return;
    }

    if (getPlayerHp() <= 0) showResult(false);
  }

  /* ==================== RENDER ==================== */

  function renderAll() {
    renderHUD();
    renderDeckStatus();
    renderHand();
  }

  /* ==================== EVENTOS GLOBALES ==================== */

  function bindGlobalEvents() {
    els.start?.addEventListener("click", handleNewRunClick);

    els.continueGame?.addEventListener("click", () => {
      sfx("ui_click"); // G1

      const loaded = peekSave();
      if (loaded) {
        pendingLoadedState = loaded;
        continueFromSave();
      } else {
        refreshContinueButton();
      }
    });

    els.openHistory?.addEventListener("click", () => openSubScreen(els.historyScreen));
    els.openSettings?.addEventListener("click", () => openSubScreen(els.settingsScreen));
    els.openLore?.addEventListener("click", () => openSubScreen(els.loreScreen));

    els.closeHistory?.addEventListener("click", () => {
      sfx("ui_click");
      if (els.historyScreen) els.historyScreen.hidden = true;
    });

    els.closeSettings?.addEventListener("click", () => {
      sfx("ui_click");
      if (els.settingsScreen) els.settingsScreen.hidden = true;
    });

    els.closeLore?.addEventListener("click", () => {
      sfx("ui_click");
      if (els.loreScreen) els.loreScreen.hidden = true;
    });

    els.restart?.addEventListener("click", () => {
      sfx("ui_click");
      showMenu();
    });

    els.endTurn?.addEventListener("click", endTurn);

    els.closeInspect?.addEventListener("click", () => {
      sfx("ui_click");
      closeInspect();
    });

    els.inspect?.addEventListener("click", (e) => {
      if (e.target === els.inspect) closeInspect();
    });

    els.openGrimoire?.addEventListener("click", () => openDeckOverlay("grimoire"));
    els.openAshes?.addEventListener("click", () => openDeckOverlay("ashes"));

    els.closeDeck?.addEventListener("click", () => {
      sfx("ui_click");
      closeDeckOverlay();
    });

    els.deckCloseBottom?.addEventListener("click", () => {
      sfx("ui_click");
      closeDeckOverlay();
    });

    els.deckOverlay?.addEventListener("click", (e) => {
      if (e.target === els.deckOverlay) closeDeckOverlay();
    });

    // G2.1 CAPA 1: el toque al ente comienza el ritual. NO stopPropagation:
    // el mismo gesto debe llegar a los listeners de audio (desbloqueo autoplay).
    els.ritualGlyph?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      beginRitualFromIntro();
    });

    els.ritualGlyph?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        beginRitualFromIntro();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeInspect();
        closeDeckOverlay();
        hideAllSubScreens();
      }
    });
  }

  /* ==================== INIT ==================== */

  function init() {
    bindGlobalEvents();
    initAudio();          // G1: registra desbloqueo por gesto + pausa en segundo plano
    initLookEffects();
    applySettingsToDOM(); // incluye applyAudioSettings()
    buildSettingsUI();

    // G2.1 CAPA 1: primera apertura -> intro previa; resto -> menú principal.
    let firstTime = false;
    try {
      firstTime = !localStorage.getItem(FIRST_TIME_KEY);
    } catch (e) {
      firstTime = false;
    }

    if (firstTime) {
      showRitualIntro();
    } else {
      showMenu();
    }
  }

  init();
})();
