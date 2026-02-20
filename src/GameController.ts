import { CommandMap, ParametersMap } from "./Commands";
import { AttackType, PlayerState } from "./Entities";
import { EnemyManager, PlayerManager, SlotManager } from "./Managers";
import { UIManager } from "./UiManagers";

export class GameLogger {
    logSystem(msg: string): void {
        this.log('SYSTEM', msg);
    }

    logSynergy(msg: string): void {
        this.log('SYNERGY', msg);
    }

    private log(type: string, msg: string): void {
        const div = document.getElementById(type === 'SYSTEM' ? 'system-log' : 'synergy-log');
        if (div) {
            div.innerHTML += `<div>[${type}] ${msg}</div>`;
            div.scrollTop = div.scrollHeight;
        }
    }

    rawInput(user: string, cmd: string): void {
        const list = document.getElementById('raw-pool');
        if (list) {
            const el = document.createElement('div');
            el.className = 'pool-item';
            el.innerText = `> [${user}]: ${cmd}`;
            list.appendChild(el);
            list.scrollTop = list.scrollHeight;
        }
    }
}

export class GameTimer {
    private interval: any = null;
    private _seconds: number = 15;
    public onTick: (seconds: number) => void = () => {};
    public onFinish: () => void = () => {};

    start(initialSeconds: number = 15): void {
        this.stop();
        this._seconds = initialSeconds;
        this.onTick(this._seconds);
        this.interval = setInterval(() => {
            this._seconds--;
            this.onTick(this._seconds);
            if (this._seconds <= 0) {
                this.stop();
                this.onFinish();
            }
        }, 1000);
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    get seconds(): number {
        return this._seconds;
    }
}

export class TurnResolver {
    constructor(
        private playerManager: PlayerManager,
        private enemyManager: EnemyManager,
        private slotManager: SlotManager,
        private logger: GameLogger,
        private config: {
            latencyThreshold: number;
            blackoutDuration: number;
            baseEnemyDamage: number;
        }
    ) {}

    resolve(hop: number, onHopComplete: () => void, onGameOver: () => void): void {
        this.logger.logSystem('EXECUTING BUFFER...');

        // Фаза 1: Атака игроков по врагам
        this.slotManager.attackSlots.forEach((slot, index) => {
            if (!slot.isEmpty()) {
                const enemy = this.enemyManager.alive.find(e => e.slotIndex === index);
                if (enemy) {
                    const multipliers = [0, 1.0, 1.2, 1.5, 2.0];
                    const slotMultiplier = multipliers[slot.level] || 1.0;
                    const damage = Math.floor(slot.totalPower * slotMultiplier);
                    enemy.takeDamage(damage);
                    this.logger.logSystem(`> SLOT A${index + 1} HITS ${enemy.name} FOR ${damage} DMG (${slot.totalPower} * ${slotMultiplier})`);
                }
            }
        });

        const killed = this.enemyManager.alive.filter(e => !e.isAlive());
        killed.forEach(e => this.logger.logSystem(`> ${e.name} DESTROYED.`));
        this.enemyManager.clearDead();

        // Фаза 2: Атака врагов по защитным слотам
        const attackCommands = CommandMap.filter(cmd => cmd.tags.has('атакующая'));
        const activePlayersCount = this.playerManager.activePlayers.length;

        this.enemyManager.alive.forEach(enemy => {
            if (attackCommands.length === 0) return;

            const cmd = attackCommands[Math.floor(Math.random() * attackCommands.length)];
            let damage = cmd.basePower;

            const hopMultiplier = 0.8 + 0.2 * hop;
            const playerMultiplier = 1 + 0.1 * activePlayersCount;
            damage = Math.floor(damage * hopMultiplier * playerMultiplier);

            let paramUsed = '';
            if (Math.random() < 0.3 && ParametersMap.length > 0) {
                const param = ParametersMap[Math.floor(Math.random() * ParametersMap.length)];
                damage = Math.floor(damage * param.multiplier);
                paramUsed = ` with ${param.name}`;
            }

            this.logger.logSystem(`> ${enemy.name} uses ${cmd.name}${paramUsed} for ${damage} damage`);

            if (enemy.attackType === AttackType.AOE) {
                for (let slot = 0; slot < 4; slot++) {
                    this.applyEnemyAttackToSlot(slot, damage, enemy.name);
                }
            } else {
                const targetSlot = Math.floor(Math.random() * 4);
                this.applyEnemyAttackToSlot(targetSlot, damage, enemy.name);
            }
        });

        this.awardContributions();

        this.playerManager.updateAll(player => {
            if (player.state === PlayerState.ACTIVE) {
                player.reduceLatency(15);
            }
            player.updateBlackout();
        });

        if (this.playerManager.activePlayers.length === 0) {
            this.logger.logSystem('GAME OVER. ALL NODES TERMINATED.');
            onGameOver();
            return;
        }

        if (this.enemyManager.alive.length === 0) {
            onHopComplete();
        }
        // Если враги ещё есть, ход завершён, следующий запустится по таймеру (внешний код)
    }

