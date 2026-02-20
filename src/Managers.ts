// =====================================================
// 3. Менеджеры
// =====================================================

import { AttackSlot, DefenseSlot } from "./Buffer";
import { AttackType, Enemy, Player } from "./Entities";

export class PlayerManager {
    private players: Map<string, Player> = new Map();

    get allPlayers(): Player[] {
        return Array.from(this.players.values());
    }

    get activePlayers(): Player[] {
        return this.allPlayers.filter(p => p.isActive());
    }

    get terminatedPlayers(): Player[] {
        return this.allPlayers.filter(p => p.isTerminated());
    }

    get size(): number {
        return this.players.size;
    }

    addPlayer(id: string, name: string): Player {
        if (!this.players.has(id)) {
            const player = new Player(id, name);
            this.players.set(id, player);
            return player;
        }
        return this.players.get(id)!;
    }

    getPlayer(id: string): Player | undefined {
        return this.players.get(id);
    }

    hasPlayer(id: string): boolean {
        return this.players.has(id);
    }

    updateAll(callback: (player: Player) => void): void {
        this.players.forEach(callback);
    }

    getPlayerName(id: string): string {
        return this.players.get(id)?.name || '???';
    }

    getRandomActivePlayers(count: number): (string | null)[] {
        const active = this.activePlayers.map(p => p.id);
        const shuffled = active.sort(() => 0.5 - Math.random());
        const result: (string | null)[] = [];
        for (let i = 0; i < count; i++) {
            result.push(shuffled[i] || null);
        }
        return result;
    }

    awardContribution(userId: string, points: number): void {
        const player = this.players.get(userId);
        if (player) {
            player.contribution += points;
        }
    }

    clear(): void {
        this.players.clear();
    }
}

export class EnemyManager {
    private enemies: Enemy[] = [];

    get all(): Enemy[] {
        return [...this.enemies];
    }

    get alive(): Enemy[] {
        return this.enemies.filter(e => e.isAlive());
    }

    set(newEnemies: Enemy[]): void {
        this.enemies = newEnemies;
    }

    clearDead(): void {
        this.enemies = this.enemies.filter(e => e.isAlive());
    }

    spawnForHop(hop: number, playerCount: number): Enemy[] {
        const enemies: Enemy[] = [];
        const isBoss = hop === 4;
        const count = isBoss ? 1 : Math.min(3, Math.ceil(Math.random() * 3));

        for (let i = 0; i < count; i++) {
            let name: string;
            let baseHP: number;
            let baseDamage: number;
            let attackType: AttackType;

            if (isBoss) {
                name = "LEGACY_MAINFRAME";
                baseHP = 500 + 50 * playerCount;
                baseDamage = 60 + 10 * playerCount;
                attackType = AttackType.AOE;
            } else {
                name = `DAEMON_v${hop}.${i}`;
                baseHP = 150 + 20 * playerCount;
                baseDamage = 30 + 5 * playerCount;
                attackType = AttackType.SINGLE;
            }

            enemies.push(new Enemy(
                `mob_${Date.now()}_${i}`,
                name,
                baseHP,
                baseHP,
                200,
                i,
                baseDamage,
                attackType
            ));
        }
        this.enemies = enemies;
        return enemies;
    }

    clear(): void {
        this.enemies = [];
    }
}

export class SlotManager {
    public attackSlots: AttackSlot[] = [];
    public defenseSlots: DefenseSlot[] = [];

    constructor() {
        this.reset();
    }

    reset(): void {
        this.attackSlots = Array(3).fill(null).map(() => new AttackSlot());
        this.defenseSlots = Array(4).fill(null).map(() => new DefenseSlot());
    }

    assignDefenseTargets(playerIds: (string | null)[]): void {
        for (let i = 0; i < this.defenseSlots.length; i++) {
            this.defenseSlots[i].assignedPlayerId = playerIds[i] || null;
        }
    }

    addAttackCommand(cmdName: string, power: number, userId: string, userName: string): void {
        const existingIndex = this.attackSlots.findIndex(slot => slot.commandName === cmdName);
        if (existingIndex !== -1) {
            const slot = this.attackSlots[existingIndex];
            slot.addContributor(userId, userName, power);
            return;
        }

        const emptyIndex = this.attackSlots.findIndex(slot => slot.isEmpty());
        if (emptyIndex !== -1) {
            const slot = this.attackSlots[emptyIndex];
            slot.commandName = cmdName;
            slot.addContributor(userId, userName, power);
            return;
        }

        let minIndex = 0;
        let minPower = this.attackSlots[0].totalPower;
        for (let i = 1; i < this.attackSlots.length; i++) {
            if (this.attackSlots[i].totalPower < minPower) {
                minPower = this.attackSlots[i].totalPower;
                minIndex = i;
            }
        }

        if (power > minPower) {
            const slot = this.attackSlots[minIndex];
            slot.clear();
            slot.commandName = cmdName;
            slot.addContributor(userId, userName, power);
        }
    }

    addDefenseCommand(cmdName: string, power: number, userId: string, userName: string, targetSlot: number | null): void {
        const tryAddToSlot = (slot: DefenseSlot, slotIndex: number): boolean => {
            if (slot.commandName === cmdName) {
                slot.addContributor(userId, userName, power);
                return true;
            }
            if (slot.isEmpty()) {
                slot.commandName = cmdName;
                slot.addContributor(userId, userName, power);
                return true;
            }
            if (power > slot.totalPower) {
                slot.clear();
                slot.commandName = cmdName;
                slot.addContributor(userId, userName, power);
                return true;
            }
            return false;
        };

        if (targetSlot !== null && targetSlot >= 0 && targetSlot < this.defenseSlots.length) {
            tryAddToSlot(this.defenseSlots[targetSlot], targetSlot);
            return;
        }

        const existingIndex = this.defenseSlots.findIndex(slot => slot.commandName === cmdName);
        if (existingIndex !== -1) {
            this.defenseSlots[existingIndex].addContributor(userId, userName, power);
            return;
        }

        const emptyIndex = this.defenseSlots.findIndex(slot => slot.isEmpty());
        if (emptyIndex !== -1) {
            const slot = this.defenseSlots[emptyIndex];
            slot.commandName = cmdName;
            slot.addContributor(userId, userName, power);
            return;
        }

        let minIndex = 0;
        let minPower = this.defenseSlots[0].totalPower;
        for (let i = 1; i < this.defenseSlots.length; i++) {
            if (this.defenseSlots[i].totalPower < minPower) {
                minPower = this.defenseSlots[i].totalPower;
                minIndex = i;
            }
        }

        if (power > minPower) {
            const slot = this.defenseSlots[minIndex];
            slot.clear();
            slot.commandName = cmdName;
            slot.addContributor(userId, userName, power);
        }
    }

    getNonEmptyAttackSlots(): AttackSlot[] {
        return this.attackSlots.filter(s => !s.isEmpty());
    }

    getNonEmptyDefenseSlots(): DefenseSlot[] {
        return this.defenseSlots.filter(s => !s.isEmpty());
    }
}