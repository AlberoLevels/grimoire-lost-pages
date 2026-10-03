// --- CATÁLOGO DE PÁGINAS (motor de efectos modulares) ---
// Cada carta = id, name, type (marco visual), cost, desc (sabor),
// effects (lista de acciones) y keywords opcionales (exhaust/retain/innate).
const CARDS = {
  // Pilares renombrados a coherencia grimorio
  tajo_pluma: {
    id: 'tajo_pluma', name: 'Tajo de Pluma', type: 'attack', cost: 1,
    desc: 'Un trazo veloz que corta como hoja.',
    effects: [{ type: 'damage', value: 6 }]
  },
  velo_pergamino: {
    id: 'velo_pergamino', name: 'Velo de Pergamino', type: 'skill', cost: 1,
    desc: 'Alzas una lámina sagrada que desvía el golpe.',
    effects: [{ type: 'block', value: 5 }]
  },
  brasa_hereje: {
    id: 'brasa_hereje', name: 'Brasa Hereje', type: 'power', cost: 2,
    desc: 'Enciendes una hoguera profana que arde turno tras turno.',
    effects: [{ type: 'burn_enemy', value: 3 }]
  },
  icor_sagrado: {
    id: 'icor_sagrado', name: 'Icor Sagrado', type: 'skill', cost: 0,
    desc: 'Bebes la savia del libro; tu carne se recompone.',
    effects: [{ type: 'heal', value: 5 }]
  },

  // Aggro
  garra_tinta: {
    id: 'garra_tinta', name: 'Garra de Tinta', type: 'attack', cost: 1,
    desc: 'Desgarra con uñas de tinta viva.',
    effects: [{ type: 'damage', value: 4 }]
  },
  espina_margen: {
    id: 'espina_margen', name: 'Espina del Margen', type: 'attack', cost: 0,
    desc: 'Clava una espina en el enemigo; te araña a ti también.',
    effects: [{ type: 'damage', value: 3 }, { type: 'self_damage', value: 2 }]
  },
  rafaga_calamo: {
    id: 'rafaga_calamo', name: 'Ráfaga de Cálamo', type: 'attack', cost: 1,
    desc: 'Dos trazos rápidos que sangran.',
    effects: [{ type: 'damage', value: 3, hits: 2 }]
  },
  colmillo_hereje: {
    id: 'colmillo_hereje', name: 'Colmillo Hereje', type: 'attack', cost: 1,
    desc: 'Muerde y deja veneno arcano.',
    effects: [{ type: 'damage', value: 4 }, { type: 'burn_enemy', value: 1 }]
  },
  juramento_roto: {
    id: 'juramento_roto', name: 'Juramento Roto', type: 'attack', cost: 2,
    desc: 'Un pacto sellado con sangre; se consume al lanzarse.',
    effects: [{ type: 'damage', value: 9 }],
    exhaust: true
  },

  // Control / Sustain
  ojo_retine: {
    id: 'ojo_retine', name: 'Ojo que Retiene', type: 'skill', cost: 1,
    desc: 'Vigila y protege; permanece en tu mano al cerrar el ritual.',
    effects: [{ type: 'block', value: 4 }],
    retain: true
  },
  voto_ceniza: {
    id: 'voto_ceniza', name: 'Voto de Ceniza', type: 'skill', cost: 2,
    desc: 'Un juramento de restos que aguanta el golpe.',
    effects: [{ type: 'block', value: 8 }],
    retain: true
  },
  salmo_medula: {
    id: 'salmo_medula', name: 'Salmo de Médula', type: 'skill', cost: 1,
    desc: 'Reza sobre tus huesos; la página arde al terminar.',
    effects: [{ type: 'heal', value: 4 }],
    exhaust: true
  },
  anotacion_margen: {
    id: 'anotacion_margen', name: 'Anotación al Margen', type: 'skill', cost: 0,
    desc: 'Rasga una nota suelta y roba dos páginas.',
    effects: [{ type: 'draw', value: 2 }],
    innate: true
  },
  tinta_renovada: {
    id: 'tinta_renovada', name: 'Tinta Renovada', type: 'skill', cost: 0,
    desc: 'Chupa tinta del propio libro; ganas un punto y la página se agota.',
    effects: [{ type: 'energy', value: 1 }],
    exhaust: true
  },

  // Burst / Poder
  marca_estigma: {
    id: 'marca_estigma', name: 'Marca del Estigma', type: 'power', cost: 1,
    desc: 'Grabas un signo que arde turno tras turno.',
    effects: [{ type: 'burn_enemy', value: 2 }]
  },
  letania_espinas: {
    id: 'letania_espinas', name: 'Letanía de Espinas', type: 'power', cost: 2,
    desc: 'Un canto repetitivo que se clava; permanece para acumular.',
    effects: [{ type: 'burn_enemy', value: 2 }],
    retain: true
  },
  eco_abismo: {
    id: 'eco_abismo', name: 'Eco del Abismo', type: 'power', cost: 2,
    desc: 'Devuelve el golpe como un eco que sigue quemando.',
    effects: [{ type: 'damage', value: 4 }, { type: 'burn_enemy', value: 2 }]
  },
  caliz_negro: {
    id: 'caliz_negro', name: 'Cáliz Negro', type: 'power', cost: 1,
    desc: 'Bebe del cáliz; curas ahora, ardes después.',
    effects: [{ type: 'heal', value: 3 }, { type: 'burn_player', value: 2 }]
  },
  requiem_final: {
    id: 'requiem_final', name: 'Réquiem Final', type: 'attack', cost: 3,
    desc: 'El último canto; sella el destino de una página y se consume.',
    effects: [{ type: 'damage', value: 12 }],
    exhaust: true
  }
};

