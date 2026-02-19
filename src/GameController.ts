// GameController.ts
import { Player, Enemy, BufferSlot, CommandMap, ParametersMap } from './Types';

interface AttackSlot extends BufferSlot {
    commandName: string;          // имя команды в слоте
    totalPower: number;           // суммарная мощность
    powerMap: Map<string, number>; // вклад игроков (имя -> мощность)
}

interface DefenseSlot extends BufferSlot {
    commandName: string;
    totalPower: number;
    powerMap: Map<string, number>;
}

export class GameController {
    public isGameRunning: boolean = false;
    public isPrepStage: boolean = false;

    // State
    private players: Map<string, Player> = new Map();
    private enemies: Enemy[] = [];
    private attackSlots: AttackSlot[] = [];          // 3 слота атаки
    private defenseSlots: DefenseSlot[] = [];        // 4 слота защиты
    private assignedDefensePlayers: (string | null)[] = [null, null, null, null]; // игроки, привязанные к D1-D4

    private currentHop: number = 1;
    private turnTimer: number = 15;
    private timerInterval: any = null;
    private isTimerRunning: boolean = false;

    // Константы для расчётов
    private readonly LATENCY_THRESHOLD = 200;
    private readonly BLACKOUT_DURATION = 2;          // как в исходном коде
    private readonly BASE_ENEMY_DAMAGE = 30;          // базовый урон врага (можно менять от хопа)

    constructor() {
        this.resetBuffer();
    }

    // --- INITIALIZATION ---
    private resetGame() {
        // 1. Полная очистка игроков
        this.players = new Map<string, Player>();

        // 2. Очистка врагов
        this.enemies = [];

        // 3. Сброс слотов
        this.resetBuffer();

        // 4. Сброс назначенных целей защиты
        this.assignedDefensePlayers = [null, null, null, null];

        // 5. Сброс текущего хопа
        this.currentHop = 1;

        // 6. Остановка таймера, если он ещё работает
        this.stopTimer();
        this.turnTimer = 15; // стандартное значение

        // 7. Очистка логов
        this.clearLogs();

        // 8. Обновление интерфейса
        this.updateUI();
    }

    private clearLogs() {
        const sysLog = document.getElementById("system-log");
        if (sysLog) sysLog.innerHTML = "";
        const synLog = document.getElementById("synergy-log");
        if (synLog) synLog.innerHTML = "";
        const rawPool = document.getElementById("raw-pool");
        if (rawPool) rawPool.innerHTML = "";
    }

    // В prepareGame добавляем вызов resetGame
    public prepareGame() {
        console.log("prepareGame")
        this.resetGame(); // <-- сбрасываем всё перед новой игрой
        this.showIntro();
        this.isGameRunning = true;
        this.isPrepStage = true;
        setTimeout(() => {
            this.isPrepStage = false;
            if (this.players.size == 0) return;
            this.hideIntro();
            this.startGame();
            this.log("SYSTEM", "INFILTRATION STARTED. HOP 1 REACHED.");
            console.log("interval triggered")
        }, 5000);
    }

    showIntro() { return; }
    hideIntro() { return; }

    addPlayer(userId: any, userName: any) {
        let player = this.players.get(userId);
        if (!player) {
            player = { id: userId, name: userName, integrity: 100, latency: 0, state: 'active', blackoutTimer: 0 };
            this.players.set(userId, player);
            // Показываем уведомление только для нового игрока
            this.renderNewPlayerJoining(player);
        }
    }


    public startGame() {
        console.log("game started");
        this.isGameRunning = true;
        this.drawInterface();
        this.currentHop = 1;
        this.drawHopsLvl();
        this.spawnEnemies();
        this.startTurn();
        this.log("SYSTEM", "INFILTRATION STARTED. HOP 1 REACHED.");
    }

    private spawnEnemies() {
        this.enemies = [];
        const count = this.currentHop === 4 ? 1 : Math.min(3, Math.ceil(Math.random() * 3));
        for (let i = 0; i < count; i++) {
            this.enemies.push({
                id: `mob_${Date.now()}_${i}`,
                name: this.currentHop === 4 ? "LEGACY_MAINFRAME" : `DAEMON_v${this.currentHop}.${i}`,
                integrity: 100,
                slotIndex: i, // A1, A2, A3
                latency: 200
            });
        }
        this.renderEnemies();
    }

