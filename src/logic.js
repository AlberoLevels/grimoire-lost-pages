// --- BASE DE DATOS RPG CLÁSICO ---
const CARDS = {
  strike: { id: 'strike', name: 'Golpe Espada', type: 'attack', cost: 1, damage: 6, desc: 'Ataque básico con espada.' },
  defend: { id: 'defend', name: 'Escudo Magico', type: 'skill', cost: 1, block: 5, desc: 'Invoca barrera protectora.' },
  fireball: { id: 'fireball', name: 'Bola de Fuego', type: 'power', cost: 2, effect: 'burn', value: 3, desc: 'Quema al enemigo cada turno.' },
  heal: { id: 'heal', name: 'Poción Curativa', type: 'skill', cost: 0, heal: 5, desc: 'Recupera 5 puntos de vida.' }
};

// --- ENEMIGOS CON PATRONES CÍCLICOS ---
// kind: 'attack' | 'block' | 'burn'
// value: daño, bloqueo o stacks de quemadura base.
// label: texto legible para futura UI de intención.
const ENEMIES = [
  {
    id: 'goblin',
    name: 'Goblin Asesino',
    hp: 20,
    maxHp: 20,
    attackDmg: 5,
    moves: [
      { kind: 'attack', value: 5, label: 'Ataque' },
      { kind: 'attack', value: 5, label: 'Ataque' },
      { kind: 'block', value: 4, label: 'Bloqueo' }
    ]
  },
  {
    id: 'dragon',
    name: 'Dragón Joven',
    hp: 45,
    maxHp: 45,
    attackDmg: 8,
    moves: [
      { kind: 'attack', value: 8, label: 'Ataque' },
      { kind: 'attack', value: 12, label: 'Golpe fuerte' },
      { kind: 'block', value: 6, label: 'Bloqueo' },
      { kind: 'burn', value: 3, label: 'Quemadura' }
    ]
  }
];

// Versión del formato de guardado.
// v2 añade intenciones enemigas, bloqueo enemigo y quemadura del jugador.
const SAVE_VERSION = 2;

function getEnemyMoves(enemyId) {
  const template = ENEMIES.find((enemy) => enemy.id === enemyId);
  if (template && Array.isArray(template.moves) && template.moves.length > 0) {
    return template.moves;
  }
  return [{ kind: 'attack', value: 5, label: 'Ataque' }];
}

// --- CLASE ESTADO DEL JUEGO (ADAPTADA A RPG) ---
class GameState {
  constructor() {
    this.playerHp = 80;
    this.maxPlayerHp = 80;
    this.energy = 3;
    this.maxEnergy = 3;
    this.drawPile = [];
    this.hand = [];
    this.discardPile = [];
    this.enemy = null;
    this.turnCount = 0;

    // Efectos persistentes.
    this.enemyBurnStacks = 0;
    this.playerBurn = 0;

    // Bloqueo del jugador (se pierde al empezar cada turno).
    this.playerBlock = 0;

    this.init();
  }

  init() {
    console.log("LOGIC RPG: Iniciando...");

    // Mazo inicial estándar de RPG.
    for (let i = 0; i < 5; i++) this.addCard('strike');
    for (let i = 0; i < 3; i++) this.addCard('defend');
    this.addCard('fireball');
    this.addCard('heal');
    this.shuffle();

    const enemyTemplate = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];

