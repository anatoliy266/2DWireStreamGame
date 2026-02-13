import { PlayerNode } from "./classes/PlayerNode";
import { Enemy } from "./classes/Enemy";
import { NetworkBuffer } from "./classes/NetworkBuffer";
import { DungeonMaster } from "./classes/DungeonMaster";

export class GameController {
    players: Map<string, PlayerNode> = new Map();
    enemies: Enemy[] = [];
    buffer: NetworkBuffer = new NetworkBuffer();
    dungeon: DungeonMaster = new DungeonMaster();
    isGameRunning: boolean = false;
    timeLeft: number = 15;
    timer: any;

    constructor() { this.render(); }

    startGame() {
        this.isGameRunning = true;
        this.addLog("[SYSTEM]: Build 0.0.2 ready. Prepare for infiltration.");
        this.nextLevel();
    }

    private addLog(msg: string) {
        const log = document.getElementById('system-log');
        if (log) {
            log.innerHTML = `<div>> ${msg}</div>` + log.innerHTML;
            if (log.childNodes.length > 4) log.lastChild?.remove();
        }
    }

    // Визуальный эффект летящего пакета
    private spawnPacket(fromId: string, toSlotType: 'atk' | 'def', slotIndex: number) {
        const startEl = document.getElementById(`player-${fromId}`);
        const endEl = document.getElementById(`${toSlotType}-slot-${slotIndex}`);
        if (!startEl || !endEl) return;

        const packet = document.createElement('div');
        packet.className = 'packet';
        packet.innerText = toSlotType === 'atk' ? '[ATK_PKT]' : '[DEF_PKT]';
        
        const rect = startEl.getBoundingClientRect();
        packet.style.left = rect.left + 'px';
        packet.style.top = rect.top + 'px';
        document.body.appendChild(packet);

        const endRect = endEl.getBoundingClientRect();
        setTimeout(() => {
            packet.style.left = endRect.left + 'px';
            packet.style.top = endRect.top + 'px';
            packet.style.opacity = '0';
        }, 50);

        setTimeout(() => packet.remove(), 600);
    }

    handleInput(userId: string, userName: string, command: string) {
        if (!this.isGameRunning) return;
        
        let p = this.players.get(userId);
        if (!p) { p = new PlayerNode(userId, userName); this.players.set(userId, p); }
        if (p.status === 'TERMINATED' || p.status === 'BLACKOUT') return;

        // Smart Routing Logic из GDD
        let success = false;
        let targetSlot = -1;

        if (command.includes('attack')) {
            // Жадное комбо: ищем первый неполный слот A1 -> A2 -> A3
            targetSlot = this.buffer.attackSlots.findIndex(s => s.assignedEntityId && s.count < 4);
            if (targetSlot !== -1) {
                success = this.buffer.addAttackToken(targetSlot);
                this.spawnPacket(userId, 'atk', targetSlot);
            }
        } else if (command.includes('defend')) {
            // HP-Приоритет: ищем самого слабого
            const sortedDef = this.buffer.defenseSlots
                .filter(s => s.assignedEntityId)
                .map(s => ({idx: s.index, hp: this.players.get(s.assignedEntityId!)?.integrity || 100}))
                .sort((a,b) => a.hp - b.hp);
            
            if (sortedDef.length > 0) {
                targetSlot = sortedDef[0].idx;
                success = this.buffer.addDefenseToken(this.players); // Тут твоя логика NetworkBuffer
                this.spawnPacket(userId, 'def', targetSlot);
            }
        }

        if (!success) {
            this.addLog(`CRITICAL_OVERFLOW: STACK_FULL. RAID_PENALTY: +40MS`);
            this.players.forEach(n => n.addLatency(40));
            // Визуальный шейк экрана
            document.getElementById('game-overlay')?.classList.add('glitch');
            setTimeout(() => document.getElementById('game-overlay')?.classList.remove('glitch'), 200);
        }

        p.addLatency(command.includes('sudo') ? 30 : 10);
        this.render();
    }

    private nextLevel() {
        this.enemies = this.dungeon.loadNextHop();
        this.addLog(`HOPS_TRANSITION: SYNCING_LAYERS...`);
        this.startTurn();
    }