// --- ENEMIGOS CON PATRONES CÍCLICOS (recalibrados para el pool ampliado) ---
const ENEMIES = [
  {
    id: 'goblin', name: 'Goblin Asesino', hp: 28, maxHp: 28, attackDmg: 5,
    moves: [
      { kind: 'attack', value: 5, label: 'Ataque' },
      { kind: 'attack', value: 5, label: 'Ataque' },
      { kind: 'block', value: 4, label: 'Bloqueo' }
    ]
  },
  {
    id: 'dragon', name: 'Dragón Joven', hp: 60, maxHp: 60, attackDmg: 8,
    moves: [
      { kind: 'attack', value: 8, label: 'Ataque' },
      { kind: 'attack', value: 12, label: 'Golpe fuerte' },
      { kind: 'block', value: 6, label: 'Bloqueo' },
      { kind: 'burn', value: 3, label: 'Quemadura' }
    ]
  }
];

// G0.6: tope de mano (estándar del género). Exceso va a cenizas, no a limbo.
const HAND_MAX = 10;

// Versión del formato de guardado.
// v3: cartas con effects/keywords, limboPile (exhaust), mazo inicial nuevo.
const SAVE_VERSION = 3;

function getEnemyMoves(enemyId) {
  const template = ENEMIES.find((enemy) => enemy.id === enemyId);
  if (template && Array.isArray(template.moves) && template.moves.length > 0) {
    return template.moves;
  }
  return [{ kind: 'attack', value: 5, label: 'Ataque' }];
}

// Copia profunda de una carta (los effects son arrays; evitamos aliasing con el catálogo).
function cloneCard(card) {
  const copy = { ...card };
  if (Array.isArray(card.effects)) {
    copy.effects = card.effects.map((e) => ({ ...e }));
  }
  return copy;
}

// --- CLASE ESTADO DEL JUEGO ---
class GameState {
  constructor() {
    this.playerHp = 80;
    this.maxPlayerHp = 80;
    this.energy = 3;
    this.maxEnergy = 3;
    this.drawPile = [];
    this.hand = [];
    this.discardPile = [];
    this.limboPile = []; // exhaust: páginas consumidas que nunca vuelven
    this.enemy = null;
    this.turnCount = 0;

    this.enemyBurnStacks = 0;
    this.playerBurn = 0;
    this.playerBlock = 0;

    this.init();
  }

