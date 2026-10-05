/* ==========================================================================
   GRIMOIRE: LOST PAGES — Motor de audio (G1 reescrito)
   + Parche G2/G2.1: cola de música pendiente + música antes que SFX + clave
     buffer->lógico en onDecoded (suena al primer toque, sin visibilitychange).
   + CAPA 2 (G2.1): sting narrativo del ritual (ritual_sting), one-shot con
     cola+flush respetando la política de autoplay.
   + FIX BUG INTRO:
     - Durante la intro previa, intensidad por defecto "none": tocar fuera del
       ente desbloquea audio en silencio pero NO arranca música del menú.
     - Sting normalizado a pico objetivo + limiter suave + mini fade inicial
       para reducir bajo volumen, clipping y click/pop de arranque.
   Reversible (capa 2): borra STING_NAMES, stingGain, stingLimiter,
   pendingSting, playSting, flushPendingStings/flushPendingSting,
   stingNormalization, computeAudioPeak, computeStingNormalization,
   getStingDebug y la llamada en game.js.
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

  // CAPA 2: stings narrativos (one-shot, sin loop, sin crossfade).
  const STING_NAMES = ["ritual_sting"];

  const ALL_NAMES = [...SFX_NAMES, ...MUSIC_NAMES, ...STING_NAMES];

  const MUSIC_START_FADE = 0.25;
  const MUSIC_CROSSFADE = 1.2;

  const VISIBILITY_FADE_OUT = 0.18;
  const VISIBILITY_FADE_IN = 0.22;
  const HIDDEN_SUSPEND_DELAY = 500;

  // Sting: nivel base tras normalización. 1.0 = pico objetivo ya ajustado.
  // Si quieres más presencia sin saturar, sube esto a 1.08 / 1.15.
  const STING_LEVEL = 1.0;

  // Pico objetivo del sting: 0.89 ~= -1 dBFS. Deja margen anti-clipping.
  const STING_TARGET_PEAK = 0.89;

  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let stingGain = null;
  let stingLimiter = null;

  const rawBuffers = {};
  const audioBuffers = {};
  const loading = {};
  const loaded = {};
  const failed = {};
  const decoding = {};

  // Normalización por sting: gain aplicado al buffer para alcanzar pico objetivo.
  const stingNormalization = {};

  const pendingMusic = {};   // claves lógicas: "menu" | "combat"
  const pendingSting = {};   // claves = nombre de sting ("ritual_sting")

  let menuGain = null;
  let combatGain = null;
  let menuSource = null;
  let combatSource = null;

  let unlockHandler = null;
  let unlockListenersBound = false;
  let contextRunning = false;
  let visibilityBound = false;

  let foreground = 1;
  let hiddenTimeout = null;

  const mix = {
    music: 0.7,
    sfx: 0.9,
    muted: false,
    // FIX BUG INTRO: por defecto NO arrancar música.
    // showMenu() pondrá "menu"; showCombat() pondrá "combat".
    intensity: "none"
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

  /* ==================== ANÁLISIS DE STING ==================== */

  function computeAudioPeak(buffer) {
    if (!buffer || typeof buffer.getChannelData !== "function") return 0;

    let peak = 0;
    const channels = buffer.numberOfChannels || 1;

    for (let ch = 0; ch < channels; ch++) {
      let data;
      try {
        data = buffer.getChannelData(ch);
      } catch (e) {
        continue;
      }

      if (!data || !data.length) continue;

      for (let i = 0; i < data.length; i++) {
        const v = data[i] < 0 ? -data[i] : data[i];
        if (v > peak) peak = v;
      }
    }

    return peak;
  }

  function computeStingNormalization(buffer) {
    const peak = computeAudioPeak(buffer);

    // Si el buffer está prácticamente mudo, no lo explosivamos.
    if (!Number.isFinite(peak) || peak < 0.001) return 1;

    const gain = STING_TARGET_PEAK / peak;

    // Límites sensatos: no bajar más de 0.25x ni subir más de 4x.
    return Math.min(4, Math.max(0.25, gain));
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

    applyIntensity(MUSIC_START_FADE);
    decodeAllLoaded();

    // CAPA 2: al pasar a running, soltamos los stings que estaban en cola
    // (cuyos buffers ya estuvieran decodificados antes de este momento).
    flushPendingStings();
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

        // CAPA 2: los stings son opcionales (plug-and-play). Si aún no existe
        // el MP3, no ensuciamos la consola: falla en silencio y sin warn.
        if (STING_NAMES.indexOf(name) === -1) {
          console.warn("AudioFX: no se pudo descargar", url, error);
        }
      });
  }

  /* ==================== DECODIFICACIÓN ==================== */

  function flushPendingMusic(name) {
    const pending = pendingMusic[name];
    if (!pending) return;

    delete pendingMusic[name];
    setMusicTarget(name, pending.target, pending.fade);
  }

  // CAPA 2: soltar un sting concreto si estaba en cola.
  function flushPendingSting(name) {
    if (pendingSting[name]) playSting(name);
  }

  // CAPA 2: soltar todos los stings en cola (idempotente: playSting borra la
  // clave solo cuando de verdad reproduce; si aún no puede, la re-encola).
  function flushPendingStings() {
    Object.keys(pendingSting).forEach((k) => playSting(k));
  }

  function onDecoded(name) {
    // Música: traducir buffer -> lógico antes de vaciar la cola.
    if (String(name).indexOf("music_") === 0 && contextRunning) {
      flushPendingMusic(name.slice("music_".length));
    }

    // CAPA 2: si un sting acaba de decodificarse y el contexto ya corre, suéltalo.
    if (STING_NAMES.indexOf(name) !== -1 && contextRunning) {
      flushPendingSting(name);
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

      // CAPA 2: normalizar sting al decodificar.
      if (STING_NAMES.indexOf(name) !== -1) {
        stingNormalization[name] = computeStingNormalization(audioBuffer);
      }

      delete rawBuffers[name];
      onDecoded(name);
    };

    const onError = (error) => {
      if (!decoding[name]) return;
      decoding[name] = false;
      failed[name] = true;
      delete rawBuffers[name];

      if (STING_NAMES.indexOf(name) === -1) {
        console.warn("AudioFX: no se pudo decodificar", name, error);
      }

      onDecoded(name);
    };

    try {
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
    // Música y stings antes que los SFX (bajar latencia de lo narrativo).
    MUSIC_NAMES.forEach(decodeName);
    STING_NAMES.forEach(decodeName);
    SFX_NAMES.forEach(decodeName);
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
    const duration = Math.max(0.05, Number(fade) || MUSIC_CROSSFADE);

    if (clamped > 0.001 && failed[bufferName]) {
      delete pendingMusic[name];
      return;
    }

    if (!ensureMusicGains()) return;

    const gain = name === "menu" ? menuGain : combatGain;
    if (!gain) return;

    if (clamped > 0.001) {
      if (!audioBuffers[bufferName]) {
        pendingMusic[name] = { target: clamped, fade: duration };
        return;
      }

      delete pendingMusic[name];
      startMusicSource(name);
    } else {
      delete pendingMusic[name];
    }

    const t = ctx.currentTime;
    const current = gain.gain.value;

    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(current, t);
    gain.gain.linearRampToValueAtTime(clamped, t + duration);
  }

  function applyIntensity(fade) {
    if (!ctx || !contextRunning || ctx.state !== "running") return;

    // FIX BUG INTRO: "none" apaga/evita música sin impedir sting/SFX.
    if (mix.intensity === "none") {
      setMusicTarget("menu", 0, fade);
      setMusicTarget("combat", 0, fade);
      return;
    }

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

  /* ==================== CAPA 2: STINGS (one-shot narrativo) ==================== */

  function ensureStingGain() {
    if (!ctx || !masterGain) return false;

    if (!stingGain) {
      stingGain = ctx.createGain();
      stingGain.gain.value = 1;

      // Limiter suave solo para el sting: evita petardeo/clipping si el MP3
      // viene caliente, sin reventar el golpe inicial.
      try {
        stingLimiter = ctx.createDynamicsCompressor();
        stingLimiter.threshold.value = -1.0; // dBFS
        stingLimiter.knee.value = 0;
        stingLimiter.ratio.value = 20;
        stingLimiter.attack.value = 0.003;
        stingLimiter.release.value = 0.12;
        stingGain.connect(stingLimiter);
        stingLimiter.connect(masterGain);
      } catch (e) {
        // Si el navegador no soporta bien el compresor, fallback directo.
        stingLimiter = null;
        stingGain.connect(masterGain);
      }
    }

    return true;
  }

  // Reproduce un sting una sola vez. Respeta la política de autoplay: si el
  // contexto aún no corre o el buffer no está, lo ENCOLA (no lo fuerza con
  // start() sobre suspended, que es lo que hacía fallar el sonido antes).
  function playSting(name) {
    if (mix.muted) return;            // silenciado: no suena y no se encola

    if (failed[name]) {
      delete pendingSting[name];      // asset inexistente: limpiar cola
      return;
    }

    if (!ctx || ctx.state !== "running") {
      pendingSting[name] = true;      // se soltará al pasar a running
      return;
    }

    if (!ensureStingGain()) return;

    const buffer = audioBuffers[name];
    if (!buffer) {
      if (loaded[name] && !decoding[name]) decodeName(name);
      pendingSting[name] = true;      // se soltará al decodificar (onDecoded)
      return;
    }

    delete pendingSting[name];

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Ganancia por reproducción: normalización + nivel base.
    const norm = Number(stingNormalization[name]);
    const level = STING_LEVEL * (Number.isFinite(norm) && norm > 0 ? norm : 1);

    // Mini envolvente para evitar click/pop en el arranque del buffer.
    const env = ctx.createGain();
    const now = ctx.currentTime;
    const start = now + 0.02;       // 20 ms por delante: evita glitches al resume()
    const attack = 0.006;           // 6 ms: casi inaudible, mata el click inicial

    env.gain.cancelScheduledValues(now);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(level, start + attack);

    source.connect(env);
    env.connect(stingGain);

    source.start(start);

    source.onended = () => {
      try { source.disconnect(); } catch (e) {}
      try { env.disconnect(); } catch (e) {}
    };
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
    if (mode === "combat") {
      mix.intensity = "combat";
    } else if (mode === "none") {
      mix.intensity = "none";
    } else {
      mix.intensity = "menu";
    }

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
            // Silencioso.
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

  // Debug opcional para el sting: desde consola,
  // AudioFX.getStingDebug("ritual_sting")
  function getStingDebug(name) {
    return {
      name,
      loaded: loaded[name] === true,
      failed: failed[name] === true,
      decoded: !!audioBuffers[name],
      normalization: stingNormalization[name] || null,
      pending: pendingSting[name] === true,
      contextRunning,
      state: ctx ? ctx.state : null,
      intensity: mix.intensity,
      muted: mix.muted
    };
  }

  window.AudioFX = {
    init,
    unlock,
    play,
    playSting,
    setIntensity,
    applySettings,
    getStingDebug
  };
})();
