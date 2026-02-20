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
    //масиив игроков также должен содержать вклад игрока в текущей игре
    //если игрок "умер" то его вклад перестает учитываться в финальном рассчете мест, только если он в моменте не использовал возможность вернуться в игру(через какуюто команду)
    //команда безлимитная, ограничиваться будет в самом твиче(типа баллы канала условные).
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
    private readonly LATENCY_THRESHOLD = 50;
    private readonly BLACKOUT_DURATION = 2;          // как в исходном коде
    private readonly BASE_ENEMY_DAMAGE = 30;          // базовый урон врага (можно менять от хопа)

    private introContainer: HTMLElement | null = null;
    private resultContainer: HTMLElement | null = null;

    private readonly PREP_DURATION_MS: number = 5000;   // длительность подготовительного этапа
    private readonly RESULT_DURATION_MS: number = 7000; // время показа окна результатов (можно изменить отдельно)

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
        console.log("prepareGame");

        // Если висит окно результата, убираем его
        if (this.resultContainer) {
            this.resultContainer.remove();
            this.resultContainer = null;
        }

        this.resetGame();
        this.showIntro();  // <-- добавлено
        this.isGameRunning = true;
        this.isPrepStage = true;
        setTimeout(() => {
            this.isPrepStage = false;
            this.hideIntro();    // <-- скрываем окно вступления
            if (this.players.size == 0) {
                this.log("SYSTEM", "NO NODES DETECTED. ABORTING MISSION.");
                this.isGameRunning = false;
                return;
            }

            this.startGame();
            this.log("SYSTEM", "INFILTRATION STARTED. HOP 1 REACHED.");
            console.log("interval triggered")
        }, this.PREP_DURATION_MS);
    }

    //метод должен отрисовывать чтото вроде стартового окна для игры, до отрисовки основного интерфейса, стилизованное под олдскульный хакерский терминал, 
    // который какбы инициализирует соединение  с защищенным архивом или удаленным сервером(придумать).
    //пока идет условная загрузка - массив игроков наполняется написавшими в чат.
    //длина загрузки должна равняться длине таймаута из метода  prepareGame() (если нужно можно изменить prepareGame)
    private showIntro() {
        // Удаляем предыдущее окно, если есть
        if (this.introContainer) this.introContainer.remove();

        const container = document.createElement('div');
        container.id = 'intro-terminal';
        container.style.position = 'fixed';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.width = 'min(80vw, 600px)';
        container.style.backgroundColor = '#0a0f0a';
        container.style.border = '3px solid #0f0';
        container.style.borderRadius = '5px';
        container.style.color = '#0f0';
        container.style.fontFamily = '"Courier New", monospace';
        container.style.padding = '20px';
        container.style.zIndex = '10000';
        container.style.boxShadow = '0 0 30px #0f0';
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.5s';

        // ASCII-art заголовок
        const ascii = `
    ╔══════════════════════════════╗
    ║  ██╗  ██╗ █████╗  ██████╗██╗ ██╗███████╗██████╗  ║
    ║  ██║  ██║██╔══██╗██╔════╝██║ ██║██╔════╝██╔══██╗ ║
    ║  ███████║███████║██║     ███████║█████╗  ██████╔╝ ║
    ║  ██╔══██║██╔══██║██║     ██╔══██║██╔══╝  ██╔══██╗ ║
    ║  ██║  ██║██║  ██║╚██████╗██║  ██║███████╗██║  ██║ ║
    ║  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ║
    ╚══════════════════════════════╝
    `;
        const pre = document.createElement('pre');
        pre.style.margin = '0 0 15px 0';
        pre.style.fontSize = 'clamp(8px, 2vw, 14px)';
        pre.style.lineHeight = '1.2';
        pre.style.textAlign = 'center';
        pre.innerText = ascii;
        container.appendChild(pre);

        // Статусные сообщения
        const msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = '20px';
        msgDiv.style.minHeight = '80px';
        container.appendChild(msgDiv);

        // Прогресс-бар
        const progressContainer = document.createElement('div');
        progressContainer.style.width = '100%';
        progressContainer.style.height = '20px';
        progressContainer.style.backgroundColor = '#003300';
        progressContainer.style.border = '1px solid #0f0';
        progressContainer.style.marginTop = '15px';
        const progressBar = document.createElement('div');
        progressBar.style.width = '0%';
        progressBar.style.height = '100%';
        progressBar.style.backgroundColor = '#0f0';
        progressBar.style.transition = `width ${this.PREP_DURATION_MS}ms linear`;
        progressContainer.appendChild(progressBar);
        container.appendChild(progressContainer);

        document.body.appendChild(container);
        this.introContainer = container;

        // Анимация появления
        setTimeout(() => { container.style.opacity = '1'; }, 10);

        // Последовательное отображение сообщений
        const messages = [
            "> INITIALIZING SECURE UPLINK...",
            "> AUTHENTICATING WITH ARCHIVE SERVER...",
            "> DECRYPTING SESSION KEY...",
            "> BYPASSING FIREWALL...",
            "> CONNECTION ESTABLISHED. AWAITING NODES..."
        ];

        let index = 0;
        const interval = setInterval(() => {
            if (index < messages.length) {
                const line = document.createElement('div');
                line.innerText = messages[index];
                line.style.opacity = '0';
                line.style.transition = 'opacity 0.3s';
                msgDiv.appendChild(line);
                setTimeout(() => line.style.opacity = '1', 10);
                index++;
            } else {
                clearInterval(interval);
            }
        }, 600);

        // Запуск прогресс-бара
        setTimeout(() => {
            progressBar.style.width = '100%';
        }, 100);
    }

    //этот метод по задумке толжен скрывать окно showIntro() когда стригерится таймаут из prepareGame(подумай как можно сделать эти 3 метода правильно)
    private hideIntro() {
        if (this.introContainer) {
            this.introContainer.style.opacity = '0';
            setTimeout(() => {
                if (this.introContainer?.parentNode) {
                    this.introContainer.remove();
                    this.introContainer = null;
                }
            }, 500);
        }
    }

    //это окно должно отрисовываться вместо интерфейса игры по ее завершению, на какоето определенное непродолжительное время.
    // внутри окна должна быть асци картинка "побежденного сервера"(предложи пару вариантов ) и таблица лидеров.
    private showResult() {
        if (this.resultContainer) this.resultContainer.remove();

        const container = document.createElement('div');
        container.id = 'result-terminal';
        container.style.position = 'fixed';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.width = 'min(80vw, 600px)';
        container.style.backgroundColor = '#0a0f0a';
        container.style.border = '3px solid #f00';
        container.style.borderRadius = '5px';
        container.style.color = '#f00';
        container.style.fontFamily = '"Courier New", monospace';
        container.style.padding = '20px';
        container.style.zIndex = '10000';
        container.style.boxShadow = '0 0 30px #f00';
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.5s';

        // Выбор случайного ASCII-арта
        const artworks = [
            // MAINFRAME BREACHED
            `
    ╔════════════════════════════╗
    ║  ╔═╗╔═╗╔╦╗╔═╗╔╗╔╔═╗╔╦╗    ║
    ║  ║ ║╠═╣ ║ ║╣ ║║║║╣  ║     ║
    ║  ╚═╝╩ ╩ ╩ ╚═╝╝╚╝╚═╝ ╩     ║
    ║        BREACHED           ║
    ╚════════════════════════════╝
        `,
            // SERVER SHUTDOWN
            `
    ┌────────────────────────────┐
    │  ░░░░░░░░░░░░░░░░░░░░░░░░  │
    │  ░█▀▀░█▀█░█▀▄░█▀▀░█░█░░░░  │
    │  ░█▀▀░█░█░█░█░█▀▀░▀▄▀░░░░  │
    │  ░▀░░░▀▀▀░▀▀░░▀▀▀░░▀░░░░░  │
    │     SHUTDOWN COMPLETE      │
    └────────────────────────────┘
        `,
            // SYSTEM PURGED
            `
    ╔════════════════════════════╗
    ║  ╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲  ║
    ║  ╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱  ║
    ║    SYSTEM PURGED           ║
    ║  ╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲  ║
    ╚════════════════════════════╝
        `
        ];
        const selectedArt = artworks[Math.floor(Math.random() * artworks.length)];

        const pre = document.createElement('pre');
        pre.style.margin = '0 0 20px 0';
        pre.style.fontSize = 'clamp(8px, 2vw, 14px)';
        pre.style.lineHeight = '1.2';
        pre.style.textAlign = 'center';
        pre.style.color = '#f00';
        pre.innerText = selectedArt;
        container.appendChild(pre);

        // Заголовок лидерборда
        const title = document.createElement('h3');
        title.innerText = '> TOP NODES CONTRIBUTION <';
        title.style.textAlign = 'center';
        title.style.margin = '10px 0';
        title.style.color = '#f00';
        container.appendChild(title);

        // Таблица лидеров
        const leaderList = document.createElement('div');
        leaderList.style.marginTop = '15px';
        leaderList.style.maxHeight = '200px';
        leaderList.style.overflowY = 'auto';
        leaderList.style.borderTop = '1px solid #f00';
        leaderList.style.borderBottom = '1px solid #f00';
        leaderList.style.padding = '5px 0';

        // Сортируем игроков по contribution (убывание)
        const sortedPlayers = Array.from(this.players.values())
            .sort((a, b) => b.contribution - a.contribution);

        sortedPlayers.forEach((p, idx) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.padding = '2px 10px';
            row.style.color = idx === 0 ? '#ff0' : '#f00';
            row.innerHTML = `<span>${idx + 1}. ${p.name}</span><span>⭐ ${p.contribution}</span>`;
            leaderList.appendChild(row);
        });

        container.appendChild(leaderList);

        // Кнопка закрытия (опционально)
        // const closeBtn = document.createElement('button');
        // closeBtn.innerText = '[ CLOSE ]';
        // closeBtn.style.background = 'none';
        // closeBtn.style.border = '1px solid #f00';
        // closeBtn.style.color = '#f00';
        // closeBtn.style.fontFamily = 'inherit';
        // closeBtn.style.padding = '5px 15px';
        // closeBtn.style.marginTop = '20px';
        // closeBtn.style.cursor = 'pointer';
        // closeBtn.style.display = 'block';
        // closeBtn.style.marginLeft = 'auto';
        // closeBtn.style.marginRight = 'auto';
        // closeBtn.onclick = () => {
        //     if (this.resultContainer) {
        //         this.resultContainer.style.opacity = '0';
        //         setTimeout(() => this.resultContainer?.remove(), 500);
        //         this.resultContainer = null;
        //     }
        // };
        // container.appendChild(closeBtn);

        document.body.appendChild(container);
        this.resultContainer = container;

        // Анимация появления
        setTimeout(() => { container.style.opacity = '1'; }, 10);

        // Автоматическое закрытие через 7 секунд
        setTimeout(() => {
            if (this.resultContainer) {
                this.resultContainer.style.opacity = '0';
                setTimeout(() => {
                    if (this.resultContainer?.parentNode) {
                        this.resultContainer.remove();
                        this.resultContainer = null;
                    }
                }, 500);
            }
        }, this.RESULT_DURATION_MS);
    }

    addPlayer(userId: any, userName: any) {
        let player = this.players.get(userId);
        if (!player) {
            player = {
                id: userId,
                name: userName,
                integrity: 100,
                latency: 0,
                state: 'active',
                blackoutTimer: 0,
                contribution: 0  // <-- ДОБАВЛЕНО
            };
            this.players.set(userId, player);
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
        const playerCount = this.players.size; // можно заменить на количество активных, если нужно
        const count = this.currentHop === 4 ? 1 : Math.min(3, Math.ceil(Math.random() * 3));

        for (let i = 0; i < count; i++) {
            const isBoss = (this.currentHop === 4);
            let name: string;
            let baseHP: number;
            let baseDamage: number;

            if (isBoss) {
                name = "LEGACY_MAINFRAME";
                baseHP = 500 + 50 * playerCount;
                baseDamage = 60 + 10 * playerCount;
            } else {
                name = `DAEMON_v${this.currentHop}.${i}`;
                baseHP = 150 + 20 * playerCount;
                baseDamage = 30 + 5 * playerCount;
            }

            this.enemies.push({
                id: `mob_${Date.now()}_${i}`,
                name: name,
                integrity: baseHP,
                maxIntegrity: baseHP,      // новое поле
                latency: 200,
                slotIndex: i,
                baseDamage: baseDamage,    // новое поле
                attackType: isBoss ? 'aoe' : 'single' // новое поле
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
        this.showResult();   // <-- добавлено
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
    //необходимо изменить метод, чтобы он добавлял в команду игроков контрибуторов и также рассчитывал вес для каждого игрока контрибутора, 
    // например если ты - сощздатель - у тебя всегда был самый большой вес
    //если ты увеличил своей командой счетчтк комбо и сила твоей команды была выше - то твой вес становится самвым большим
    //этот вес будет учавствовать в финальном рассчете очков 
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
        const isDefense = commandDef.tags.has('защитная');

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
            this.processDefenseCommand(commandDef.name, finalPower, userId, userName, targetDefenseSlot);
        } else {
            this.processAttackCommand(commandDef.name, finalPower, userId, userName);
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

    private processAttackCommand(cmdName: string, power: number, userId: string, userName: string) {
        const existingSlotIndex = this.attackSlots.findIndex(slot => slot.commandName === cmdName);
        if (existingSlotIndex !== -1) {
            const slot = this.attackSlots[existingSlotIndex];
            slot.totalPower += power;
            const currentContrib = slot.powerMap.get(userId) || 0;      // <-- ключ userId
            slot.powerMap.set(userId, currentContrib + power);          // <-- ключ userId
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
                powerMap: new Map([[userId, power]])
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
                powerMap: new Map([[userId, power]])
            };
            this.log("SYNERGY", `> Атака ${cmdName} вытеснила слабейшую в A${minIndex + 1} (${power})`);
        } else {
            this.log("SYNERGY", `> Атака ${cmdName} слишком слаба (${power}) и не попала в слоты`);
        }
    }

    // Обработка защитных команд
    private processDefenseCommand(cmdName: string, power: number, userId: string, userName: string, targetSlot: number | null) {
        if (targetSlot !== null) {
            // Целевой слот указан
            if (targetSlot < 0 || targetSlot >= this.defenseSlots.length) return;
            const slot = this.defenseSlots[targetSlot];
            if (slot.commandName === cmdName) {
                // Слияние
                slot.totalPower += power;
                const currentContrib = slot.powerMap.get(userId) || 0;
                slot.powerMap.set(userId, currentContrib + power);
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
                    powerMap: new Map([[userId, power]])
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
                        powerMap: new Map([[userId, power]])
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
                const currentContrib = slot.powerMap.get(userId) || 0;
                slot.powerMap.set(userId, currentContrib + power);
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
                    powerMap: new Map([[userId, power]])
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
                    powerMap: new Map([[userId, power]])
                };
                this.log("SYNERGY", `> Защита ${cmdName} вытеснила слабейшую в D${minIndex + 1} (${power})`);
            } else {
                this.log("SYNERGY", `> Защита ${cmdName} слишком слаба (${power}) и не попала в слоты`);
            }
        }
    }

    private awardContributions() {
        // Начисление за атаку
        this.attackSlots.forEach(slot => {
            if (slot.totalPower > 0) {
                slot.powerMap.forEach((power, userId) => {
                    const player = this.players.get(userId);
                    if (player) {
                        const points = Math.floor(power / 10);  // 1 очко за каждые 10 мощности
                        if (points > 0) {
                            player.contribution += points;
                            this.log("SYSTEM", `> Игрок ${player.name} получает ${points} очков за атаку (вклад ${power})`);
                        }
                    }
                });
            }
        });

        // Начисление за защиту
        this.defenseSlots.forEach(slot => {
            if (slot.totalPower > 0) {
                slot.powerMap.forEach((power, userId) => {
                    const player = this.players.get(userId);
                    if (player) {
                        const points = Math.floor(power / 10);
                        if (points > 0) {
                            player.contribution += points;
                            this.log("SYSTEM", `> Игрок ${player.name} получает ${points} очков за защиту (вклад ${power})`);
                        }
                    }
                });
            }
        });
    }

    // --- RESOLUTION PHASE (обновлена защита) ---

    //нужно изменить функцию таким образом чтобы игрокам начислялись очки за выполнение команд
    //только тем игрокам кто указан в команде как контрибутор
    // только по командам которые были записаны в слоты атаки защиты
    // необходимо также придумать, каким образом вес будет конвертироваться в очки.




    //
    private resolveTurn() {
        this.stopTimer();
        this.log("SYSTEM", "EXECUTING BUFFER...");

        // --- ФАЗА 1: АТАКА ИГРОКОВ ПО ВРАГАМ ---
        this.attackSlots.forEach((slot, index) => {
            if (slot.level > 0) {
                const enemy = this.enemies.find(e => e.slotIndex === index);
                if (enemy && enemy.integrity > 0) {
                    // Множители урона от уровня слота: 1.0, 1.2, 1.5, 2.0
                    const multipliers = [0, 1.0, 1.2, 1.5, 2.0];
                    const slotMultiplier = multipliers[slot.level] || 1.0;
                    const damage = Math.floor(slot.totalPower * slotMultiplier);
                    enemy.integrity -= damage;
                    this.log("SYSTEM", `> SLOT A${index + 1} HITS ${enemy.name} FOR ${damage} DMG (${slot.totalPower} * ${slotMultiplier})`);
                }
            }
        });

        // Удаляем убитых врагов (они не будут атаковать в этом ходу)
        const killedEnemies = this.enemies.filter(e => e.integrity <= 0);
        killedEnemies.forEach(e => this.log("SYSTEM", `> ${e.name} DESTROYED.`));
        this.enemies = this.enemies.filter(e => e.integrity > 0);

        // --- ФАЗА 2: АТАКА ВРАГОВ ПО ЗАЩИТНЫМ СЛОТАМ ---
        const attackCommands = CommandMap.filter(cmd => cmd.tags.has('атакующая'));
        const activePlayersCount = Array.from(this.players.values()).filter(p => p.state !== 'terminated').length;

        this.enemies.forEach(enemy => {
            if (attackCommands.length === 0) return;

            // Выбираем случайную атакующую команду
            const cmd = attackCommands[Math.floor(Math.random() * attackCommands.length)];

            // Базовый урон команды
            let damage = cmd.basePower;

            // Масштабирование от хопа и числа активных игроков
            const hopMultiplier = 0.8 + 0.2 * this.currentHop; // 1.0 на хопе 1, 1.4 на хопе 4
            const playerMultiplier = 1 + 0.1 * activePlayersCount; // +10% за каждого игрока
            damage = Math.floor(damage * hopMultiplier * playerMultiplier);

            // С вероятностью 30% применяем случайный параметр (множитель)
            let paramUsed = '';
            if (Math.random() < 0.3 && ParametersMap.length > 0) {
                const param = ParametersMap[Math.floor(Math.random() * ParametersMap.length)];
                damage = Math.floor(damage * param.multiplier);
                paramUsed = ` with ${param.name}`;
            }

            this.log("SYSTEM", `> ${enemy.name} uses ${cmd.name}${paramUsed} for ${damage} damage`);

            // Босс (hop 4) атакует все 4 слота, обычные мобы — один случайный
            const isBoss = (this.currentHop === 4); // или можно проверять enemy.name
            if (isBoss) {
                for (let slot = 0; slot < 4; slot++) {
                    this.applyEnemyAttackToSlot(slot, damage, enemy.name);
                }
            } else {
                const targetSlot = Math.floor(Math.random() * 4);
                this.applyEnemyAttackToSlot(targetSlot, damage, enemy.name);
            }
        });

        // Начисляем очки игрокам за использование команд в этом ходу
        this.awardContributions();

        // --- ФАЗА 3: ОБНОВЛЕНИЕ СОСТОЯНИЙ ИГРОКОВ (latency, blackout) ---
        this.players.forEach(p => {
            if (p.state === 'active') {
                p.latency = Math.max(0, p.latency - 15);
            } else if (p.state === 'blackout') {
                p.blackoutTimer--;
                if (p.blackoutTimer <= 0) {
                    p.state = 'active';
                    p.latency = 0;
                    this.log("SYSTEM", `> ${p.name} recovered from blackout.`);
                }
            }
        });

        // Проверяем, остались ли активные игроки
        const remainingActive = Array.from(this.players.values()).filter(p => p.state !== 'terminated').length;

        // --- ФАЗА 4: ПЕРЕХОД К СЛЕДУЮЩЕМУ ХОДУ / ХОПУ ---
        if (remainingActive === 0) {
            this.log("SYSTEM", "GAME OVER. ALL NODES TERMINATED.");
            this.endGame();
            return;
        }

        if (this.enemies.length === 0) {
            // Все враги убиты, переходим на новый хоп
            this.currentHop++;
            if (this.currentHop > 4) {
                this.log("SYSTEM", "MAINFRAME BREACHED. MISSION SUCCESS.");
                this.endGame();
            } else {
                this.log("SYSTEM", `AREA CLEARED. MOVING TO HOP ${this.currentHop}...`);
                // Снижаем latency у выживших (как «передышка»)
                this.players.forEach(p => {
                    if (p.state !== 'terminated') {
                        p.latency = Math.max(0, p.latency - 50);
                    }
                });
                setTimeout(() => {
                    this.drawHopsLvl();
                    this.spawnEnemies(); // новые враги с учётом текущего числа игроков
                    this.startTurn();
                }, 3000);
            }
        } else {
            // Есть живые враги — следующий ход через 2 секунды
            setTimeout(() => this.startTurn(), 2000);
        }

        this.updateUI();
    }

    /**
     * Применить атаку врага к конкретному защитному слоту.
     * @param slotIndex индекс слота (0..3)
     * @param damage урон атаки
     * @param attackerName имя врага для логов
     */
    private applyEnemyAttackToSlot(slotIndex: number, damage: number, attackerName: string) {
        const playerId = this.assignedDefensePlayers[slotIndex];
        if (!playerId) {
            this.log("SYSTEM", `> ${attackerName} attacks D${slotIndex + 1} but no player assigned.`);
            return;
        }
        const player = this.players.get(playerId);
        if (!player || player.state === 'terminated') return;

        const defSlot = this.defenseSlots[slotIndex];
        let damageToPlayer = damage;

        if (defSlot.totalPower > 0) {
            if (defSlot.totalPower >= damage) {
                damageToPlayer = 0;
                this.log("SYSTEM", `> D${slotIndex + 1} fully blocked ${attackerName}'s attack (${defSlot.totalPower} ≥ ${damage})`);
            } else {
                damageToPlayer = damage - defSlot.totalPower;
                this.log("SYSTEM", `> D${slotIndex + 1} partially blocked: ${damageToPlayer} dmg from ${attackerName} (${defSlot.totalPower} < ${damage})`);
            }
        } else {
            this.log("SYSTEM", `> D${slotIndex + 1} has no defense, takes ${damageToPlayer} dmg from ${attackerName}`);
        }

        if (damageToPlayer > 0) {
            player.integrity -= damageToPlayer;
            this.log("SYSTEM", `> ${player.name} took ${damageToPlayer} damage from ${attackerName}`);
            if (player.integrity <= 0) {
                player.state = 'terminated';
                player.integrity = 0;
                this.log("SYSTEM", `NODE ${player.name} TERMINATED.`);
            }
        }
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
            const barWidth = (e.integrity / e.maxIntegrity) * 100;
            const div = document.createElement("div");
            div.className = "enemy-slot";
            div.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <span>[!] ${e.name}</span>
                <span>${e.integrity}/${e.maxIntegrity}</span>
                <span>${e.latency}%</span>
            </div>
            <div style="font-size:0.8em">LINKED: A${e.slotIndex + 1}</div>
            <div class="bar-container"><div class="hp-bar" style="width:${barWidth}%; background:red;"></div></div>
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
                <span>⭐ ${p.contribution}</span>   <!-- <-- ДОБАВЛЕНО -->
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