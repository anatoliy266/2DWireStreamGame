import { CONFIG } from "../config";
import { printMessage } from "../utils";
import { NetworkNode } from "./base";

export class TrashMob extends NetworkNode {
    constructor(type: string, hp: number) {
        super(type, "mob", hp, type);
    }
    act(party: NetworkNode[]) {
        const target = party[Math.floor(Math.random() * party.length)];
        if (target && !target.isDead) {
            printMessage(`🤖 ${this.name} атакует ${target.playerName}`);
            target.takeDamage(15, this.name);
        }
    }
}

export class Boss extends NetworkNode {
    turnCount: number;
    targets: NetworkNode[];

    constructor() {
        super("Legacy Mainframe", "boss", 500, "BOSS");
        this.turnCount = 0;
        this.targets = [];
    }

    act(party: NetworkNode[]) {
        if (this.reconnectTimer > 0) {
            this.reconnectTimer--;
            printMessage(`💤 Босс перезагружается...`);
            return;
        }
        if (this.latency >= 100) {
            this.reconnectTimer = 1; this.latency = 0;
            printMessage(`🔥 БОСС ПЕРЕГРЕЛСЯ!`);
            return;
        }

        this.turnCount++;
        const aliveHeroes = party.filter(h => !h.isDead);
        if (aliveHeroes.length === 0) return;

        printMessage(`--- ХОД БОССА (Turn ${this.turnCount}) ---`, "SYSTEM");

        if (this.turnCount % 3 === 0) {
            this.overload(aliveHeroes);
        } else {
            if (this.targets.length == 0) this.targets = this.aim_targets(party);
            this.targets.forEach(target => {
                if (!target.isDead) { // Проверка на случай если цель умерла между ходами
                    printMessage(`🤖 Босс атакует ${target.playerName}`);
                    target.takeDamage(25, this.name);
                    this.addLatency(5);
                }
            });
            this.targets = this.aim_targets(party);
        }
    }

    aim_targets(party: NetworkNode[]) {
        const alive = party.filter(h => !h.isDead);
        const targets: NetworkNode[] = [];
        if (alive.length === 0) return [];
        
        let targetsCount = 1;
        if (alive.length > 3) targetsCount = Math.floor(Math.random() * (alive.length - 3 + 1)) + 3;
        
        // Защита от бесконечного цикла если живых меньше чем мы хотим выбрать
        targetsCount = Math.min(targetsCount, alive.length);

        while (targets.length < targetsCount) {
            const randomPlayer = alive[Math.floor(Math.random() * alive.length)];
            if (!targets.includes(randomPlayer)) {
                targets.push(randomPlayer);
            }
        }
        printMessage(`☠️ БОСС нацелился на ${targets.map(t => t.playerName).join(' | ')}, защищайте союзников`);
        return targets;
    }

    overload(heroes: NetworkNode[]) {
        printMessage(`☠️ БОСС ИСПОЛЬЗУЕТ !OVERLOAD (AOE)`);
        heroes.forEach(h => h.takeDamage(15, this.name));
        this.addLatency(20);
    }
}