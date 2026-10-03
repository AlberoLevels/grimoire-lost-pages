/* ==========================================================================
   GRIMOIRE: LOST PAGES — Motor de audio (G1 reescrito + corrección móvil)
   SFX y música mediante Web Audio API con MP3 reales desde assets/audio/.
   Expone window.AudioFX. No depende de game.js.

   Corrección clave:
   - No se crea AudioContext hasta el primer gesto del usuario.
   - Los listeners de desbloqueo se mantienen hasta que ctx.state === "running".
   - Se reintenta en pointerdown/touchend/click/keydown.
   - Los MP3 se descargan como ArrayBuffer antes del gesto, pero se decodifican
     solo cuando el contexto de audio existe y se desbloquea.
   - El slider de volumen no es responsable de desbloquear el audio.
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

  function applyMixValues() {
    if (!ctx || !masterGain || !musicGain || !sfxGain) return;

    const t = ctx.currentTime;

    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.linearRampToValueAtTime(mix.muted ? 0 : 1, t + 0.05);

    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.linearRampToValueAtTime(clamp01(mix.music) * 0.9, t + 0.05);

    sfxGain.gain.cancelScheduledValues(t);
    sfxGain.gain.linearRampToValueAtTime(clamp01(mix.sfx) * 0.9, t + 0.05);
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

    applyMixValues();
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
      applyIntensity(musicInitialApplied ? MUSIC_CROSSFADE : MUSIC_START_FADE);
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
      if (decoding[name] === false) return;
      decoding[name] = false;
      audioBuffers[name] = audioBuffer;
      delete rawBuffers[name];
      onDecoded(name);
    };

    const onError = (error) => {
      decoding[name] = false;
      failed[name] = true;
      console.warn("AudioFX: no se pudo decodificar", name, error);
    };

    try {
      // slice(0) evita problemas si el ArrayBuffer queda transferido/detached.
      const promise = ctx.decodeAudioData(arrayBuffer.slice(0), onSuccess, onError);

      if (promise && typeof promise.then === "function") {
        promise.then((audioBuffer) => {
          if (!audioBuffers[name] && !failed[name]) onSuccess(audioBuffer);
        }).catch((error) => {
          if (!failed[name]) onError(error);
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
      menuGain.connect(musicGain);
    }

    if (!combatGain) {
      combatGain = ctx.createGain();
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

    // Arranca en silencio para evitar click inicial.
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

    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(current, t);
    gain.gain.linearRampToValueAtTime(
      clamped,
      t + Math.max(0.05, Number(fade) || MUSIC_CROSSFADE)
    );
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

    const buffer = audioBuffers[name];

    if (!buffer) {
      // Si ya está descargado pero aún no decodificado, intenta decodificar.
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

    // En algunos navegadores el estado cambia de forma síncrona.
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

    applyMixValues();

    if (ctx.state === "suspended" && !mix.muted) {
      let resumePromise = null;

      try {
        resumePromise = ctx.resume();
      } catch (error) {
        // Silencioso.
      }

      if (resumePromise && typeof resumePromise.then === "function") {
        resumePromise
          .then(() => {
            if (ctx && ctx.state === "running") {
              markContextRunning();
            }
          })
          .catch(() => {
            bindUnlockListeners();
          });
      } else if (ctx.state === "running") {
        markContextRunning();
      }
    } else if (ctx.state === "running" && !contextRunning) {
      markContextRunning();
    }
  }

  function init() {
    // IMPORTANTE: no creamos AudioContext aquí.
    bindUnlockListeners();

    // Precargamos los MP3 como ArrayBuffer. Esto no requiere AudioContext.
    ALL_NAMES.forEach(fetchRaw);

    if (!visibilityBound) {
      visibilityBound = true;

      document.addEventListener("visibilitychange", () => {
        if (!ctx) return;

        if (document.hidden) {
          try {
            ctx.suspend();
          } catch (error) {
            // Silencioso.
          }
          return;
        }

        if (mix.muted) return;

        let resumePromise = null;

        try {
          resumePromise = ctx.resume();
        } catch (error) {
          // Silencioso.
        }

        if (resumePromise && typeof resumePromise.then === "function") {
          resumePromise
            .then(() => {
              if (ctx && ctx.state === "running") {
                markContextRunning();
              } else {
                bindUnlockListeners();
              }
            })
            .catch(() => {
              bindUnlockListeners();
            });
        } else if (ctx.state === "running") {
          markContextRunning();
        } else {
          bindUnlockListeners();
        }
      });
    }
  }

  window.AudioFX = {
    init,
    unlock,
    play,
    setIntensity,
    applySettings
  };
})();