    private applyEnemyAttackToSlot(slotIndex: number, damage: number, attackerName: string): void {
        const defenseSlot = this.slotManager.defenseSlots[slotIndex];
        const playerId = defenseSlot.assignedPlayerId;
        if (!playerId) {
            this.logger.logSystem(`> ${attackerName} attacks D${slotIndex + 1} but no player assigned.`);
            return;
        }

        const player = this.playerManager.getPlayer(playerId);
        if (!player || player.isTerminated()) return;

        let damageToPlayer = damage;
        if (!defenseSlot.isEmpty()) {
            if (defenseSlot.totalPower >= damage) {
                damageToPlayer = 0;
                this.logger.logSystem(`> D${slotIndex + 1} fully blocked ${attackerName}'s attack (${defenseSlot.totalPower} ≥ ${damage})`);
            } else {
                damageToPlayer = damage - defenseSlot.totalPower;
                this.logger.logSystem(`> D${slotIndex + 1} partially blocked: ${damageToPlayer} dmg from ${attackerName} (${defenseSlot.totalPower} < ${damage})`);
            }
        } else {
            this.logger.logSystem(`> D${slotIndex + 1} has no defense, takes ${damageToPlayer} dmg from ${attackerName}`);
        }

        if (damageToPlayer > 0) {
            player.takeDamage(damageToPlayer);
            this.logger.logSystem(`> ${player.name} took ${damageToPlayer} damage from ${attackerName}`);
            if (player.isTerminated()) {
                this.logger.logSystem(`NODE ${player.name} TERMINATED.`);
            }
        }
    }

    private awardContributions(): void {
        this.slotManager.getNonEmptyAttackSlots().forEach(slot => {
            slot.powerMap.forEach((power, userId) => {
                const points = Math.floor(power / 10);
                if (points > 0) {
                    this.playerManager.awardContribution(userId, points);
                    const player = this.playerManager.getPlayer(userId);
                    this.logger.logSystem(`> Игрок ${player?.name} получает ${points} очков за атаку (вклад ${power})`);
                }
            });
        });

        this.slotManager.getNonEmptyDefenseSlots().forEach(slot => {
            slot.powerMap.forEach((power, userId) => {
                const points = Math.floor(power / 10);
                if (points > 0) {
                    this.playerManager.awardContribution(userId, points);
                    const player = this.playerManager.getPlayer(userId);
                    this.logger.logSystem(`> Игрок ${player?.name} получает ${points} очков за защиту (вклад ${power})`);
                }
            });
        });
    }
}


// =====================================================
// 5. Главный контроллер игры — исправлен, добавлено управление таймаутами
// =====================================================

export class GameController {
    private readonly LATENCY_THRESHOLD = 50;
    private readonly BLACKOUT_DURATION = 2;
    private readonly BASE_ENEMY_DAMAGE = 30;
    private readonly PREP_DURATION_MS = 5000;
    private readonly RESULT_DURATION_MS = 7000;

