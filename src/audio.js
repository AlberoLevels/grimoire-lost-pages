/* ==========================================================================
   GRIMOIRE: LOST PAGES — Motor de audio (G1 reescrito)
   Rollback a la última versión conocida buena + parche suave de visibilidad.

   Esta versión conserva la lógica que ya hacía sonar menú y combate.
   Único cambio principal:
   - Al pasar a segundo plano / recientes, hace fade-out y suspende con delay.
   - Al volver, hace resume y fade-in.
   No se toca decodificación ni arranque de música más allá de lo necesario.
   ========================================================================== */

(() => {
  "use strict";

  const AUDIO_BASE = "./assets/audio/";

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

  const MUSIC_NAMES = ["music_menu", "music_combat"];
  const ALL_NAMES = [...SFX_NAMES, ...MUSIC_NAMES];

  const MUSIC_START_FADE = 0.25;
  const MUSIC_CROSSFADE = 1.2;

  // Parche suave de visibilidad para móvil/recientes.
  const VISIBILITY_FADE_OUT = 0.18;
  const VISIBILITY_FADE_IN = 0.22;
  const HIDDEN_SUSPEND_DELAY = 500;

  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;

  const rawBuffers = {};
  const audioBuffers = {};
  const loading = {};
  const loaded = {};
  const failed = {};
  const decoding = {};

  let menuGain = null;
  let combatGain = null;
  let menuSource = null;
  let combatSource = null;

  let unlockHandler = null;
  let unlockListenersBound = false;
  let contextRunning = false;
  let musicInitialApplied = false;
  let visibilityBound = false;

  let foreground = 1;
  let hiddenTimeout = null;

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

  function ignorePromise(p) {
    if (p && typeof p.then === "function") {
      p.then(undefined, () => {});
    }
  }

  /* ==================== MEZCLA ==================== */

  function applyMixValues(fade) {
    if (!ctx || !masterGain || !musicGain || !sfxGain) return;

    const t = ctx.currentTime;
    const d = Number.isFinite(fade) && fade > 0 ? fade : 0.05;

    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.linearRampToValueAtTime(
      mix.muted ? 0 : foreground,
      t + d
    );

    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t);
    musicGain.gain.linearRampToValueAtTime(
      clamp01(mix.music) * 0.9,
      t + d
    );

    sfxGain.gain.cancelScheduledValues(t);
    sfxGain.gain.setValueAtTime(sfxGain.gain.value, t);
    sfxGain.gain.linearRampToValueAtTime(
      clamp01(mix.sfx) * 0.9,
      t + d
    );
  }

  /* ==================== CONTEXTO ==================== */

  function createAudioContext() {
    if (ctx || !supportedAudioContext()) return ctx;

    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();

    masterGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();

    masterGain.connect(ctx.destination);
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);

    applyMixValues(0.01);
    return ctx;
  }

  function markContextRunning() {
    if (contextRunning) {
      applyIntensity(MUSIC_CROSSFADE);
      return;
    }

    contextRunning = true;
    removeUnlockListeners();
    decodeAllLoaded();
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

        if (ctx) decodeName(name);
      })
      .catch((error) => {
        failed[name] = true;
        loading[name] = false;
        console.warn("AudioFX: no se pudo descargar", url, error);
      });
  }

  /* ==================== DECODIFICACIÓN ==================== */

  function onDecoded(name) {
    if (String(name).indexOf("music_") === 0 && contextRunning) {
      applyIntensity(
        musicInitialApplied ? MUSIC_CROSSFADE : MUSIC_START_FADE
      );
      musicInitialApplied = true;
    }
  }

  function decodeName(name) {
    if (!ctx) return;
    if (!loaded[name] || failed[name] || decoding[name] || audioBuffers[name]) return;

    const arrayBuffer = rawBuffers[name];
    if (!arrayBuffer) return;

    decoding[name] = true;

    const onSuccess = (audioBuffer) => {
      if (!decoding[name]) return;
      decoding[name] = false;
      audioBuffers[name] = audioBuffer;
      delete rawBuffers[name];
      onDecoded(name);
    };

    const onError = (error) => {
      if (!decoding[name]) return;
      decoding[name] = false;
      failed[name] = true;
      delete rawBuffers[name];
      console.warn("AudioFX: no se pudo decodificar", name, error);
      onDecoded(name);
    };

    try {
      // slice(0) evita problemas si el ArrayBuffer queda transferido/detached.
      const promise = ctx.decodeAudioData(arrayBuffer.slice(0), onSuccess, onError);

      if (promise && typeof promise.then === "function") {
        promise
          .then((audioBuffer) => {
            if (!audioBuffers[name] && !failed[name]) {
              onSuccess(audioBuffer);
            }
          })
          .catch((error) => {
            if (!failed[name]) {
              onError(error);
            }
          });
      }
    } catch (error) {
      onError(error);
    }
  }

  function decodeAllLoaded() {
    ALL_NAMES.forEach(decodeName);
  }

  /* ==================== MÚSICA ==================== */

  function ensureMusicGains() {
    if (!ctx || !musicGain) return false;

    if (!menuGain) {
      menuGain = ctx.createGain();
      menuGain.gain.value = 0;
      menuGain.connect(musicGain);
    }

    if (!combatGain) {
      combatGain = ctx.createGain();
      combatGain.gain.value = 0;
      combatGain.connect(musicGain);
    }

    return true;
  }

  function startMusicSource(name) {
    if (!ensureMusicGains()) return null;

    const isMenu = name === "menu";
    let source = isMenu ? menuSource : combatSource;
    if (source) return source;

    const bufferName = "music_" + name;
    const buffer = audioBuffers[bufferName];
    if (!buffer) return null;

    const gain = isMenu ? menuGain : combatGain;

    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);

    const t = ctx.currentTime;

    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0, t);

    source.start(t);

    if (isMenu) {
      menuSource = source;
    } else {
      combatSource = source;
    }

    return source;
  }

  function setMusicTarget(name, target, fade) {
    if (!ctx || !contextRunning || ctx.state !== "running") return;

    const bufferName = "music_" + name;
    const clamped = clamp01(target);

    if (clamped > 0.001 && !audioBuffers[bufferName]) {
      console.warn("AudioFX: pista de música no disponible:", bufferName);
      return;
    }

    if (!ensureMusicGains()) return;

    const gain = name === "menu" ? menuGain : combatGain;
    if (!gain) return;

    if (clamped > 0.001) {
      startMusicSource(name);
    }

    const t = ctx.currentTime;
    const current = gain.gain.value;
    const duration = Math.max(0.05, Number(fade) || MUSIC_CROSSFADE);

    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(current, t);
    gain.gain.linearRampToValueAtTime(clamped, t + duration);
  }

  function applyIntensity(fade) {
    if (!ctx || !contextRunning || ctx.state !== "running") return;

    const target = mix.intensity === "combat" ? "combat" : "menu";
    const other = target === "combat" ? "menu" : "combat";

    setMusicTarget(target, 1, fade);
    setMusicTarget(other, 0, fade);
  }

  /* ==================== SFX ==================== */

  function play(name) {
    if (!ctx || ctx.state !== "running" || mix.muted) return;
    if (document.hidden || foreground < 0.01) return;

    const buffer = audioBuffers[name];

    if (!buffer) {
      if (loaded[name] && !failed[name] && !decoding[name]) {
        decodeName(name);
      }
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(sfxGain);
    source.start(ctx.currentTime);
  }

  /* ==================== DESBLOQUEO POR GESTO ==================== */

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

    let resumePromise = null;

    try {
      resumePromise = ctx.resume();
    } catch (error) {
      // Algunos navegadores pueden lanzar error si no hay activación válida.
    }

    if (resumePromise && typeof resumePromise.then === "function") {
      resumePromise
        .then(() => {
          if (ctx && ctx.state === "running") {
            markContextRunning();
          }
        })
        .catch(() => {
          // No quitamos listeners: seguiremos reintentando en próximos gestos.
        });
    }

    if (ctx.state === "running") {
      markContextRunning();
    }
  }

  function bindUnlockListeners() {
    if (unlockListenersBound || contextRunning) return;

    unlockHandler = handleUnlockGesture;

    const passiveOptions = { passive: true };

    window.addEventListener("pointerdown", unlockHandler, passiveOptions);
    window.addEventListener("touchend", unlockHandler, passiveOptions);
    window.addEventListener("click", unlockHandler, passiveOptions);
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
    } catch (error) {
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
      if (contextRunning) {
        applyIntensity(0.25);
      }
    };

    if (!contextRunning && ctx.state === "running") {
      markContextRunning();
    }

    if (ctx.state === "suspended") {
      let resumePromise = null;

      try {
        resumePromise = ctx.resume();
      } catch (error) {
        resumePromise = null;
      }

      if (resumePromise && typeof resumePromise.then === "function") {
        resumePromise
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
      applyIntensity(MUSIC_CROSSFADE);
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

    if (ctx.state === "suspended" && !mix.muted && !document.hidden) {
      let resumePromise = null;

      try {
        resumePromise = ctx.resume();
      } catch (error) {
        resumePromise = null;
      }

      if (resumePromise && typeof resumePromise.then === "function") {
        resumePromise
          .then(() => {
            if (ctx && ctx.state === "running") {
              if (!contextRunning) {
                markContextRunning();
              } else {
                foreground = 1;
                applyMixValues(VISIBILITY_FADE_IN);
                applyIntensity(0.25);
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
          applyIntensity(0.25);
        }
      }
    }
  }

  function init() {
    if (!supportedAudioContext()) return;

    bindUnlockListeners();
    bindVisibility();

    ALL_NAMES.forEach(fetchRaw);
  }

  window.AudioFX = {
    init,
    unlock,
    play,
    setIntensity,
    applySettings
  };
})();
