/* ==========================================================================
   GRIMOIRE: LOST PAGES — Motor de audio (G1 reescrito + saneado móvil)
   SFX y música mediante Web Audio API con MP3 reales desde assets/audio/.
   Expone window.AudioFX. No depende de game.js.

   Correcciones principales:
   - No se crea AudioContext hasta el primer gesto real del usuario.
   - Los listeners de desbloqueo se mantienen hasta ctx.state === "running".
   - Los MP3 se descargan como ArrayBuffer antes del gesto.
   - Al desbloquear, se decodifica primero la música; los SFX van después,
     escalonados, para evitar picos de CPU en Android.
   - Las fuentes musicales arrancan con un pequeño lookahead y fade corto.
   - El crossfade menú/combate no baja la pista actual si la destino aún
     no está lista.
   - visibilitychange usa fade + debounce antes de suspender el contexto.
   - Los SFX no se decodifican “en caliente” durante el combate.
   ========================================================================== */

(() => {
  "use strict";

  const AUDIO_BASE = "./assets/audio/";

  const MUSIC_NAMES = ["music_menu", "music_combat"];

  const SFX_NAMES = [
    "ui_click",
    "card_attack",
    "card_skill",
    "card_power",
    "card_heal",
    "draw",
    "block",
    "burn",
    "enemy_hit",
    "player_hit",
    "turn_end",
    "victory",
    "defeat"
  ];

  // Orden de decodificación de SFX tras la música: primero lo más frecuente.
  const SFX_DECODE_ORDER = [
    "ui_click",
    "draw",
    "enemy_hit",
    "player_hit",
    "card_attack",
    "turn_end",
    "block",
    "burn",
    "card_skill",
    "card_power",
    "card_heal",
    "victory",
    "defeat"
  ];

  const ALL_FETCH_NAMES = [...MUSIC_NAMES, ...SFX_DECODE_ORDER];

  // Valores conservadores para móvil, sin warm-ups artificiales raros.
  const START_LOOKAHEAD = 0.025;       // 25 ms: evita click de arranque seco.
  const SFX_LOOKAHEAD = 0.005;         // 5 ms: micro-margen para SFX.
  const MUSIC_START_FADE = 0.18;       // arranque inicial de música.
  const MUSIC_CROSSFADE = 1.2;         // menú <-> combate.
  const VISIBILITY_FADE_OUT = 0.18;    // al ocultar.
  const VISIBILITY_FADE_IN = 0.22;     // al volver.
  const HIDDEN_SUSPEND_DELAY = 500;    // debounce antes de suspender contexto.
  const SFX_DECODE_DELAY = 120;        // separación entre decodificaciones SFX.

  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;

  const rawBuffers = {};
  const audioBuffers = {};
  const loaded = {};
  const loading = {};
  const failed = {};
  const decoding = {};

  const music = {
    menu: { gain: null, source: null },
    combat: { gain: null, source: null }
  };

  let unlockHandler = null;
  let unlockListenersBound = false;
  let contextRunning = false;
  let resumeInProgress = false;

  let musicEverStarted = false;
  let sfxQueueStarted = false;
  let sfxIndex = 0;

  let foreground = 1;
  let hiddenTimeout = null;
  let visibilityBound = false;

  const mix = {
    music: 0.7,
    sfx: 0.9,
    muted: false,
    intensity: "menu"
  };

  /* ==================== UTILIDADES ==================== */

  function clamp01(v) {
    const p = Number(v);
    if (!Number.isFinite(p)) return 0;
    return Math.min(1, Math.max(0, p));
  }

  function supportedAudioContext() {
    return typeof window !== "undefined" &&
      (window.AudioContext || window.webkitAudioContext);
  }

  function isMusicName(name) {
    return name === "music_menu" || name === "music_combat";
  }

  function rampParam(param, value, fade) {
    if (!ctx || !param) return;
    const t = ctx.currentTime;
    const target = Math.max(0, Number(value) || 0);
    const duration = Math.max(0, Number(fade) || 0);

    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);

    if (duration <= 0.01) {
      param.setValueAtTime(target, t);
    } else {
      param.linearRampToValueAtTime(target, t + duration);
    }
  }

  /* ==================== MEZCLA ==================== */

  function applyMixValues(fade = 0.05) {
    if (!ctx || !masterGain || !musicGain || !sfxGain) return;

    const masterTarget = mix.muted ? 0 : foreground;
    const musicTarget = clamp01(mix.music) * 0.9;
    const sfxTarget = clamp01(mix.sfx) * 0.9;

    rampParam(masterGain.gain, masterTarget, fade);
    rampParam(musicGain.gain, musicTarget, fade);
    rampParam(sfxGain.gain, sfxTarget, fade);
  }

  /* ==================== CONTEXTO ==================== */

  function createAudioContext() {
    if (ctx || !supportedAudioContext()) return ctx;

    const AC = window.AudioContext || window.webkitAudioContext;

    try {
      // Prioriza latencia baja en móvil cuando el navegador lo soporta.
      ctx = new AC({ latencyHint: "interactive" });
    } catch (e) {
      ctx = new AC();
    }

    masterGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();

    masterGain.connect(ctx.destination);
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);

    applyMixValues(0.01);
    return ctx;
  }

  /* ==================== DESCARGA RAW ==================== */

  function fetchRaw(name) {
    if (loaded[name] || loading[name] || failed[name]) return;

    loading[name] = true;
    const url = AUDIO_BASE + name + ".mp3";

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => {
        rawBuffers[name] = arrayBuffer;
        loaded[name] = true;
        loading[name] = false;

        if (contextRunning) {
          if (isMusicName(name)) {
            decodeName(name, null);
          } else if (sfxQueueStarted) {
            scheduleNextSfx(0);
          }
        }
      })
      .catch((error) => {
        failed[name] = true;
        loading[name] = false;
        console.warn("AudioFX: no se pudo descargar", url, error);

        if (contextRunning) {
          if (isMusicName(name)) {
            maybeScheduleSfxQueue();
            applyIntensityIfPossible();
          } else if (sfxQueueStarted) {
            scheduleNextSfx(0);
          }
        }
      });
  }

  /* ==================== DECODIFICACIÓN ==================== */

  function onDecoded(name) {
    if (isMusicName(name)) {
      maybeScheduleSfxQueue();
      applyIntensityIfPossible();
    }
  }

  function decodeName(name, done) {
    if (!ctx) {
      if (done) done(false);
      return;
    }

    if (audioBuffers[name]) {
      if (done) done(true);
      return;
    }

    if (failed[name]) {
      if (done) done(false);
      return;
    }

    if (decoding[name]) {
      // Ya se está decodificando; no llamamos a done para no duplicar cola.
      return;
    }

    const arrayBuffer = rawBuffers[name];
    if (!arrayBuffer) {
      if (done) done(false);
      return;
    }

    decoding[name] = true;

    const finishSuccess = (audioBuffer) => {
      if (!decoding[name]) return;
      decoding[name] = false;
      audioBuffers[name] = audioBuffer;
      delete rawBuffers[name];
      if (done) done(true);
      onDecoded(name);
    };

    const finishError = (error) => {
      if (!decoding[name]) return;
      decoding[name] = false;
      failed[name] = true;
      delete rawBuffers[name];
      console.warn("AudioFX: no se pudo decodificar", name, error);
      if (done) done(false);
      onDecoded(name);
    };

    try {
      const promise = ctx.decodeAudioData(arrayBuffer, finishSuccess, finishError);

      // Algunos navegadores devuelven promesa además de usar callbacks.
      if (promise && typeof promise.then === "function") {
        promise
          .then((audioBuffer) => {
            if (!audioBuffers[name] && !failed[name]) {
              finishSuccess(audioBuffer);
            }
          })
          .catch((error) => {
            if (!failed[name]) {
              finishError(error);
            }
          });
      }
    } catch (error) {
      finishError(error);
    }
  }

  /* ==================== MÚSICA ==================== */

  function ensureMusicGain(name) {
    if (!ctx || !musicGain) return null;

    const track = music[name];
    if (!track.gain) {
      track.gain = ctx.createGain();
      track.gain.gain.value = 0;
      track.gain.connect(musicGain);
    }

    return track.gain;
  }

  function startMusicSource(name, startAt) {
    const track = music[name];
    if (track.source) return true;

    const buffer = audioBuffers["music_" + name];
    if (!buffer) return false;

    const gain = ensureMusicGain(name);
    if (!gain) return false;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);

    try {
      source.start(startAt);
    } catch (e) {
      return false;
    }

    track.source = source;
    return true;
  }

  function setTrackTarget(name, target, fade) {
    if (!ctx || ctx.state !== "running") return;

    const track = music[name];
    const gain = ensureMusicGain(name);
    if (!gain) return;

    const now = ctx.currentTime;
    const current = gain.gain.value;
    const clamped = clamp01(target);
    const duration = Math.max(0.05, Number(fade) || MUSIC_CROSSFADE);

    if (clamped > 0.001) {
      if (!track.source) {
        const startAt = now + START_LOOKAHEAD;

        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0, now);

        if (!startMusicSource(name, startAt)) {
          return;
        }

        gain.setValueAtTime(0, startAt);
        gain.linearRampToValueAtTime(clamped, startAt + duration);
      } else {
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(current, now);
        gain.linearRampToValueAtTime(clamped, now + duration);
      }
    } else {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(current, now);
      gain.linearRampToValueAtTime(0, now + duration);
    }
  }

  function applyIntensityIfPossible(explicitFade) {
    if (!contextRunning || !ctx || ctx.state !== "running") return;

    const target = mix.intensity === "combat" ? "combat" : "menu";
    const other = target === "combat" ? "menu" : "combat";

    // Regla clave: no bajar la pista actual si la destino no está lista.
    if (!audioBuffers["music_" + target]) return;

    const fade =
      Number.isFinite(explicitFade) && explicitFade > 0
        ? explicitFade
        : (musicEverStarted ? MUSIC_CROSSFADE : MUSIC_START_FADE);

    setTrackTarget(target, 1, fade);
    setTrackTarget(other, 0, fade);

    musicEverStarted = true;
  }

  function maybeScheduleSfxQueue() {
    if (sfxQueueStarted) return;

    const menuDone = !!audioBuffers.music_menu || !!failed.music_menu;
    const combatDone = !!audioBuffers.music_combat || !!failed.music_combat;

    if (menuDone && combatDone) {
      sfxQueueStarted = true;
      sfxIndex = 0;
      scheduleNextSfx(0);
    }
  }

  /* ==================== COLA SFX ==================== */

  function scheduleNextSfx(delay) {
    if (!contextRunning) return;

    if (delay > 0) {
      window.setTimeout(processNextSfx, delay);
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(processNextSfx, { timeout: 1000 });
    } else {
      window.setTimeout(processNextSfx, SFX_DECODE_DELAY);
    }
  }

  function processNextSfx() {
    if (!contextRunning) return;
    if (sfxIndex >= SFX_DECODE_ORDER.length) return;

    const name = SFX_DECODE_ORDER[sfxIndex];

    if (audioBuffers[name] || failed[name]) {
      sfxIndex++;
      scheduleNextSfx(SFX_DECODE_DELAY);
      return;
    }

    if (decoding[name] || loading[name] || !loaded[name]) {
      // Esperamos sin avanzar la cola para no perder ese SFX.
      scheduleNextSfx(300);
      return;
    }

    decodeName(name, () => {
      sfxIndex++;
      scheduleNextSfx(SFX_DECODE_DELAY);
    });
  }

  /* ==================== SFX ==================== */

  function play(name) {
    if (!ctx || ctx.state !== "running") return;
    if (mix.muted) return;
    if (document.hidden) return;
    if (foreground < 0.01) return;

    const buffer = audioBuffers[name];
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(sfxGain);
    source.start(ctx.currentTime + SFX_LOOKAHEAD);
  }

  /* ==================== DESBLOQUEO POR GESTO ==================== */

  function markContextRunning() {
    if (contextRunning) return;

    contextRunning = true;
    removeUnlockListeners();

    // Prioridad absoluta: música primero.
    decodeName("music_menu", null);
    decodeName("music_combat", null);

    maybeScheduleSfxQueue();
    applyIntensityIfPossible(MUSIC_START_FADE);
  }

  function handleUnlockGesture() {
    createAudioContext();

    if (!ctx) {
      removeUnlockListeners();
      return;
    }

    if (ctx.state === "running") {
      markContextRunning();
      return;
    }

    if (resumeInProgress) return;
    resumeInProgress = true;

    let promise = null;

    try {
      promise = ctx.resume();
    } catch (e) {
      resumeInProgress = false;
      return;
    }

    if (promise && typeof promise.then === "function") {
      promise
        .then(() => {
          resumeInProgress = false;
          if (ctx && ctx.state === "running") {
            markContextRunning();
          }
        })
        .catch(() => {
          resumeInProgress = false;
          // No quitamos listeners: seguiremos reintentando en próximos gestos.
        });
    } else {
      resumeInProgress = false;
      if (ctx.state === "running") {
        markContextRunning();
      }
    }
  }

  function bindUnlockListeners() {
    if (unlockListenersBound || contextRunning) return;

    unlockHandler = handleUnlockGesture;

    const passive = { passive: true };

    window.addEventListener("pointerdown", unlockHandler, passive);
    window.addEventListener("touchend", unlockHandler, passive);
    window.addEventListener("click", unlockHandler, passive);
    window.addEventListener("keydown", unlockHandler);

    unlockListenersBound = true;
  }

  function removeUnlockListeners() {
    if (!unlockListenersBound || !unlockHandler) {
      unlockListenersBound = false;
      unlockHandler = null;
      return;
    }

    window.removeEventListener("pointerdown", unlockHandler);
    window.removeEventListener("touchend", unlockHandler);
    window.removeEventListener("click", unlockHandler);
    window.removeEventListener("keydown", unlockHandler);

    unlockListenersBound = false;
    unlockHandler = null;
  }

  /* ==================== VISIBILIDAD / SEGUNDO PLANO ==================== */

  function suspendContextIfStillHidden() {
    hiddenTimeout = null;

    if (!ctx) return;
    if (!document.hidden) return;
    if (ctx.state !== "running") return;

    try {
      ctx.suspend();
    } catch (e) {
      // Silencioso.
    }
  }

  function onVisibilityChange() {
    if (!ctx) return;

    if (document.hidden) {
      if (hiddenTimeout) {
        window.clearTimeout(hiddenTimeout);
        hiddenTimeout = null;
      }

      foreground = 0;
      applyMixValues(VISIBILITY_FADE_OUT);

      hiddenTimeout = window.setTimeout(
        suspendContextIfStillHidden,
        HIDDEN_SUSPEND_DELAY
      );

      return;
    }

    if (hiddenTimeout) {
      window.clearTimeout(hiddenTimeout);
      hiddenTimeout = null;
    }

    const restore = () => {
      foreground = 1;
      applyMixValues(VISIBILITY_FADE_IN);
      applyIntensityIfPossible(0.25);
    };

    if (!contextRunning && ctx.state === "running") {
      markContextRunning();
    }

    if (ctx.state === "suspended") {
      let promise = null;

      try {
        promise = ctx.resume();
      } catch (e) {
        promise = null;
      }

      if (promise && typeof promise.then === "function") {
        promise
          .then(() => {
            if (ctx && ctx.state === "running") {
              if (!contextRunning) markContextRunning();
              restore();
            } else {
              bindUnlockListeners();
            }
          })
          .catch(() => {
            bindUnlockListeners();
          });
      } else if (ctx.state === "running") {
        if (!contextRunning) markContextRunning();
        restore();
      } else {
        bindUnlockListeners();
      }
    } else if (ctx.state === "running") {
      if (!contextRunning) markContextRunning();
      restore();
    } else {
      bindUnlockListeners();
    }
  }

  function bindVisibility() {
    if (visibilityBound) return;
    visibilityBound = true;
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  /* ==================== API PÚBLICA ==================== */

  function setIntensity(mode) {
    mix.intensity = mode === "combat" ? "combat" : "menu";

    if (contextRunning && ctx && ctx.state === "running") {
      applyIntensityIfPossible(MUSIC_CROSSFADE);
    }
  }

  function unlock() {
    handleUnlockGesture();
  }

  function applySettings(next) {
    if (next && typeof next === "object") {
      if (typeof next.music === "number") {
        mix.music = clamp01(next.music);
      }
      if (typeof next.sfx === "number") {
        mix.sfx = clamp01(next.sfx);
      }
      if (typeof next.muted === "boolean") {
        mix.muted = next.muted;
      }
    }

    if (!ctx) return;

    applyMixValues(0.05);

    // Solo reanima si el contexto ya existe. No crea contexto desde el slider.
    if (ctx.state === "suspended" && !mix.muted && !document.hidden) {
      let promise = null;

      try {
        promise = ctx.resume();
      } catch (e) {
        promise = null;
      }

      if (promise && typeof promise.then === "function") {
        promise
          .then(() => {
            if (ctx && ctx.state === "running") {
              if (!contextRunning) {
                markContextRunning();
              } else {
                foreground = 1;
                applyMixValues(VISIBILITY_FADE_IN);
                applyIntensityIfPossible(0.25);
              }
            }
          })
          .catch(() => {
            // Silencioso. Los listeners de gesto seguirán si aún no hay contexto running.
          });
      } else if (ctx.state === "running") {
        if (!contextRunning) {
          markContextRunning();
        } else {
          foreground = 1;
          applyMixValues(VISIBILITY_FADE_IN);
          applyIntensityIfPossible(0.25);
        }
      }
    }
  }

  function init() {
    if (!supportedAudioContext()) return;

    // IMPORTANTE: aquí NO creamos AudioContext.
    bindUnlockListeners();
    bindVisibility();

    // Precargamos bytes crudos. Esto no requiere AudioContext y no bloquea UI.
    ALL_FETCH_NAMES.forEach(fetchRaw);
  }

  window.AudioFX = {
    init,
    unlock,
    play,
    setIntensity,
    applySettings
  };
})();
