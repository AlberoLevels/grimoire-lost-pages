// --- BASE DE DATOS RPG CLÁSICO ---
const CARDS = {
    strike: { id: 'strike', name: 'Golpe Espada', type: 'attack', cost: 1, damage: 6, desc: 'Ataque básico con espada.' },
    defend: { id: 'defend', name: 'Escudo Magico', type: 'skill', cost: 1, block: 5, desc: 'Invoca barrera protectora.' },
    fireball: { id: 'fireball', name: 'Bola de Fuego', type: 'power', cost: 2, effect: 'burn', value: 3, desc: 'Quema al enemigo cada turno.' },
    heal:   { id: 'heal',   name: 'Poción Curativa', type: 'skill', cost: 0, heal: 5, desc: 'Recupera 5 puntos de vida.' }
};

const ENEMIES = [
    { id: 'goblin', name: 'Goblin Asesino', hp: 20, maxHp: 20, attackDmg: 5 },
    { id: 'dragon', name: 'Dragón Joven', hp: 45, maxHp: 45, attackDmg: 8 }
];

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

        // Efectos persistentes (ej: quemadura)
        this.enemyBurnStacks = 0; 

        this.init();
    }

    init() {
        console.log("LOGIC RPG: Iniciando...");
        
        // Mazo inicial estándar de RPG
        for(let i=0; i<5; i++) this.addCard('strike');
        for(let i=0; i<3; i++) this.addCard('defend');
        this.addCard('fireball');
        this.addCard('heal');
        
        this.shuffle();
        
        const enemyTemplate = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
        this.enemy = { ...enemyTemplate }; 
        
        console.log(`LOGIC RPG: Enemigo ${this.enemy.name} listo.`);
        
        this.startTurn();
    }

    addCard(cardId) {
        if(CARDS[cardId]) {
            this.drawPile.push({ ...CARDS[cardId] });
        }
    }

    shuffle() {
        for (let i = this.drawPile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
        }
    }

    startTurn() {
        this.turnCount++;
        this.energy = this.maxEnergy;
        
        // Aplicar quemadura al inicio del turno del jugador si existe
        if(this.enemyBurnStacks > 0) {
            this.enemy.hp -= this.enemyBurnStacks;
            this.enemyBurnStacks--; // Reduce stack
            console.log(`Quemadura hace daño: ${this.enemyBurnStacks + 1}. Vida enemiga: ${this.enemy.hp}`);
            
            if(this.enemy.hp <= 0) {
                this.endCombat(true);
                return;
            }
        }

        this.drawCards(5);
        console.log(`LOGIC RPG: Turno ${this.turnCount}. Mano: ${this.hand.length}`);
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
            if(card) this.hand.push(card);
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
        
        // Lógica de efectos RPG
        if (card.type === 'attack') {
            this.enemy.hp -= card.damage;
            console.log(`Daño físico: ${card.damage}. Enemigo HP: ${this.enemy.hp}`);
        } else if (card.type === 'skill') {
            if (card.block) {
                // Simplificación: El bloqueo se resta directamente del siguiente ataque enemigo
                // Para MVP, asumimos que "block" reduce daño recibido en endTurn
                this.playerBlock = (this.playerBlock || 0) + card.block;
            }
            if (card.heal) {
                this.playerHp = Math.min(this.maxPlayerHp, this.playerHp + card.heal);
                console.log(`Curación: +${card.heal}. Vida Jugador: ${this.playerHp}`);
            }
        } else if (card.type === 'power') {
            if (card.effect === 'burn') {
                this.enemyBurnStacks += card.value;
                console.log(`Aplicada QUEMADURA (${card.value}). Stacks totales: ${this.enemyBurnStacks}`);
            }
        }

        this.hand.splice(index, 1);
        this.discardPile.push(card);
        
        if (this.enemy.hp <= 0) {
            this.endCombat(true);
        }
        
        return true;
    }

    endTurn() {
        console.log("LOGIC RPG: Fin de turno jugador.");
        
        // Ataque enemigo
        if (this.enemy && this.enemy.hp > 0) {
            let dmg = this.enemy.attackDmg;
            
            // Aplicar bloqueo del jugador
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
                console.log(`Enemigo ataca. Daño recibido: ${dmg}. Vida Jugador: ${this.playerHp}`);
            }
            
            if (this.playerHp <= 0) {
                this.endCombat(false);
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

    endCombat(victory) {
        if (victory) {
            alert("¡VICTORIA! Has derrotado al monstruo.");
        } else {
            alert("DERROTA. Tu aventura termina aquí.");
        }
        location.reload();
    }
    
    getStatus() {
        return {
            hp: this.playerHp,
            energy: this.energy,
            handSize: this.hand.length,
            enemyHp: this.enemy ? this.enemy.hp : 0
        };
    }
}