    private startTurn() {
        this.timeLeft = 15;
        this.buffer.reset();
        
        // Designated Nodes
        const alive = Array.from(this.players.values()).filter(p => p.status !== 'TERMINATED');
        const shuffled = alive.sort(() => 0.5 - Math.random()).slice(0, 4);
        this.buffer.defenseSlots.forEach((s, i) => s.assignedEntityId = shuffled[i]?.id || null);

        // Bind Enemies
        this.enemies.forEach(e => {
            if (this.buffer.attackSlots[e.linkedSlotIndex]) 
                this.buffer.attackSlots[e.linkedSlotIndex].assignedEntityId = e.id;
        });

        clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.timeLeft--;
            if (this.timeLeft <= 0) this.resolveTurn();
            this.render();
        }, 1000);
    }

    private resolveTurn() {
        this.addLog(`BUFFER_FLUSHING: EXECUTING_COMMAND_STACK...`);
        
        // Damage Logic
        this.buffer.attackSlots.forEach(s => {
            if (s.count > 0 && s.assignedEntityId) {
                const e = this.enemies.find(en => en.id === s.assignedEntityId);
                if (e) e.takeDamage(s.count * 25);
            }
        });

        this.buffer.defenseSlots.forEach(s => {
            if (s.assignedEntityId) {
                const p = this.players.get(s.assignedEntityId);
                if (p) {
                    const dmg = s.count === 0 ? 30 : s.count === 1 ? 15 : 0;
                    if (dmg > 0) p.takeDamage(dmg);
                }
            }
        });

        this.players.forEach(p => p.ventLatency());
        this.enemies = this.enemies.filter(e => !e.isDead);
        if (this.enemies.length === 0) this.nextLevel();
        else this.startTurn();
    }

    render() {
        // Отрисовка Hops (Top Bar)
        const hops = document.getElementById('hops-display');
        if (hops) hops.innerText = `[ ${"█".repeat(this.dungeon.currentHop)}${"_".repeat(6-this.dungeon.currentHop)} ]`;

        const timer = document.getElementById('turn-timer');
        if (timer) timer.innerText = `FLUSHING: ${this.timeLeft}S`;

        // Enemies (Left)
        const eList = document.getElementById('enemy-list');
        if (eList) {
            eList.innerHTML = this.enemies.map(e => `
                <div class="entity">
                    <div style="font-size:9px">${e.name} >> A${e.linkedSlotIndex+1}</div>
                    <div class="hp-gauge"><div class="hp-fill" style="width:${(e.integrity/e.maxIntegrity)*100}%"></div></div>
                </div>
            `).join('');
        }

        // Buffer (Center)
        const atkBox = document.getElementById('attack-slots');
        if (atkBox) {
            atkBox.innerHTML = this.buffer.attackSlots.map(s => `
                <div class="slot attack" id="atk-slot-${s.index}">
                    A${s.index+1} > ${s.assignedEntityId ? 'DATA_LOCKED' : 'IDLE'}
                    <div class="combo-meter">X${s.count}</div>
                </div>
            `).join('');
        }
        const defBox = document.getElementById('defense-slots');
        if (defBox) {
            defBox.innerHTML = this.buffer.defenseSlots.map(s => `
                <div class="slot defense" id="def-slot-${s.index}">
                    D${s.index+1} > ${this.players.get(s.assignedEntityId!)?.name || '---'}
                    <div class="combo-meter">X${s.count}</div>
                </div>
            `).join('');
        }

        // Players (Right)
        const pList = document.getElementById('player-list');
        if (pList) {
            const designated = Array.from(this.players.values())
                .filter(p => this.buffer.defenseSlots.some(s => s.assignedEntityId === p.id))
                .slice(0,4);
            
            pList.innerHTML = designated.map(p => `
                <div id="player-${p.id}" class="entity ${p.integrity < 20 ? 'glitch' : ''}">
                    <div style="font-size:9px">${p.name} [${p.status}]</div>
                    <div class="hp-gauge"><div class="hp-fill" style="width:${p.integrity}%"></div></div>
                    <div class="lat-gauge"><div class="lat-fill" style="width:${(p.latency/200)*100}%"></div></div>
                </div>
            `).join('');
        }
    }
}