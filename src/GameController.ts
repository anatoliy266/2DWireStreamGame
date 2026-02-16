// GameController.ts
import { Player, Enemy, BufferSlot, CommandType } from './Types';

export class GameController {
    public isGameRunning: boolean = false;
    
    // State
    private players: Map<string, Player> = new Map();
    private enemies: Enemy[] = [];
    private attackSlots: BufferSlot[] = []; // Size 3
    private defenseSlots: BufferSlot[] = []; // Size 4
    private assignedDefensePlayers: (string | null)[] = [null, null, null, null]; // Player IDs assigned to D1-D4

    private currentHop: number = 1;
    private turnTimer: number = 15;

    private timerInterval: any = null; // Хранит ID интервала
    private isTimerRunning: boolean = false;
    

    constructor() {
        this.resetBuffer();
    }

    // --- INITIALIZATION ---

    public startGame() {
        this.isGameRunning = true;
        this.drawInterface();
        this.currentHop = 1;
        this.spawnEnemies();
        this.startTurn();
        this.log("SYSTEM", "INFILTRATION STARTED. HOP 1 REACHED.");
    }

    private spawnEnemies() {
        this.enemies = [];
        // Simple logic: 1-3 enemies based on Hop
        const count = this.currentHop === 4 ? 1 : Math.min(3, Math.ceil(Math.random() * 3));
        
        for (let i = 0; i < count; i++) {
            this.enemies.push({
                id: `mob_${Date.now()}_${i}`,
                name: this.currentHop === 4 ? "LEGACY_MAINFRAME" : `DAEMON_v${this.currentHop}.${i}`,
                hp: 100,
                maxHp: 100,
                slotIndex: i // Maps to A1, A2, A3
            });
        }
        this.renderEnemies();
    }

    private resetBuffer() {
        // 3 Attack Slots, 4 Defense Slots
        this.attackSlots = Array(3).fill(null).map(() => ({ level: 0, type: null, contributors: [] }));
        this.defenseSlots = Array(4).fill(null).map(() => ({ level: 0, type: null, contributors: [] }));
    }

    // --- TURN LOOP ---

    public startTimer() {
        if (this.isTimerRunning) return; // Защита от двойного запуска

        this.isTimerRunning = true;
        this.updateTimerUI(); // Обновляем сразу при старте

        this.timerInterval = setInterval(() => {
            this.turnTimer--;
            this.updateTimerUI();
            
            if (this.turnTimer <= 0) {
                this.stopTimer(); // Важно остановить таймер перед выполнением логики
                this.resolveTurn();
            }
        }, 1000);
    }

