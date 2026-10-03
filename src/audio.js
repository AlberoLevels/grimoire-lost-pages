/* ==========================================================================
   GRIMOIRE: LOST PAGES — Motor de audio (G1 reescrito)
   Reproduce archivos reales (MP3) desde assets/audio/. Cero síntesis.
   Expone window.AudioFX. No depende de game.js (capa de presentación pura).
   Reglas: desbloqueo por gesto, pausa en segundo plano, volúmenes externos.
   Música: crossfade entre music_menu y music_combat según intensidad.
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

  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  const buffers = {};

  // Nodos de música (dos fuentes en loop permanente, crossfade por gain).
  let musicMenuSource = null;
  let musicCombatSource = null;
  let musicMenuGainNode = null;
  let musicCombatGainNode = null;
  let musicStarted = false;
  let unlocked = false;

  // Estado de mezcla (lo fija game.js desde los ajustes persistidos).
  const mix = { music: 0.7, sfx: 0.9, muted: false, intensity: "menu" };

  function supported() {
    return typeof window !== "undefined" &&
      (window.AudioContext || window.webkitAudioContext);
  }

  /* ==================== CARGA DE BUFFERS ==================== */

  async function loadBuffer(name) {
    const url = AUDIO_BASE + name + ".mp3";
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const arrayBuffer = await response.arrayBuffer();
      // decodeAudioData con callback envuelto en promesa (máxima compatibilidad).
      const audioBuffer = await new Promise((resolve, reject) => {
        ctx.decodeAudioData(arrayBuffer, resolve, reject);
      });
      buffers[name] = audioBuffer;
    } catch (e) {
      // Si un archivo falla, el juego sigue funcionando sin ese sonido.
      console.warn("AudioFX: no se pudo cargar", url, e);
    }
  }

  /* ==================== CONTEXTO Y GAINS ==================== */

  function ensureContext() {
    if (ctx || !supported()) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    applyMix();
    return ctx;
  }

  /* ==================== MÚSICA: CROSSFADE MENÚ ↔ COMBATE ==================== */

  function startMusicNodes() {
    if (musicStarted || !ctx) return;
    if (!buffers.music_menu || !buffers.music_combat) return;

    musicMenuGainNode = ctx.createGain();
    musicCombatGainNode = ctx.createGain();
    musicMenuGainNode.connect(musicGain);
    musicCombatGainNode.connect(musicGain);

    musicMenuSource = ctx.createBufferSource();
    musicMenuSource.buffer = buffers.music_menu;
    musicMenuSource.loop = true;
    musicMenuSource.connect(musicMenuGainNode);

    musicCombatSource = ctx.createBufferSource();
    musicCombatSource.buffer = buffers.music_combat;
    musicCombatSource.loop = true;
    musicCombatSource.connect(musicCombatGainNode);

    // Estado inicial según la intensidad actual.
    const t = ctx.currentTime;
    if (mix.intensity === "combat") {
      musicMenuGainNode.gain.setValueAtTime(0, t);
      musicCombatGainNode.gain.setValueAtTime(1, t);
    } else {
      musicMenuGainNode.gain.setValueAtTime(1, t);
      musicCombatGainNode.gain.setValueAtTime(0, t);
    }

    musicMenuSource.start(0);
    musicCombatSource.start(0);
    musicStarted = true;
  }

  function setIntensity(mode) {
    mix.intensity = mode === "combat" ? "combat" : "menu";
    if (!ctx || ctx.state !== "running" || !musicStarted) return;
    if (!musicMenuGainNode || !musicCombatGainNode) return;
    const t = ctx.currentTime;
    const menuTarget = mix.intensity === "menu" ? 1 : 0;
    const combatTarget = mix.intensity === "combat" ? 1 : 0;
    musicMenuGainNode.gain.cancelScheduledValues(t);
    musicCombatGainNode.gain.cancelScheduledValues(t);
    musicMenuGainNode.gain.linearRampToValueAtTime(menuTarget, t + 1.2);
    musicCombatGainNode.gain.linearRampToValueAtTime(combatTarget, t + 1.2);
  }

  /* ==================== SFX ==================== */

  function play(name) {
    if (!ctx || ctx.state !== "running" || mix.muted) return;
    const buffer = buffers[name];
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(sfxGain);
    source.start(0);
  }

  /* ==================== MEZCLA Y CICLO DE VIDA ==================== */

  function applyMix() {
    if (!ctx) return;
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.linearRampToValueAtTime(mix.muted ? 0 : 1, t + 0.05);
    musicGain.gain.cancelScheduledValues(t);
    // Música a 0.9 para que se note bien (Frank pidió presencia fuerte).
    musicGain.gain.linearRampToValueAtTime(mix.music * 0.9, t + 0.05);
    sfxGain.gain.cancelScheduledValues(t);
    sfxGain.gain.linearRampToValueAtTime(mix.sfx * 0.9, t + 0.05);
  }

  async function unlock() {
    unlocked = true;
    const c = ensureContext();
    if (!c) return;
    if (c.state === "suspended") {
      try { await c.resume(); } catch (e) {}
    }
    startMusicNodes();
    setIntensity(mix.intensity);
  }

  async function init() {
    if (!supported()) return;
    ensureContext();

    // Precarga todos los buffers en paralelo (no bloquea el arranque del juego).
    const allNames = [...SFX_NAMES, ...MUSIC_NAMES];
    await Promise.all(allNames.map(loadBuffer));

    // Si el usuario ya hizo el primer gesto antes de terminar la carga,
    // arrancamos la música ahora que los buffers existen.
    if (unlocked) {
      startMusicNodes();
      setIntensity(mix.intensity);
    }

    // Desbloqueo por primer gesto (requisito de todos los navegadores).
    const once = () => {
      unlock();
      window.removeEventListener("pointerdown", once);
      window.removeEventListener("keydown", once);
    };
    window.addEventListener("pointerdown", once, { passive: true });
    window.addEventListener("keydown", once);

    // Pausa total en segundo plano (no sonar sin el jugador delante).
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend();
      else if (!mix.muted) ctx.resume();
    });
  }

  function applySettings(next) {
    if (next && typeof next === "object") {
      if (typeof next.music === "number") mix.music = Math.min(1, Math.max(0, next.music));
      if (typeof next.sfx === "number") mix.sfx = Math.min(1, Math.max(0, next.sfx));
      if (typeof next.muted === "boolean") mix.muted = next.muted;
    }
    applyMix();
    if (ctx && ctx.state === "suspended" && !mix.muted) ctx.resume();
  }

  window.AudioFX = { init, unlock, play, setIntensity, applySettings };
})();