  init() {
    console.log("LOGIC RPG: Iniciando...");

    // Mazo inicial (mezcla jugable de los tres arquetipos).
    for (let i = 0; i < 3; i++) this.addCard('garra_tinta');
    for (let i = 0; i < 2; i++) this.addCard('ojo_retine');
    this.addCard('salmo_medula');
    this.addCard('anotacion_margen');
    this.addCard('tinta_renovada');
    this.addCard('marca_estigma');
    this.addCard('colmillo_hereje');
    this.addCard('espina_margen');
    this.shuffle();

    // Innate: garantizado en mano al inicio del combate (se coloca al final
    // del drawPile para que el primer robo (pop) lo saque seguro).
    const innate = this.drawPile.filter((c) => c.innate);
    const rest = this.drawPile.filter((c) => !c.innate);
    this.drawPile = [...rest, ...innate];

    const enemyTemplate = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
    this.enemy = {
      id: enemyTemplate.id,
      name: enemyTemplate.name,
      hp: enemyTemplate.hp,
      maxHp: enemyTemplate.maxHp,
      attackDmg: enemyTemplate.attackDmg,
      block: 0,
      intent: null,
      moveIndex: 0
    };

    console.log(`LOGIC RPG: Enemigo ${this.enemy.name} listo.`);
    this.startTurn();
  }

  addCard(cardId) {
    if (CARDS[cardId]) {
      this.drawPile.push(cloneCard(CARDS[cardId]));
    }
  }

  shuffle() {
    for (let i = this.drawPile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
    }
  }

  // Escalado suave: cada 4 turnos sube 1, con tope 3.
  getDifficultyBonus() {
    const turns = Number(this.turnCount) || 0;
    const raw = Math.floor(Math.max(0, turns - 1) / 4);
    return Math.min(3, raw);
  }

  chooseEnemyIntent() {
    if (!this.enemy || this.enemy.hp <= 0) return;
    const moves = getEnemyMoves(this.enemy.id);
    const index = Number(this.enemy.moveIndex) || 0;
    const base = moves[index % moves.length];
    const bonus = this.getDifficultyBonus();

    const intent = {
      kind: base.kind,
      value: Number(base.value) || 0,
      label: base.label || 'Acción'
    };
    if (intent.kind === 'attack' || intent.kind === 'block') intent.value += bonus;
    if (intent.kind === 'burn') intent.value += Math.floor(bonus / 2);

    this.enemy.intent = intent;
    this.enemy.moveIndex = (index + 1) % moves.length;
    console.log(`INTENCIÓN ENEMIGA: ${this.enemy.name} preparará ${intent.label} (${intent.value}). Bonus: ${bonus}.`);
  }

  dealDamageToEnemy(rawDamage) {
    if (!this.enemy) return 0;
    let dmg = Math.max(0, Number(rawDamage) || 0);
    if (this.enemy.block > 0) {
      if (this.enemy.block >= dmg) { this.enemy.block -= dmg; dmg = 0; }
      else { dmg -= this.enemy.block; this.enemy.block = 0; }
    }
    if (dmg > 0) this.enemy.hp -= dmg;
    return dmg;
  }

  dealDamageToPlayer(rawDamage) {
    let dmg = Math.max(0, Number(rawDamage) || 0);
    if (this.playerBlock > 0) {
      if (this.playerBlock >= dmg) { this.playerBlock -= dmg; dmg = 0; }
      else { dmg -= this.playerBlock; this.playerBlock = 0; }
    }
    if (dmg > 0) this.playerHp -= dmg;
    return dmg;
  }

  executeEnemyIntent() {
    if (!this.enemy || this.enemy.hp <= 0) return;
    this.enemy.block = 0; // el bloqueo enemigo caduca al actuar
    const intent = this.enemy.intent;
    if (!intent) {
      const fallback = (Number(this.enemy.attackDmg) || 5) + this.getDifficultyBonus();
      this.dealDamageToPlayer(fallback);
      return;
    }
    if (intent.kind === 'attack') {
      this.dealDamageToPlayer(intent.value);
    } else if (intent.kind === 'block') {
      this.enemy.block = Math.max(0, Number(intent.value) || 0);
    } else if (intent.kind === 'burn') {
      this.playerBurn = (this.playerBurn || 0) + Math.max(0, Number(intent.value) || 0);
    }
    this.enemy.intent = null;
  }