    public isGameRunning: boolean = false;
    public isPrepStage: boolean = false;
    private currentHop: number = 1;

    private playerManager: PlayerManager;
    private enemyManager: EnemyManager;
    private slotManager: SlotManager;
    private logger: GameLogger;
    private timer: GameTimer;
    private resolver: TurnResolver;
    private ui: UIManager;

    // Храним все активные таймауты, чтобы очищать при сбросе
    private timeouts: number[] = [];

    constructor() {
        this.playerManager = new PlayerManager();
        this.enemyManager = new EnemyManager();
        this.slotManager = new SlotManager();
        this.logger = new GameLogger();
        this.timer = new GameTimer();
        this.ui = new UIManager(
            this.playerManager,
            this.enemyManager,
            this.slotManager,
            this.logger,
            this.PREP_DURATION_MS,
            this.RESULT_DURATION_MS
        );
        this.resolver = new TurnResolver(
            this.playerManager,
            this.enemyManager,
            this.slotManager,
            this.logger,
            {
                latencyThreshold: this.LATENCY_THRESHOLD,
                blackoutDuration: this.BLACKOUT_DURATION,
                baseEnemyDamage: this.BASE_ENEMY_DAMAGE
            }
        );

        this.timer.onTick = (sec) => this.ui.updateTimer(sec);
        this.timer.onFinish = () => this.resolveTurn();
    }

    // Очистка всех таймаутов
    private clearAllTimeouts(): void {
        this.timeouts.forEach(id => clearTimeout(id));
        this.timeouts = [];
    }

    private setTimeout(callback: () => void, delay: number): void {
        const id = window.setTimeout(() => {
            // Удаляем ID из массива после выполнения
            this.timeouts = this.timeouts.filter(tid => tid !== id);
            callback();
        }, delay);
        this.timeouts.push(id);
    }

    public prepareGame(): void {
        console.log('prepareGame');
        this.ui.hideResultIfVisible();
        this.resetGame();
        this.ui.showIntro(() => {
            this.isPrepStage = false;
            if (this.playerManager.size === 0) {
                this.logger.logSystem('NO NODES DETECTED. ABORTING MISSION.');
                this.isGameRunning = false;
                return;
            }
            this.startGame();
        });
        this.isGameRunning = true;
        this.isPrepStage = true;
    }

    public addPlayer(userId: string, userName: string): void {
        const player = this.playerManager.addPlayer(userId, userName);
        // Показываем уведомление только если игра уже идёт (не подготовка)
        if (this.isGameRunning && !this.isPrepStage) {
            this.ui.showPlayerJoined(player);
        }
    }

    public handleInput(userId: string, userName: string, text: string): void {
        if (!this.isGameRunning || this.isPrepStage) return;

        const player = this.playerManager.getPlayer(userId);
        if (!player) {
            this.addPlayer(userId, userName);
            // повторно получаем
            const newPlayer = this.playerManager.getPlayer(userId);
            if (!newPlayer) return;
        }

        if (!player!.isActive()) return;
        if (player!.latency >= this.LATENCY_THRESHOLD) return;

        const words = text.trim().split(/\s+/);
        if (words.length === 0) return;

        let rawCommand = words[0];
        if (rawCommand.startsWith('!')) rawCommand = rawCommand.substring(1);

        const commandDef = CommandMap.find(cmd => cmd.name === rawCommand);
        if (!commandDef) return;

        const isDefense = commandDef.isDefense();

        let totalMultiplier = 1.0;
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

        if (isDefense) {
            this.slotManager.addDefenseCommand(commandDef.name, finalPower, userId, userName, targetDefenseSlot);
            this.logger.logSynergy(`> Защита ${commandDef.name} (${finalPower}) обработана.`);
        } else {
            this.slotManager.addAttackCommand(commandDef.name, finalPower, userId, userName);
            this.logger.logSynergy(`> Атака ${commandDef.name} (${finalPower}) обработана.`);
        }

        const latencyIncrease = Math.floor(finalPower / 10) + 1;
        player!.increaseLatency(latencyIncrease, this.LATENCY_THRESHOLD, this.BLACKOUT_DURATION);
        this.logger.logSystem(`> Игроку ${userName} начислена задержка +${latencyIncrease} (теперь ${player!.latency})`);

        if (player!.latency >= this.LATENCY_THRESHOLD && player!.state === PlayerState.BLACKOUT) {
            this.logger.logSystem(`> Игрок ${userName} перегрелся и ушёл в blackout на ${this.BLACKOUT_DURATION} хода`);
        }

        this.ui.renderAll();
        this.logger.rawInput(userName, text);
    }

