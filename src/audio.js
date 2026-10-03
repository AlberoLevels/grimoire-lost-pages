/* ==========================================================================
   GRIMOIRE: LOST PAGES — Motor de audio (G1 reescrito + fix arranque móvil)
   Reproduce archivos reales (MP3) desde assets/audio/. Cero síntesis.
   Expone window.AudioFX. No depende de game.js (capa de presentación pura).
   Reglas: desbloqueo por gesto, pausa en segundo plano, volúmenes externos.
   Música: crossfade entre music_menu y music_combat según intensidad.
   G1-fix: calentamiento del AudioContext + retraso + fade-in para evitar
   el crackle de la primera apertura en móvil.
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

  // G1-fix: duración del fade-in de arranque de la música.
  const MUSIC_FADE_IN = 0.4;
  // G1-fix: retraso para que el hilo de audio se estabilice tras el resume.
  const AUDIO_WARMUP_DELAY = 50;

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

  /* ==================== G1-fix: CALENTAMIENTO DEL HILO DE AUDIO ==================== */

  // Reproduce un buffer diminuto de silencio para obligar al hilo de audio
  // del móvil a inicializarse ANTES de que suene la música real.
  function warmUpContext() {
    if (!ctx) return;
    try {
      const silent = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) {
      // Silencioso a propósito: si falla, no pasa nada.
    }
  }

  /* ==================== MÚSICA: ARRANQUE Y CROSSFADE ==================== */

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

    // G1-fix: fade-in de arranque en vez de entrar a volumen pleno de golpe.
    const t = ctx.currentTime;
    musicMenuGainNode.gain.setValueAtTime(0, t);
    musicCombatGainNode.gain.setValueAtTime(0, t);
    if (mix.intensity === "combat") {
      musicCombatGainNode.gain.linearRampToValueAtTime(1, t + MUSIC_FADE_IN);
    } else {
      musicMenuGainNode.gain.linearRampToValueAtTime(1, t + MUSIC_FADE_IN);
    }

    musicMenuSource.start(0);
    musicCombatSource.start(0);
    musicStarted = true;
  }

  // G1-fix: calentamiento + retraso + arranque, en un solo flujo.
  function startMusicFlow() {
    if (musicStarted || !ctx) return;
    if (!buffers.music_menu || !buffers.music_combat) return;
    warmUpContext();
    setTimeout(() => {
      startMusicNodes();
    }, AUDIO_WARMUP_DELAY);
  }

  function setIntensity(mode) {
    mix.intensity = mode === "combat" ? "combat" : "menu";
    if (!ctx || ctx.state !== "running" || !musicStarted) return;
    if (!musicMenuGainNode || !musicCombatGainNode) return;
    const t = ctx.currentTime;
    // Anclar valores actuales para un crossfade suave desde el punto actual.
    const currentMenu = musicMenuGainNode.gain.value;
    const currentCombat = musicCombatGainNode.gain.value;
    musicMenuGainNode.gain.cancelScheduledValues(t);
    musicCombatGainNode.gain.cancelScheduledValues(t);
    musicMenuGainNode.gain.setValueAtTime(currentMenu, t);
    musicCombatGainNode.gain.setValueAtTime(currentCombat, t);
    const menuTarget = mix.intensity === "menu" ? 1 : 0;
    const combatTarget = mix.intensity === "combat" ? 1 : 0;
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
    startMusicFlow();
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
      startMusicFlow();
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