  startTurn() {
    this.turnCount++;
    this.energy = this.maxEnergy;
    this.playerBlock = 0;

    // Quemadura del jugador.
    if ((this.playerBurn || 0) > 0) {
      const burnDamage = this.playerBurn;
      this.playerHp -= burnDamage;
      this.playerBurn = Math.max(0, this.playerBurn - 1);
      console.log(`QUEMADURA JUGADOR: -${burnDamage}. Vida: ${this.playerHp}.`);
      if (this.playerHp <= 0) return;
    }

    // Quemadura del enemigo.
    if (this.enemyBurnStacks > 0) {
      this.enemy.hp -= this.enemyBurnStacks;
      this.enemyBurnStacks--;
      console.log(`QUEMADURA ENEMIGA: -${this.enemyBurnStacks + 1}. Vida enemiga: ${this.enemy.hp}.`);
      if (this.enemy.hp <= 0) return;
    }

    this.drawCards(5);
    this.chooseEnemyIntent();
    console.log(`LOGIC RPG: Turno ${this.turnCount}. Mano: ${this.hand.length}.`);
  }

  // G0.6: robos con tope de mano. El exceso va a cenizas (discardPile), no a limbo.
  // Devuelve cuántas cartas se perdieron por tener la mano llena.
  drawCards(amount) {
    let lost = 0;
    for (let i = 0; i < amount; i++) {
      // G0.6: si la mano ya está al tope, el exceso va directo a cenizas.
      if (this.hand.length >= HAND_MAX) {
        if (this.drawPile.length === 0) {
          if (this.discardPile.length === 0) break;
          this.drawPile = this.discardPile.map((c) => c);
          this.discardPile = [];
          this.shuffle();
          const innate = this.drawPile.filter((c) => c.innate);
          const rest = this.drawPile.filter((c) => !c.innate);
          this.drawPile = [...rest, ...innate];
        }
        const card = this.drawPile.pop();
        if (card) {
          this.discardPile.push(card);
          lost++;
        }
        continue;
      }

      // Robo normal: hay sitio en mano.
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        this.drawPile = this.discardPile.map((c) => c);
        this.discardPile = [];
        this.shuffle();
        // Re-coloco innate al final por si acaso (defensivo).
        const innate = this.drawPile.filter((c) => c.innate);
        const rest = this.drawPile.filter((c) => !c.innate);
        this.drawPile = [...rest, ...innate];
      }
      const card = this.drawPile.pop();
      if (card) this.hand.push(card);
    }
    return lost;
  }

  playCard(index) {
    if (index < 0 || index >= this.hand.length) return false;
    const card = this.hand[index];
    const cost = Number(card.cost) || 0;
    if (this.energy < cost) {
      console.warn("LOGIC RPG: Sin energía.");
      return false;
    }
    this.energy -= cost;

    const effects = Array.isArray(card.effects) ? card.effects : [];
    for (const e of effects) {
      const v = Number(e.value) || 0;
      switch (e.type) {
        case 'damage': {
          const hits = Math.max(1, Number(e.hits) || 1);
          for (let i = 0; i < hits; i++) this.dealDamageToEnemy(v);
          break;
        }
        case 'self_damage': this.playerHp -= v; break;
        case 'block': this.playerBlock = (this.playerBlock || 0) + v; break;
        case 'heal': this.playerHp = Math.min(this.maxPlayerHp, this.playerHp + v); break;
        case 'burn_enemy': this.enemyBurnStacks += v; break;
        case 'burn_player': this.playerBurn = (this.playerBurn || 0) + v; break;
        case 'draw': this.drawCards(v); break;
        case 'energy': this.energy = Math.max(0, this.energy + v); break;
      }
    }

    this.hand.splice(index, 1);
    if (card.exhaust) this.limboPile.push(card);
    else this.discardPile.push(card);

    return true;
  }

  endTurn() {
    console.log("LOGIC RPG: Fin de turno jugador.");
    if (this.enemy && this.enemy.hp > 0) {
      this.executeEnemyIntent();
      if (this.playerHp <= 0) return;
    }
    this.discardHand();
    this.startTurn();
  }

  discardHand() {
    const keep = [];
    const discard = [];
    for (const card of this.hand) {
      if (card.retain) keep.push(card);
      else discard.push(card);
    }
    this.discardPile.push(...discard);
    this.hand = keep;
  }

  getStatus() {
    return {
      hp: this.playerHp,
      energy: this.energy,
      handSize: this.hand.length,
      enemyHp: this.enemy ? this.enemy.hp : 0
    };
  }

  /* ==================== AUTOGUARDADO (A.2 + C) ==================== */
  serialize() {
    return {
      version: SAVE_VERSION,
      playerHp: this.playerHp,
      maxPlayerHp: this.maxPlayerHp,
      energy: this.energy,
      maxEnergy: this.maxEnergy,
      drawPile: this.drawPile.map((c) => cloneCard(c)),
      hand: this.hand.map((c) => cloneCard(c)),
      discardPile: this.discardPile.map((c) => cloneCard(c)),
      limboPile: this.limboPile.map((c) => cloneCard(c)),
      enemy: this.enemy
        ? {
            id: this.enemy.id,
            name: this.enemy.name,
            hp: this.enemy.hp,
            maxHp: this.enemy.maxHp,
            attackDmg: this.enemy.attackDmg,
            block: this.enemy.block || 0,
            intent: this.enemy.intent ? { ...this.enemy.intent } : null,
            moveIndex: this.enemy.moveIndex || 0
          }
        : null,
      turnCount: this.turnCount,
      enemyBurnStacks: this.enemyBurnStacks,
      playerBurn: this.playerBurn || 0,
      playerBlock: this.playerBlock || 0
    };
  }

  static fromSave(data) {
    if (!data || typeof data !== "object") return null;
    if (data.version !== SAVE_VERSION) return null;

    const s = Object.create(GameState.prototype);
    s.playerHp = Number(data.playerHp) || 0;
    s.maxPlayerHp = Number(data.maxPlayerHp) || s.playerHp;
    s.energy = Number(data.energy) || 0;
    s.maxEnergy = Number(data.maxEnergy) || s.energy;
    s.drawPile = Array.isArray(data.drawPile) ? data.drawPile.map((c) => cloneCard(c)) : [];
    s.hand = Array.isArray(data.hand) ? data.hand.map((c) => cloneCard(c)) : [];
    s.discardPile = Array.isArray(data.discardPile) ? data.discardPile.map((c) => cloneCard(c)) : [];
    s.limboPile = Array.isArray(data.limboPile) ? data.limboPile.map((c) => cloneCard(c)) : [];
    s.turnCount = Number(data.turnCount) || 0;
    s.enemyBurnStacks = Number(data.enemyBurnStacks) || 0;
    s.playerBurn = Number(data.playerBurn) || 0;
    s.playerBlock = Number(data.playerBlock) || 0;

    if (data.enemy && typeof data.enemy === "object") {
      const template = ENEMIES.find((e) => e.id === data.enemy.id);
      s.enemy = {
        id: data.enemy.id || (template ? template.id : "unknown"),
        name: data.enemy.name || (template ? template.name : "Amenaza"),
        hp: Number(data.enemy.hp) || 0,
        maxHp: Number(data.enemy.maxHp) || Number(data.enemy.hp) || 0,
        attackDmg: Number(data.enemy.attackDmg) || (template ? template.attackDmg : 5),
        block: Number(data.enemy.block) || 0,
        intent: data.enemy.intent && typeof data.enemy.intent === "object" ? { ...data.enemy.intent } : null,
        moveIndex: Number(data.enemy.moveIndex) || 0
      };
      if (s.enemy.hp > 0 && !s.enemy.intent) s.chooseEnemyIntent();
    } else {
      s.enemy = null;
    }
    return s;
  }
}