    public stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.isTimerRunning = false;
    }

    private startTurn() {
        // --- Подготовка нового хода ---
        this.resetBuffer();
        this.assignDefenseTargets();
        
        // --- Сброс и запуск времени ---
        this.stopTimer(); // На всякий случай очищаем предыдущий
        this.turnTimer = 15;
        this.updateUI();
        this.startTimer(); // Запуск отсчета
    }

    // 5. Не забудьте обновить endGame, чтобы он тоже останавливал таймер
    private endGame() {
        this.stopTimer();
        this.isGameRunning = false;
        this.cleanInterface();
    }

    private assignDefenseTargets() {
        // Pick 4 random active players to be targets
        const activeIds = Array.from(this.players.values())
            .filter(p => p.state !== 'terminated')
            .map(p => p.id);
        
        // Shuffle and pick 4
        const shuffled = activeIds.sort(() => 0.5 - Math.random());
        this.assignedDefensePlayers = [
            shuffled[0] || null,
            shuffled[1] || null,
            shuffled[2] || null,
            shuffled[3] || null
        ];
        this.renderBuffer();
    }

    // --- INPUT HANDLING ---

    public handleInput(userId: string, userName: string, command: string, args: any) {
        if (!this.isGameRunning) return;

        // Register/Get Player
        let player = this.players.get(userId);
        if (!player) {
            player = { id: userId, name: userName, integrity: 100, latency: 0, state: 'active', blackoutTimer: 0 };
            this.players.set(userId, player);
        }

        if (player.state !== 'active') return; // Dead or Stunned

        // Latency Cost
        const cost = command.includes("sudo") ? 30 : 10;
        player.latency += cost;

        // Blackout Check
        if (player.latency >= 200) {
            player.state = 'blackout';
            player.blackoutTimer = 2;
            this.log("SYSTEM", `NODE ${player.name} OVERHEATED -> BLACKOUT`);
            this.updateUI();
            return;
        }

        // Add to Raw Pool UI
        this.addRawLog(userName, command);

        // Routing Logic
        this.processCommand(player, command);
        this.updateUI();
    }

    private processCommand(player: Player, cmdString: string) {
        // Parse intent
        const isAttack = cmdString.includes("attack");
        const isDefend = cmdString.includes("defend");

        if (isAttack) {
            this.routeAttack(player);
        } else if (isDefend) {
            this.routeDefense(player);
        }
        // TODO: Handle Finishers
    }

    // --- AUTO-ROUTING LOGIC (GDD) ---

    private routeAttack(player: Player) {
        // Greedy Algorithm: Fill A1 to X4, then A2, then A3
        for (let i = 0; i < 3; i++) {
            const slot = this.attackSlots[i];
            
            // Only route to slots that have valid enemies
            if (!this.enemies.find(e => e.slotIndex === i)) continue;

            if (slot.level < 4) {
                slot.level++;
                slot.type = 'attack';
                slot.contributors.push(player.name);
                this.log("SYNERGY", `> ATTACK ROUTED TO A${i+1} [X${slot.level}] by ${player.name}`);
                return; 
            }
        }
        
        // Overflow if all full
        this.triggerOverflow(player);
    }

    private routeDefense(player: Player) {
        // Priority: Lowest HP Designated Player who isn't safe (Safe = Combo X2)
        let targetSlotIndex = -1;
        let lowestHP = 101;

        // Find critical targets (HP < 100 and Slot Level < 2)
        for (let i = 0; i < 4; i++) {
            const targetId = this.assignedDefensePlayers[i];
            if (!targetId) continue;
            
            const target = this.players.get(targetId);
            if (!target) continue;

            if (this.defenseSlots[i].level < 2) {
                if (target.integrity < lowestHP) {
                    lowestHP = target.integrity;
                    targetSlotIndex = i;
                }
            }
        }

        // If everyone is "Safe" (X2), fill linearly to X4
        if (targetSlotIndex === -1) {
             for (let i = 0; i < 4; i++) {
                if (this.assignedDefensePlayers[i] && this.defenseSlots[i].level < 4) {
                    targetSlotIndex = i;
                    break;
                }
             }
        }

        if (targetSlotIndex !== -1) {
            const slot = this.defenseSlots[targetSlotIndex];
            slot.level++;
            slot.type = 'defend';
            slot.contributors.push(player.name);
            this.log("SYNERGY", `> DEFENSE ROUTED TO D${targetSlotIndex+1} [X${slot.level}]`);
        } else {
            this.triggerOverflow(player);
        }
    }

    private triggerOverflow(player: Player) {
        this.log("SYSTEM", `BUFFER OVERFLOW by ${player.name}. ALL NODES +40ms LATENCY.`);
        // Global Penalty
        this.players.forEach(p => {
            if (p.state === 'active') p.latency = Math.min(200, p.latency + 40);
        });
    }

    // --- RESOLUTION PHASE ---

    private resolveTurn() {
        clearInterval(this.timerInterval);
        this.log("SYSTEM", "EXECUTING BUFFER...");

        // 1. Player Attack
        this.attackSlots.forEach((slot, index) => {
            if (slot.level > 0) {
                const enemy = this.enemies.find(e => e.slotIndex === index);
                if (enemy) {
                    // X1=10, X2=15, X3=20, X4=26 (approx based on multiplier)
                    const multipliers = [0, 1.0, 1.5, 2.0, 2.6];
                    const dmg = 100 * multipliers[slot.level]; //вернуть на 10!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! 100 это тесты
                    enemy.hp -= dmg;
                    this.log("SYSTEM", `> SLOT A${index+1} HITS ${enemy.name} FOR ${dmg} DMG`);
                }
            }
        });

        // 2. Enemy Attack / Defense Check
        this.assignedDefensePlayers.forEach((pid, index) => {
            if (!pid) return;
            const player = this.players.get(pid);
            if (!player) return;

            const defSlot = this.defenseSlots[index];
            // Boss Damage (Mock value 30)
            let damage = 30;
            
            // Mitigation
            const multipliers = [0, 10, 20, 30, 40]; // Mitigation amount
            damage -= multipliers[defSlot.level];
            if (damage < 0) damage = 0;

            if (damage > 0) {
                player.integrity -= damage;
                this.log("SYSTEM", `> ${player.name} TOOK ${damage} DAMAGE (Slot D${index+1})`);
            } else {
                this.log("SYNERGY", `> ${player.name} FULLY SHIELDED`);
            }

            if (player.integrity <= 0) {
                player.state = 'terminated';
                player.integrity = 0;
                this.log("SYSTEM", `NODE ${player.name} TERMINATED.`);
            }
        });

        // 3. Cleanup & Cooldown
        this.enemies = this.enemies.filter(e => e.hp > 0);
        

        // --- количество игроков оставшихся в живых ---
        const activePlayersCount = Array.from(this.players.values())
            .filter(p => p.state !== 'terminated').length;

        // Latency Vent (-15ms)
        this.players.forEach(p => {
            if (p.state === 'active') p.latency = Math.max(0, p.latency - 15);
            else if (p.state === 'blackout') {
                p.blackoutTimer--;
                if (p.blackoutTimer <= 0) {
                    p.state = 'active';
                    p.latency = 0; // Reset after blackout
                }
            }
        });

        // Next Hop or Next Turn
        if (activePlayersCount === 0) {
            this.log("SYSTEM", "GAME OVER. ALL NODES TERMINATED.");
            this.endGame();
            return;
        }
        else if (this.enemies.length === 0) {
            this.currentHop++;
            if (this.currentHop > 4) {
                this.log("SYSTEM", "MAINFRAME BREACHED. MISSION SUCCESS.");
                this.isGameRunning = false;
                //пока чтобы просчто исчезал потом подумаю что добавить в конце успешной игры.
                this.cleanInterface();
            } else {
                this.log("SYSTEM", `AREA CLEARED. MOVING TO HOP ${this.currentHop}...`);
                // Cooldown bonus (-50ms)
                this.players.forEach(p => p.latency = Math.max(0, p.latency - 50));
                setTimeout(() => {
                    //изменение UI - class="hop active"> добавляется к следующему этапу и пока что не убирается у текущего. 
                    this.drawHopsLvl();

                    this.spawnEnemies();
                    this.startTurn();
                }, 3000);
            }
        } else {
            setTimeout(() => this.startTurn(), 2000);
        }

        this.updateUI();
    }

    // --- RENDERING & HELPERS ---

    private log(type: "SYSTEM" | "SYNERGY", msg: string) {
        const div = document.getElementById(type === "SYSTEM" ? "system-log" : "synergy-log");
        if (div) {
            div.innerHTML += `<div>[${type}] ${msg}</div>`;
            div.scrollTop = div.scrollHeight;
        }
    }

    private addRawLog(user: string, cmd: string) {
        const list = document.getElementById("raw-pool");
        if (list) {
            const el = document.createElement("div");
            el.className = "pool-item";
            el.innerText = `> [${user}]: ${cmd}`;
            list.appendChild(el);
            list.scrollTop = list.scrollHeight;
        }
    }

    private updateUI() {
        this.renderEnemies();
        this.renderBuffer();
        this.renderPlayers();
    }
    drawHopsLvl(){
        const el = document.getElementById(`hop-${this.currentHop}`);
        el?.classList.add("active");
    }


    drawInterface() {
        const el = document.getElementById("general-store");
        el?.classList.remove("element-out");
        el?.classList.add("element-in");
    }
    cleanInterface() {
        const el = document.getElementById("general-store");
        el?.classList.remove("element-in");
        el?.classList.add("element-out");
    }
    
    private updateTimerUI() {
        const el = document.getElementById("timer-display");
        if(el) el.innerText = this.turnTimer.toString();
    }

    private renderEnemies() {
        const container = document.getElementById("enemy-container");
        if (!container) return;
        container.innerHTML = "";
        this.enemies.forEach(e => {
            const div = document.createElement("div");
            div.className = "enemy-slot";
            div.innerHTML = `
                <div>[!] ${e.name}</div>
                <div style="font-size:0.8em">LINKED: A${e.slotIndex + 1}</div>
                <div class="bar-container"><div class="hp-bar" style="width:${(e.hp/e.maxHp)*100}%; background:red;"></div></div>
            `;
            container.appendChild(div);
        });
    }

    private renderBuffer() {
        // Attack Slots
        this.attackSlots.forEach((slot, i) => {
            const el = document.getElementById(`slot-a${i+1}`);
            if (el) {
                el.className = `slot filled-${slot.level}`;
                el.innerText = `[A${i+1}] ${slot.level > 0 ? `ATTACK X${slot.level}` : "EMPTY"}`;
            }
        });

        // Defense Slots
        this.defenseSlots.forEach((slot, i) => {
            const el = document.getElementById(`slot-d${i+1}`);
            if (el) {
                const targetId = this.assignedDefensePlayers[i];
                const targetName = targetId ? (this.players.get(targetId)?.name || "???") : "NONE";
                
                el.className = `slot defense-slot filled-${slot.level}`;
                if (slot.level === 0) el.classList.add("danger");
                
                el.innerHTML = `
                    <span>[D${i+1}] ${targetName}</span>
                    <span>${slot.level > 0 ? `SHIELD X${slot.level}` : "VULNERABLE"}</span>
                `;
            }
        });
    }

    private renderPlayers() {
        const list = document.getElementById("player-list");
        if (!list) return;
        
        // Sort: Active first, then by Latency
        const sorted = Array.from(this.players.values()).sort((a,b) => b.integrity - a.integrity);

        list.innerHTML = "";
        sorted.forEach(p => {
            const div = document.createElement("div");
            div.className = `player-card ${p.state}`;
            
            let status = p.state === 'active' ? '' : `[${p.state.toUpperCase()}]`;
            
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span>${p.name} ${status}</span>
                    <span>${p.latency}ms</span>
                </div>
                <div class="bar-container">
                    <div class="hp-bar" style="width:${p.integrity}%"></div>
                </div>
                <div class="bar-container" style="margin-top:1px;">
                     <div class="lat-bar" style="width:${Math.min(100, p.latency/2)}%"></div>
                </div>
            `;
            list.appendChild(div);
        });
    }
}