    // Guardamos solo datos serializables del enemigo.
    // Los patrones se leen desde ENEMIES por id, para no inflar el save.
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
      this.drawPile.push({ ...CARDS[cardId] });
    }
  }

  shuffle() {
    for (let i = this.drawPile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
    }
  }

  // Escalado suave: cada 4 turnos sube 1, con tope 3.
  // Objetivo: más difícil conforme avanza, sin volverse injusto de golpe.
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

    if (intent.kind === 'attack' || intent.kind === 'block') {
      intent.value += bonus;
    }

    if (intent.kind === 'burn') {
      intent.value += Math.floor(bonus / 2);
    }

    this.enemy.intent = intent;
    this.enemy.moveIndex = (index + 1) % moves.length;

    console.log(
      `INTENCIÓN ENEMIGA: ${this.enemy.name} preparará ${intent.label} (${intent.value}). Bonus turno: ${bonus}.`
    );
  }

  dealDamageToEnemy(rawDamage) {
    if (!this.enemy) return 0;

    let dmg = Math.max(0, Number(rawDamage) || 0);

    if (this.enemy.block > 0) {
      if (this.enemy.block >= dmg) {
        this.enemy.block -= dmg;
        dmg = 0;
      } else {
        dmg -= this.enemy.block;
        this.enemy.block = 0;
      }
    }

    if (dmg > 0) {
      this.enemy.hp -= dmg;
    }

    return dmg;
  }

  dealDamageToPlayer(rawDamage) {
    let dmg = Math.max(0, Number(rawDamage) || 0);

    if (this.playerBlock > 0) {
      if (this.playerBlock >= dmg) {
        this.playerBlock -= dmg;
        dmg = 0;
      } else {
        dmg -= this.playerBlock;
        this.playerBlock = 0;
      }
    }

    if (dmg > 0) {
      this.playerHp -= dmg;
    }

    return dmg;
  }

  executeEnemyIntent() {
    if (!this.enemy || this.enemy.hp <= 0) return;

    // El bloqueo enemigo caduca al empezar su acción.
    this.enemy.block = 0;

    const intent = this.enemy.intent;

    // Si por lo que fuera no hay intención, fallback básico para no romper el turno.
    if (!intent) {
      const fallbackDamage = (Number(this.enemy.attackDmg) || 5) + this.getDifficultyBonus();
      this.dealDamageToPlayer(fallbackDamage);
      console.log(`FALLBACK ENEMIGO: ${this.enemy.name} ataca por ${fallbackDamage}.`);
      return;
    }

    if (intent.kind === 'attack') {
      const dealt = this.dealDamageToPlayer(intent.value);
      console.log(`ENEMIGO ATACA: ${intent.value}. Daño recibido tras bloqueo: ${dealt}. Vida Jugador: ${this.playerHp}.`);
    } else if (intent.kind === 'block') {
      this.enemy.block = Math.max(0, Number(intent.value) || 0);
      console.log(`ENEMIGO BLOQUEA: ${this.enemy.block}.`);
    } else if (intent.kind === 'burn') {
      const stacks = Math.max(0, Number(intent.value) || 0);
      this.playerBurn = (this.playerBurn || 0) + stacks;
      console.log(`ENEMIGO QUEMA: +${stacks}. Quemadura del jugador: ${this.playerBurn}.`);
    }

    // La intención se consume al ejecutarse. La siguiente se elige en startTurn().
    this.enemy.intent = null;
  }

  startTurn() {
    this.turnCount++;
    this.energy = this.maxEnergy;

    // A3: el bloqueo del jugador no persiste entre turnos.
    this.playerBlock = 0;

    // Quemadura del jugador: daña al inicio del turno y baja un stack.
    if ((this.playerBurn || 0) > 0) {
      const burnDamage = this.playerBurn;
      this.playerHp -= burnDamage;
      this.playerBurn = Math.max(0, this.playerBurn - 1);
      console.log(`QUEMADURA DEL JUGADOR: -${burnDamage}. Vida Jugador: ${this.playerHp}. Stacks restantes: ${this.playerBurn}.`);

      if (this.playerHp <= 0) {
        return;
      }
    }

    // Quemadura del enemigo: daña al inicio del turno del jugador y baja un stack.
    if (this.enemyBurnStacks > 0) {
      this.enemy.hp -= this.enemyBurnStacks;
      this.enemyBurnStacks--;
      console.log(`QUEMADURA ENEMIGA: -${this.enemyBurnStacks + 1}. Vida enemiga: ${this.enemy.hp}.`);

      if (this.enemy.hp <= 0) {
        return;
      }
    }

    this.drawCards(5);

    // La intención enemiga se anuncia durante el turno del jugador.
    this.chooseEnemyIntent();

    console.log(`LOGIC RPG: Turno ${this.turnCount}. Mano: ${this.hand.length}.`);
  }

  drawCards(amount) {
    for (let i = 0; i < amount; i++) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        this.drawPile = [...this.discardPile];
        this.discardPile = [];
        this.shuffle();
      }

      const card = this.drawPile.pop();
      if (card) this.hand.push(card);
    }
  }

  playCard(index) {
    if (index < 0 || index >= this.hand.length) return false;

    const card = this.hand[index];

    if (this.energy < card.cost) {
      console.warn("LOGIC RPG: Sin energía.");
      return false;
    }

    this.energy -= card.cost;

    if (card.type === 'attack') {
      const dealt = this.dealDamageToEnemy(card.damage);
      console.log(`DAÑO FÍSICO: ${card.damage}. Daño real tras bloqueo: ${dealt}. Enemigo HP: ${this.enemy ? this.enemy.hp : 0}.`);
    } else if (card.type === 'skill') {
      if (card.block) {
        this.playerBlock = (this.playerBlock || 0) + card.block;
        console.log(`BLOQUEO JUGADOR: +${card.block}. Total: ${this.playerBlock}.`);
      }

      if (card.heal) {
        this.playerHp = Math.min(this.maxPlayerHp, this.playerHp + card.heal);
        console.log(`CURACIÓN: +${card.heal}. Vida Jugador: ${this.playerHp}.`);
      }
    } else if (card.type === 'power') {
      if (card.effect === 'burn') {
        this.enemyBurnStacks += card.value;
        console.log(`QUEMADURA ENEMIGA APLICADA: +${card.value}. Stacks totales: ${this.enemyBurnStacks}.`);
      }
    }

    this.hand.splice(index, 1);
    this.discardPile.push(card);

    return true;
  }

  endTurn() {
    console.log("LOGIC RPG: Fin de turno jugador.");

    if (this.enemy && this.enemy.hp > 0) {
      this.executeEnemyIntent();

      if (this.playerHp <= 0) {
        return;
      }
    }

    this.discardHand();
    this.startTurn();
  }

  discardHand() {
    this.discardPile.push(...this.hand);
    this.hand = [];
  }

  getStatus() {
    return {
      hp: this.playerHp,
      energy: this.energy,
      handSize: this.hand.length,
      enemyHp: this.enemy ? this.enemy.hp : 0
    };
  }

  /* ==========================================================================
     AUTOGUARDADO (A.2 + B1)
     serialize() devuelve SOLO datos JSON-safe.
     fromSave() reconstruye la instancia con métodos intactos sin correr init().
     ========================================================================== */

  serialize() {
    return {
      version: SAVE_VERSION,
      playerHp: this.playerHp,
      maxPlayerHp: this.maxPlayerHp,
      energy: this.energy,
      maxEnergy: this.maxEnergy,
      drawPile: this.drawPile.map((card) => ({ ...card })),
      hand: this.hand.map((card) => ({ ...card })),
      discardPile: this.discardPile.map((card) => ({ ...card })),
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
    s.drawPile = Array.isArray(data.drawPile) ? data.drawPile.map((card) => ({ ...card })) : [];
    s.hand = Array.isArray(data.hand) ? data.hand.map((card) => ({ ...card })) : [];
    s.discardPile = Array.isArray(data.discardPile) ? data.discardPile.map((card) => ({ ...card })) : [];
    s.turnCount = Number(data.turnCount) || 0;
    s.enemyBurnStacks = Number(data.enemyBurnStacks) || 0;
    s.playerBurn = Number(data.playerBurn) || 0;
    s.playerBlock = Number(data.playerBlock) || 0;

    if (data.enemy && typeof data.enemy === "object") {
      const template = ENEMIES.find((enemy) => enemy.id === data.enemy.id);

      s.enemy = {
        id: data.enemy.id || (template ? template.id : "unknown"),
        name: data.enemy.name || (template ? template.name : "Amenaza"),
        hp: Number(data.enemy.hp) || 0,
        maxHp: Number(data.enemy.maxHp) || Number(data.enemy.hp) || 0,
        attackDmg: Number(data.enemy.attackDmg) || (template ? template.attackDmg : 5),
        block: Number(data.enemy.block) || 0,
        intent: data.enemy.intent && typeof data.enemy.intent === "object"
          ? { ...data.enemy.intent }
          : null,
        moveIndex: Number(data.enemy.moveIndex) || 0
      };

      // Seguridad: si un save llega sin intención pero el enemigo vive,
      // se genera una coherente con su patrón actual.
      if (s.enemy.hp > 0 && !s.enemy.intent) {
        s.chooseEnemyIntent();
      }
    } else {
      s.enemy = null;
    }

    return s;
  }
}