    private resetBuffer() {
        // Атакующие слоты
        this.attackSlots = Array(3).fill(null).map(() => ({
            level: 0,
            contributors: [],
            commandName: '',
            totalPower: 0,
            powerMap: new Map()
        }));
        // Защитные слоты
        this.defenseSlots = Array(4).fill(null).map(() => ({
            level: 0,
            contributors: [],
            commandName: '',
            totalPower: 0,
            powerMap: new Map()
        }));
    }

    // --- TURN LOOP ---
    public startTimer() {
        if (this.isTimerRunning) return;
        this.isTimerRunning = true;
        this.updateTimerUI();
        this.timerInterval = setInterval(() => {
            this.turnTimer--;
            this.updateTimerUI();
            if (this.turnTimer <= 0) {
                this.stopTimer();
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
        this.resetBuffer();
        this.assignDefenseTargets();
        this.stopTimer();
        this.turnTimer = 15;
        this.updateUI();
        this.startTimer();
    }

    private endGame() {
        this.stopTimer();
        this.isGameRunning = false;
        this.cleanInterface();
    }

    private assignDefenseTargets() {
        const activeIds = Array.from(this.players.values())
            .filter(p => p.state !== 'terminated')
            .map(p => p.id);
        const shuffled = activeIds.sort(() => 0.5 - Math.random());
        this.assignedDefensePlayers = [
            shuffled[0] || null,
            shuffled[1] || null,
            shuffled[2] || null,
            shuffled[3] || null
        ];
        this.renderBuffer();
    }

    // --- INPUT HANDLING (обновлён) ---
    public handleInput(userId: string, userName: string, text: string) {
        if (!this.isGameRunning) return;

        // Получаем или создаём игрока
        let player = this.players.get(userId);
        if (!player) {
            this.addPlayer(userId, userName);
            player = this.players.get(userId);
            if (!player) return;
        }

        if (player.state !== 'active') return;
        if (player.latency >= this.LATENCY_THRESHOLD) return;

        const words = text.trim().split(/\s+/);
        if (words.length === 0) return;

        // Извлечение команды (с опциональным префиксом '!')
        let rawCommand = words[0];
        if (rawCommand.startsWith('!')) rawCommand = rawCommand.substring(1);

        const commandDef = CommandMap.find(cmd => cmd.name === rawCommand);
        if (!commandDef) return; // не команда

        // Определяем тип команды по тегам
        const isDefense = commandDef.tags.has('defense');

        // Поиск параметров-множителей
        let totalMultiplier = 1.0;
        // Также ищем указание на целевой слот защиты (d1..d4)
        let targetDefenseSlot: number | null = null;

        for (const word of words.slice(1)) {
            if (word.startsWith('-')) {
                const paramName = word.replace(/^-+/, '');
                const paramDef = ParametersMap.find(p => p.name === paramName);
                if (paramDef) totalMultiplier *= paramDef.multiplier;
            } else if (isDefense && /^d[1-4]$/i.test(word)) {
                targetDefenseSlot = parseInt(word.substring(1)) - 1;
            }
        }

        const finalPower = commandDef.basePower * totalMultiplier;

        // Выбор слотов в зависимости от типа команды
        if (isDefense) {
            this.processDefenseCommand(commandDef.name, finalPower, userName, targetDefenseSlot);
        } else {
            this.processAttackCommand(commandDef.name, finalPower, userName);
        }

        // Начисление latency
        const latencyIncrease = Math.floor(finalPower / 10) + 1;
        player.latency = Math.min(this.LATENCY_THRESHOLD, player.latency + latencyIncrease);
        this.log("SYSTEM", `> Игроку ${userName} начислена задержка +${latencyIncrease} (теперь ${player.latency})`);

        if (player.latency >= this.LATENCY_THRESHOLD && player.state === 'active') {
            player.state = 'blackout';
            player.blackoutTimer = this.BLACKOUT_DURATION;
            this.log("SYSTEM", `> Игрок ${userName} перегрелся и ушёл в blackout на ${this.BLACKOUT_DURATION} хода`);
        }

        this.updateUI();
    }

    // Обработка атакующих команд (без изменений, но вынесено для читаемости)
    private processAttackCommand(cmdName: string, power: number, userName: string) {
        const existingSlotIndex = this.attackSlots.findIndex(slot => slot.commandName === cmdName);
        if (existingSlotIndex !== -1) {
            // Слияние
            const slot = this.attackSlots[existingSlotIndex];
            slot.totalPower += power;
            const currentContrib = slot.powerMap.get(userName) || 0;
            slot.powerMap.set(userName, currentContrib + power);
            slot.contributors.push(userName);
            slot.level = Math.min(4, Math.floor(slot.totalPower / 50) + 1);
            this.log("SYNERGY", `> Атака ${cmdName} усилена. Мощность: ${slot.totalPower} (ур.${slot.level})`);
            return;
        }

        // Поиск пустого слота
        const emptyIndex = this.attackSlots.findIndex(slot => slot.commandName === '');
        if (emptyIndex !== -1) {
            this.attackSlots[emptyIndex] = {
                level: 1,
                contributors: [userName],
                commandName: cmdName,
                totalPower: power,
                powerMap: new Map([[userName, power]])
            };
            this.log("SYNERGY", `> Атака ${cmdName} помещена в пустой слот A${emptyIndex + 1} (${power})`);
            return;
        }

        // Замена самого слабого
        let minIndex = 0;
        let minPower = this.attackSlots[0].totalPower;
        for (let i = 1; i < this.attackSlots.length; i++) {
            if (this.attackSlots[i].totalPower < minPower) {
                minPower = this.attackSlots[i].totalPower;
                minIndex = i;
            }
        }
        if (power > minPower) {
            this.attackSlots[minIndex] = {
                level: 1,
                contributors: [userName],
                commandName: cmdName,
                totalPower: power,
                powerMap: new Map([[userName, power]])
            };
            this.log("SYNERGY", `> Атака ${cmdName} вытеснила слабейшую в A${minIndex + 1} (${power})`);
        } else {
            this.log("SYNERGY", `> Атака ${cmdName} слишком слаба (${power}) и не попала в слоты`);
        }
    }

    // Обработка защитных команд
    private processDefenseCommand(cmdName: string, power: number, userName: string, targetSlot: number | null) {
        if (targetSlot !== null) {
            // Целевой слот указан
            if (targetSlot < 0 || targetSlot >= this.defenseSlots.length) return;
            const slot = this.defenseSlots[targetSlot];
            if (slot.commandName === cmdName) {
                // Слияние
                slot.totalPower += power;
                const currentContrib = slot.powerMap.get(userName) || 0;
                slot.powerMap.set(userName, currentContrib + power);
                slot.contributors.push(userName);
                slot.level = Math.min(4, Math.floor(slot.totalPower / 50) + 1);
                this.log("SYNERGY", `> Защита ${cmdName} усилена в D${targetSlot + 1}. Мощность: ${slot.totalPower} (ур.${slot.level})`);
            } else if (slot.commandName === '') {
                // Слот пуст
                this.defenseSlots[targetSlot] = {
                    level: 1,
                    contributors: [userName],
                    commandName: cmdName,
                    totalPower: power,
                    powerMap: new Map([[userName, power]])
                };
                this.log("SYNERGY", `> Защита ${cmdName} помещена в D${targetSlot + 1} (${power})`);
            } else {
                // Слот занят другой командой – сравниваем мощность
                if (power > slot.totalPower) {
                    this.defenseSlots[targetSlot] = {
                        level: 1,
                        contributors: [userName],
                        commandName: cmdName,
                        totalPower: power,
                        powerMap: new Map([[userName, power]])
                    };
                    this.log("SYNERGY", `> Защита ${cmdName} вытеснила ${slot.commandName} в D${targetSlot + 1} (${power})`);
                } else {
                    this.log("SYNERGY", `> Защита ${cmdName} не смогла вытеснить команду в D${targetSlot + 1} (${power} ≤ ${slot.totalPower})`);
                }
            }
        } else {
            // Целевой слот не указан – работаем как с атакой (ищем по имени, потом пустой, потом слабейший)
            const existingSlotIndex = this.defenseSlots.findIndex(slot => slot.commandName === cmdName);
            if (existingSlotIndex !== -1) {
                const slot = this.defenseSlots[existingSlotIndex];
                slot.totalPower += power;
                const currentContrib = slot.powerMap.get(userName) || 0;
                slot.powerMap.set(userName, currentContrib + power);
                slot.contributors.push(userName);
                slot.level = Math.min(4, Math.floor(slot.totalPower / 50) + 1);
                this.log("SYNERGY", `> Защита ${cmdName} усилена в D${existingSlotIndex + 1}. Мощность: ${slot.totalPower} (ур.${slot.level})`);
                return;
            }

            const emptyIndex = this.defenseSlots.findIndex(slot => slot.commandName === '');
            if (emptyIndex !== -1) {
                this.defenseSlots[emptyIndex] = {
                    level: 1,
                    contributors: [userName],
                    commandName: cmdName,
                    totalPower: power,
                    powerMap: new Map([[userName, power]])
                };
                this.log("SYNERGY", `> Защита ${cmdName} помещена в пустой слот D${emptyIndex + 1} (${power})`);
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
                this.defenseSlots[minIndex] = {
                    level: 1,
                    contributors: [userName],
                    commandName: cmdName,
                    totalPower: power,
                    powerMap: new Map([[userName, power]])
                };
                this.log("SYNERGY", `> Защита ${cmdName} вытеснила слабейшую в D${minIndex + 1} (${power})`);
            } else {
                this.log("SYNERGY", `> Защита ${cmdName} слишком слаба (${power}) и не попала в слоты`);
            }
        }
    }

    // --- RESOLUTION PHASE (обновлена защита) ---
    private resolveTurn() {
        this.stopTimer();
        this.log("SYSTEM", "EXECUTING BUFFER...");

        // 1. Атака игроков по врагам (без изменений)
        this.attackSlots.forEach((slot, index) => {
            if (slot.level > 0) {
                const enemy = this.enemies.find(e => e.slotIndex === index);
                if (enemy) {
                    const multipliers = [0, 1.0, 1.5, 2.0, 2.6];
                    const dmg = 100 * multipliers[slot.level]; // тестовое значение, замените на реальное
                    enemy.integrity -= dmg;
                    this.log("SYSTEM", `> SLOT A${index + 1} HITS ${enemy.name} FOR ${dmg} DMG`);
                }
            }
        });

        // 2. Атака врагов по защитным слотам
        const enemyDamage = this.BASE_ENEMY_DAMAGE * this.currentHop; // урон растёт с хопом
        this.assignedDefensePlayers.forEach((playerId, index) => {
            if (!playerId) return;
            const player = this.players.get(playerId);
            if (!player) return;

            const defSlot = this.defenseSlots[index];
            let damageToPlayer = enemyDamage;

            // Если в слоте есть защита, она поглощает урон
            if (defSlot.totalPower > 0) {
                if (defSlot.totalPower >= enemyDamage) {
                    damageToPlayer = 0;
                    this.log("SYSTEM", `> D${index + 1} полностью заблокировал урон (${defSlot.totalPower} ≥ ${enemyDamage})`);
                } else {
                    damageToPlayer = enemyDamage - defSlot.totalPower;
                    this.log("SYSTEM", `> D${index + 1} частично заблокировал: урон ${damageToPlayer} (${defSlot.totalPower} < ${enemyDamage})`);
                }
            } else {
                this.log("SYSTEM", `> D${index + 1} без защиты, урон ${damageToPlayer}`);
            }

            if (damageToPlayer > 0) {
                player.integrity -= damageToPlayer;
                this.log("SYSTEM", `> ${player.name} получил ${damageToPlayer} урона`);
            }

            if (player.integrity <= 0) {
                player.state = 'terminated';
                player.integrity = 0;
                this.log("SYSTEM", `NODE ${player.name} TERMINATED.`);
            }
        });

        // 3. Очистка мёртвых врагов
        this.enemies = this.enemies.filter(e => e.integrity > 0);

        const activePlayersCount = Array.from(this.players.values())
            .filter(p => p.state !== 'terminated').length;

        // 4. Снижение latency и обработка blackout
        this.players.forEach(p => {
            if (p.state === 'active') p.latency = Math.max(0, p.latency - 15);
            else if (p.state === 'blackout') {
                p.blackoutTimer--;
                if (p.blackoutTimer <= 0) {
                    p.state = 'active';
                    p.latency = 0;
                }
            }
        });

        // 5. Переход к следующему ходу или хопу
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
                this.endGame();
                this.cleanInterface();
            } else {
                this.log("SYSTEM", `AREA CLEARED. MOVING TO HOP ${this.currentHop}...`);
                this.players.forEach(p => p.latency = Math.max(0, p.latency - 50));
                setTimeout(() => {
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

    // --- RENDERING (обновлено отображение защиты) ---
    private updateUI() {
        this.renderEnemies();
        this.renderBuffer();
        this.renderPlayers();
    }

    drawHopsLvl() {
        const elements = document.querySelectorAll<HTMLElement>('.hop');
        elements.forEach(el => {
            if (el.id == `hop-${this.currentHop}`) {
                el?.classList.add("active");
            } else {
                if (el.classList.contains("active")) el.classList.remove("active");
            }
        });
    }

    drawInterface() {
        const el = document.getElementById("general-store");
        const svg = document.getElementById("circuit-svg");
        el?.classList.remove("element-out");
        svg?.classList.remove("element-out");
        el?.classList.add("element-in");
        svg?.classList.add("element-in");
    }

    cleanInterface() {
        const el = document.getElementById("general-store");
        const svg = document.getElementById("circuit-svg");
        el?.classList.remove("element-in");
        svg?.classList.remove("element-in");
        el?.classList.add("element-out");
        svg?.classList.add("element-out");
    }

    private updateTimerUI() {
        const el = document.getElementById("timer-display");
        if (el) el.innerText = this.turnTimer.toString();
    }

    private renderEnemies() {
        const container = document.getElementById("enemy-container");
        if (!container) return;
        container.innerHTML = "";
        this.enemies.forEach(e => {
            const div = document.createElement("div");
            div.className = "enemy-slot";
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;"><span>[!] ${e.name}</span><span>${e.integrity}</span><span>${e.latency}%</span></div>
                <div style="font-size:0.8em">LINKED: A${e.slotIndex + 1}</div>
                <div class="bar-container"><div class="hp-bar" style="width:${(e.integrity)}%; background:red;"></div></div>
            `;
            container.appendChild(div);
        });
    }

    private renderBuffer() {
        // Attack Slots
        this.attackSlots.forEach((slot, i) => {
            const el = document.getElementById(`slot-a${i + 1}`);
            if (el) {
                el.className = `slot filled-${slot.level}`;
                el.innerText = `[A${i + 1}] ${slot.level > 0 ? `ATTACK X${slot.level} (${slot.totalPower})` : "EMPTY"}`;
            }
        });

        // Defense Slots (обновлено: отображаем мощность)
        this.defenseSlots.forEach((slot, i) => {
            const el = document.getElementById(`slot-d${i + 1}`);
            if (el) {
                const targetId = this.assignedDefensePlayers[i];
                const targetName = targetId ? (this.players.get(targetId)?.name || "???") : "NONE";

                el.className = `slot defense-slot filled-${slot.level}`;
                if (slot.level === 0) el.classList.add("danger");

                el.innerHTML = `
                    <span>[D${i + 1}] ${targetName}</span>
                    <span>${slot.level > 0 ? `SHIELD X${slot.level} (${slot.totalPower})` : "VULNERABLE"}</span>
                `;
            }
        });
    }

    private renderPlayers() {
        const list = document.getElementById("player-list");
        if (!list) return;

        const sorted = Array.from(this.players.values()).sort((a, b) => b.integrity - a.integrity);
        list.innerHTML = "";
        sorted.forEach(p => {
            const div = document.createElement("div");
            div.className = `player-card ${p.state}`;
            let status = p.state === 'active' ? '' : `[${p.state.toUpperCase()}]`;
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span>${p.name} ${status}</span>
                    <span>${p.latency}ms</span>
                    <span>${p.integrity}%</span>
                </div>
            `;
            list.appendChild(div);
        });
    }

    //метод должен отрисовывать окно "подключения" пользователя к текущей игре("сессии взлома" или какоенибудь лорное название)
    //окно должно появляться в таком месте чтобы не перекрывать экран стрима, буквально на 2-4 секунды.
    //внутри должен отрабатываться какойто сценарий в духе олдскул хакерской фигни, с поправкой на текущую игру.
    // несколько сообщений, полоса загрузки, асции картинка, можно сделать несколько сценариев и между ними переключаться чтобы не показывалось одно и то же.
    //также необходимо изменить все другие методы которые вызывают обновление ингтерфейса и добавить там проверку - если игрок только что присоединился - отрисовывать окно
    //если уже был - не рисовать 
    // private renderNewPlayerJoining(player: Player) {
    //     // Создаём контейнер
    //     const container = document.createElement('div');
    //     container.id = 'player-join-notification';
    //     container.style.position = 'fixed';
    //     container.style.bottom = '20px';
    //     container.style.right = '20px';
    //     container.style.width = '300px';
    //     container.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    //     container.style.border = '2px solid #0f0';
    //     container.style.color = '#0f0';
    //     container.style.fontFamily = 'Courier New, monospace';
    //     container.style.padding = '10px';
    //     container.style.zIndex = '9999';
    //     container.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';
    //     container.style.overflow = 'hidden';
    //     container.style.opacity = '0';
    //     container.style.transition = 'opacity 0.3s';

    //     // Несколько сценариев (ASCII + сообщения)
    //     const scenarios = [
    //         {
    //             ascii: [
    //                 "    _____",
    //                 "   /     \\",
    //                 "   | () |",
    //                 "    \\___/   ",
    //                 "   CONNECT"
    //             ],
    //             messages: [
    //                 "> ESTABLISHING SECURE LINK...",
    //                 "> HANDSHAKE PROTOCOL v2.3",
    //                 "> AUTHENTICATING NODE...",
    //                 `> ACCESS GRANTED: ${player.name}`,
    //                 "> SYNC COMPLETE."
    //             ]
    //         },
    //         {
    //             ascii: [
    //                 "   ╔════════╗",
    //                 "   ║ █▀▀ █▀▀ ║",
    //                 "   ║ █▀▀ ▀▀█ ║",
    //                 "   ╚════════╝",
    //                 "  TERMINAL"
    //             ],
    //             messages: [
    //                 "> INITIALIZING UPLINK...",
    //                 "> DECRYPTING SESSION KEY",
    //                 "> BYPASSING FIREWALL...",
    //                 `> NODE ${player.name} ONLINE`,
    //                 "> READY."
    //             ]
    //         },
    //         {
    //             ascii: [
    //                 "  ┌─┐┌─┐┌┬┐┌─┐",
    //                 "  │  │ │ ││├┤ ",
    //                 "  └─┘└─┘─┴┘└─┘",
    //                 "  CYPHER"
    //             ],
    //             messages: [
    //                 "> WAKING UP NEURAL INTERFACE...",
    //                 "> LOADING CHAOS DRIVER...",
    //                 `> ESTABLISHING LINK WITH ${player.name}`,
    //                 "> ENCRYPTION: 4096-bit RSA",
    //                 "> CONNECTION STABLE."
    //             ]
    //         }
    //     ];

    //     const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

    //     // ASCII art
    //     const asciiDiv = document.createElement('pre');
    //     asciiDiv.style.margin = '0 0 10px 0';
    //     asciiDiv.style.fontSize = '10px';
    //     asciiDiv.style.lineHeight = '1.2';
    //     asciiDiv.style.textAlign = 'center';
    //     asciiDiv.innerText = scenario.ascii.join('\n');
    //     container.appendChild(asciiDiv);

    //     // Область сообщений
    //     const msgDiv = document.createElement('div');
    //     msgDiv.style.marginBottom = '10px';
    //     msgDiv.style.minHeight = '80px';
    //     container.appendChild(msgDiv);

    //     // Прогресс-бар
    //     const progressContainer = document.createElement('div');
    //     progressContainer.style.width = '100%';
    //     progressContainer.style.height = '10px';
    //     progressContainer.style.backgroundColor = '#003300';
    //     progressContainer.style.border = '1px solid #0f0';
    //     progressContainer.style.marginTop = '10px';
    //     const progressBar = document.createElement('div');
    //     progressBar.style.width = '0%';
    //     progressBar.style.height = '100%';
    //     progressBar.style.backgroundColor = '#0f0';
    //     progressBar.style.transition = 'width 2s linear';
    //     progressContainer.appendChild(progressBar);
    //     container.appendChild(progressContainer);

    //     document.body.appendChild(container);

    //     // Анимация появления
    //     setTimeout(() => { container.style.opacity = '1'; }, 10);

    //     // Поэтапное отображение сообщений
    //     let msgIndex = 0;
    //     const interval = setInterval(() => {
    //         if (msgIndex < scenario.messages.length) {
    //             const line = document.createElement('div');
    //             line.innerText = scenario.messages[msgIndex];
    //             line.style.marginBottom = '2px';
    //             line.style.opacity = '0';
    //             line.style.transition = 'opacity 0.3s';
    //             msgDiv.appendChild(line);
    //             setTimeout(() => { line.style.opacity = '1'; }, 10);
    //             msgIndex++;
    //         } else {
    //             clearInterval(interval);
    //         }
    //     }, 500);

    //     // Запускаем прогресс-бар
    //     setTimeout(() => {
    //         progressBar.style.width = '100%';
    //     }, 100);

    //     // Удаляем окно через 4 секунды
    //     setTimeout(() => {
    //         container.style.opacity = '0';
    //         setTimeout(() => {
    //             if (container.parentNode) container.parentNode.removeChild(container);
    //         }, 300);
    //     }, 4000);
    // }

    private renderNewPlayerJoining(player: Player) {
    // Создаём контейнер
    const container = document.createElement('div');
    container.id = 'player-join-notification';
    container.style.position = 'fixed';
    container.style.width = '25vw';
    container.style.maxWidth = '300px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    container.style.border = '2px solid #0f0';
    container.style.color = '#0f0';
    container.style.fontFamily = 'Courier New, monospace';
    container.style.padding = '10px';
    container.style.zIndex = '9999';
    container.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';
    container.style.overflow = 'hidden';
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.3s';
    container.style.boxSizing = 'border-box';

    // Несколько сценариев (ASCII + сообщения)
    const scenarios = [
        {
            ascii: [
                "    _____",
                "   /     \\",
                "   | () |",
                "    \\___/   ",
                "   CONNECT"
            ],
            messages: [
                "> ESTABLISHING SECURE LINK...",
                "> HANDSHAKE PROTOCOL v2.3",
                "> AUTHENTICATING NODE...",
                `> ACCESS GRANTED: ${player.name}`,
                "> SYNC COMPLETE."
            ]
        },
        {
            ascii: [
                "   ╔════════╗",
                "   ║ █▀▀ █▀▀ ║",
                "   ║ █▀▀ ▀▀█ ║",
                "   ╚════════╝",
                "  TERMINAL"
            ],
            messages: [
                "> INITIALIZING UPLINK...",
                "> DECRYPTING SESSION KEY",
                "> BYPASSING FIREWALL...",
                `> NODE ${player.name} ONLINE`,
                "> READY."
            ]
        },
        {
            ascii: [
                "  ┌─┐┌─┐┌┬┐┌─┐",
                "  │  │ │ ││├┤ ",
                "  └─┘└─┘─┴┘└─┘",
                "  CYPHER"
            ],
            messages: [
                "> WAKING UP NEURAL INTERFACE...",
                "> LOADING CHAOS DRIVER...",
                `> ESTABLISHING LINK WITH ${player.name}`,
                "> ENCRYPTION: 4096-bit RSA",
                "> CONNECTION STABLE."
            ]
        }
    ];

    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

    // ASCII art
    const asciiDiv = document.createElement('pre');
    asciiDiv.style.margin = '0 0 10px 0';
    asciiDiv.style.fontSize = 'clamp(8px, 2vw, 12px)';
    asciiDiv.style.lineHeight = '1.2';
    asciiDiv.style.textAlign = 'center';
    asciiDiv.style.whiteSpace = 'pre-wrap';
    asciiDiv.style.wordBreak = 'break-all';
    asciiDiv.innerText = scenario.ascii.join('\n');
    container.appendChild(asciiDiv);

    // Область сообщений
    const msgDiv = document.createElement('div');
    msgDiv.style.marginBottom = '10px';
    msgDiv.style.minHeight = '60px';
    msgDiv.style.fontSize = 'clamp(10px, 2.5vw, 14px)';
    container.appendChild(msgDiv);

    // Создаём все строки сообщений заранее, но скрытыми (opacity 0)
    const messageLines: HTMLDivElement[] = [];
    scenario.messages.forEach(msg => {
        const line = document.createElement('div');
        line.innerText = msg;
        line.style.marginBottom = '2px';
        line.style.opacity = '0';
        line.style.transition = 'opacity 0.3s';
        msgDiv.appendChild(line);
        messageLines.push(line);
    });

    // Прогресс-бар
    const progressContainer = document.createElement('div');
    progressContainer.style.width = '100%';
    progressContainer.style.height = '8px';
    progressContainer.style.backgroundColor = '#003300';
    progressContainer.style.border = '1px solid #0f0';
    progressContainer.style.marginTop = '10px';
    const progressBar = document.createElement('div');
    progressBar.style.width = '0%';
    progressBar.style.height = '100%';
    progressBar.style.backgroundColor = '#0f0';
    progressBar.style.transition = 'width 2s linear';
    progressContainer.appendChild(progressBar);
    container.appendChild(progressContainer);

    // Добавляем контейнер в DOM (пока невидимый)
    document.body.appendChild(container);

    // Получаем размеры контейнера и окна
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Случайный выбор стороны
    const sides = ['left', 'right', 'top', 'bottom'];
    const selectedSide = sides[Math.floor(Math.random() * sides.length)];

    // Функция для ограничения значения в пределах [min, max]
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    // Устанавливаем позицию в зависимости от стороны со случайным смещением
    switch (selectedSide) {
        case 'left':
            container.style.left = '20px';
            // Случайная позиция по вертикали с учётом высоты контейнера
            let randomTopLeft = Math.random() * (windowHeight - containerHeight);
            randomTopLeft = clamp(randomTopLeft, 0, windowHeight - containerHeight);
            container.style.top = randomTopLeft + 'px';
            break;
        case 'right':
            container.style.right = '20px';
            let randomTopRight = Math.random() * (windowHeight - containerHeight);
            randomTopRight = clamp(randomTopRight, 0, windowHeight - containerHeight);
            container.style.top = randomTopRight + 'px';
            break;
        case 'top':
            container.style.top = '20px';
            let randomLeftTop = Math.random() * (windowWidth - containerWidth);
            randomLeftTop = clamp(randomLeftTop, 0, windowWidth - containerWidth);
            container.style.left = randomLeftTop + 'px';
            break;
        case 'bottom':
            container.style.bottom = '20px';
            let randomLeftBottom = Math.random() * (windowWidth - containerWidth);
            randomLeftBottom = clamp(randomLeftBottom, 0, windowWidth - containerWidth);
            container.style.left = randomLeftBottom + 'px';
            break;
    }

    // Анимация появления
    setTimeout(() => { container.style.opacity = '1'; }, 10);

    // Поэтапное отображение сообщений (делаем их видимыми)
    let msgIndex = 0;
    const interval = setInterval(() => {
        if (msgIndex < messageLines.length) {
            messageLines[msgIndex].style.opacity = '1';
            msgIndex++;
        } else {
            clearInterval(interval);
        }
    }, 500);

    // Запускаем прогресс-бар
    setTimeout(() => {
        progressBar.style.width = '100%';
    }, 100);

    // Удаляем окно через 4 секунды
    setTimeout(() => {
        container.style.opacity = '0';
        setTimeout(() => {
            if (container.parentNode) container.parentNode.removeChild(container);
        }, 300);
    }, 4000);
}

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
}