    private resetGame(): void {
        // Останавливаем все таймеры и таймауты
        this.timer.stop();
        this.clearAllTimeouts();

        // Очищаем менеджеры
        this.playerManager.clear();
        this.enemyManager.clear();
        this.slotManager.reset();

        this.currentHop = 1;
        this.ui.hideInterface();
        this.clearLogs();
        this.ui.setCurrentHop(1);
        this.ui.renderAll();
    }

    private clearLogs(): void {
        const sys = document.getElementById('system-log');
        const syn = document.getElementById('synergy-log');
        const raw = document.getElementById('raw-pool');
        if (sys) sys.innerHTML = '';
        if (syn) syn.innerHTML = '';
        if (raw) raw.innerHTML = '';
    }

    private startGame(): void {
        this.isGameRunning = true;
        this.ui.showInterface();
        this.ui.setCurrentHop(this.currentHop);
        this.spawnEnemies();
        this.startTurn();
        this.logger.logSystem('INFILTRATION STARTED. HOP 1 REACHED.');
    }

    private spawnEnemies(): void {
        this.enemyManager.spawnForHop(this.currentHop, this.playerManager.activePlayers.length);
        this.ui.renderEnemies();
    }

    private startTurn(): void {
        // Если игра уже не запущена, не начинаем новый ход
        if (!this.isGameRunning) return;

        this.slotManager.reset();
        const targets = this.playerManager.getRandomActivePlayers(4);
        this.slotManager.assignDefenseTargets(targets);
        this.timer.start(15);
        this.ui.renderAll();
    }

    private resolveTurn(): void {
        // Если игра завершена, ничего не делаем
        if (!this.isGameRunning) return;

        this.timer.stop();
        this.resolver.resolve(
            this.currentHop,
            () => this.advanceHop(),
            () => this.endGame()
        );
        this.ui.renderAll();

        // Если враги ещё есть и игра продолжается, планируем следующий ход
        if (this.enemyManager.alive.length > 0 && this.isGameRunning) {
            this.setTimeout(() => this.startTurn(), 2000);
        }
    }

    private advanceHop(): void {
        // Если игра уже не запущена, не продолжаем
        if (!this.isGameRunning) return;

        this.currentHop++;
        if (this.currentHop > 4) {
            this.logger.logSystem('MAINFRAME BREACHED. MISSION SUCCESS.');
            this.endGame();
            return;
        }

        this.logger.logSystem(`AREA CLEARED. MOVING TO HOP ${this.currentHop}...`);
        this.playerManager.updateAll(p => {
            if (!p.isTerminated()) {
                p.reduceLatency(50);
            }
        });
        this.ui.setCurrentHop(this.currentHop);
        this.setTimeout(() => {
            this.spawnEnemies();
            this.startTurn();
        }, 3000);
    }

    private endGame(): void {
        // Останавливаем всё
        this.timer.stop();
        this.clearAllTimeouts();
        this.isGameRunning = false;
        this.ui.hideInterface();
        this.ui.showResult();
    }
}





