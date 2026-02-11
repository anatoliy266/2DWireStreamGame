/**
 * === NETWORK RAID MVP ===
 * Основано на GDD: Firewall, Injector, LoadBalancer vs Legacy Mainframe + The Hops
 */

const client = new StreamerbotClient();
const chatContainer = document.getElementById('chat-container');
let game = null;

// --- КОНФИГУРАЦИЯ ---
const CONFIG = {
    LATENCY_MAX: 100,
    LATENCY_COST_BASIC: 10,
    LATENCY_COST_ULT: 25,
    RECONNECT_TURNS: 2,
    SEARCH_COST: 15, // Стоимость поиска бонуса
    SEARCH_CHANCE: 0.5 // Шанс найти бонус
};

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ВЫВОДА ---
function printMessage(message, user = "SYSTEM") {
    const messageItem = document.createElement('li');
    messageItem.className = 'message-box';
    const userColor = user === "SYSTEM" ? '#00ff00' : '#dad607';

    messageItem.innerHTML = `
        <span class="username" style="color: ${userColor}">${user}:</span>
        <span class="text">${message}</span>
    `;

    chatContainer.prepend(messageItem);

    // Удаление старых сообщений
    if (chatContainer.children.length > 50) {
        chatContainer.lastChild.remove();
    }
}

// --- БАЗОВЫЙ КЛАСС УЗЛА ---
class NetworkNode {
    constructor(name, role, hp, playerName = "NPC") {
        this.name = name;
        this.role = role;
        this.hp = hp;
        this.maxHp = hp;
        this.playerName = playerName;
        this.latency = 0;
        this.isDead = false;
        this.reconnectTimer = 0;
        this.statuses = {
            vulnerable: false,
            shielded: false,
            obfuscated: false
        };
    }

    checkStatus() {
        if (this.hp <= 0 && !this.isDead) {
            this.hp = 0;
            this.isDead = true;
            printMessage(`%c💀 ${this.playerName} (${this.name}) отключен от сети!`, "SYSTEM");
        }
        if (this.latency >= CONFIG.LATENCY_MAX && this.reconnectTimer === 0) {
            this.reconnectTimer = CONFIG.RECONNECT_TURNS;
            this.latency = 0;
            printMessage(`%c🔌 ${this.playerName} перегрелся! ПЕРЕПОДКЛЮЧЕНИЕ (${CONFIG.RECONNECT_TURNS} ход.)`, "SYSTEM");
        }
    }

    takeDamage(amount, sourceName) {
        if (this.isDead) return;
        let finalDamage = amount;

        if (this.statuses.shielded) {
            printMessage(`🛡️ ${this.playerName} блокирует атаку щитом!`);
            this.statuses.shielded = false;
            finalDamage = 0;
        }
        if (this.statuses.obfuscated) {
            printMessage(`🌫️ Атака по ${this.playerName} потерялась в шуме.`);
            finalDamage = Math.floor(amount * 0.5);
            this.statuses.obfuscated = false;
        }

        this.hp -= finalDamage;
        printMessage(`💥 ${sourceName} -> ${this.playerName}: -${finalDamage} HP [${this.hp}/${this.maxHp}]`);
        this.checkStatus();
    }

    addLatency(amount) {
        this.latency += amount;
        if (this.latency < 0) this.latency = 0;
        // printMessage(`📶 ${this.playerName} Latency: ${this.latency}% (+${amount})`); // Спам в чат можно убрать
        this.checkStatus();
    }
    
    canAct() {
        if (this.isDead) { printMessage(`${this.playerName} мертв.`); return false; }
        if (this.reconnectTimer > 0) { printMessage(`${this.playerName} перезагружается...`); return false; }
        return true;
    }

    payCost(cost) { this.addLatency(cost); }
}

// --- КЛАССЫ ГЕРОЕВ ---
class Firewall extends NetworkNode {
    constructor(playerName) { super("Firewall", "Tank", 150, playerName); }
    skill1_Intercept(target) {
        if (!this.canAct()) return;
        printMessage(`${this.playerName} использует !intercept на ${target.playerName}`);
        target.statuses.shielded = true;
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }
    skill2_PacketFilter(party) { // !packet_filter
        if (!this.canAct()) return;
        printMessage(`🛡️ ${this.playerName} использует !packet_filter. Группа получает временную защиту.`);
        // Упрощение для MVP: лечим чуть-чуть всех, имитируя снижение урона
        party.forEach(p => { if(!p.isDead) p.hp += 5; });
        this.payCost(CONFIG.LATENCY_COST_ULT);
    }
    skill3_Traceback(target) {
        if (!this.canAct()) return;
        printMessage(`${this.playerName} использует !traceback на ${target.name}. УЯЗВИМОСТЬ!`);
        target.takeDamage(10, this.playerName);
        target.statuses.vulnerable = true;
    }
}

class Injector extends NetworkNode {
    constructor(playerName) { super("Injector", "DD", 80, playerName); }
    skill1_Payload(target) {
        if (!this.canAct()) return;
        printMessage(`${this.playerName} использует !payload на ${target.name}`);
        target.takeDamage(20, this.playerName);
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }
    skill2_Inject(target) {
        if (!this.canAct()) return;
        if (target.statuses.vulnerable) {
            printMessage(`${this.playerName} использует !inject КРИТ!`);
            target.takeDamage(50, this.playerName);
            target.statuses.vulnerable = false;
        } else {
            printMessage(`${this.playerName} использует !inject (нет уязвимости)`);
            target.takeDamage(15, this.playerName);
        }
        this.payCost(CONFIG.LATENCY_COST_ULT);
    }
    skill3_Obfuscate() { // !obfuscate
        if (!this.canAct()) return;
        printMessage(`👻 ${this.name} включает !obfuscate (маскировка трафика)`);
        this.statuses.obfuscated = true;
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }
}

class LoadBalancer extends NetworkNode {
    constructor(playerName) { super("LoadBalancer", "Support", 100, playerName); }
    skill1_Bridge(party) {
        if (!this.canAct()) return;
        let totalLat = 0; let activeCount = 0;
        party.forEach(p => { if (!p.isDead) { totalLat += p.latency; activeCount++; } });
        const avg = Math.floor(totalLat / activeCount);
        party.forEach(p => { if (!p.isDead) p.latency = avg; });
        printMessage(`Latency уравнена: ${avg}%`);
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }
    skill2_Compress(target) { // !compress
        if (!this.canAct()) return;
        printMessage(`🐌 ${this.name} делает !compress на ${target.name}`);
        target.addLatency(20); // Забиваем канал боссу
        this.payCost(CONFIG.LATENCY_COST_ULT);
    }
    skill3_Hotfix(target) {
        if (!this.canAct()) return;
        printMessage(`${this.playerName} лечит ${target.playerName}`);
        target.hp = Math.min(target.hp + 30, target.maxHp);
        target.addLatency(-20);
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }
}

// --- ВРАГИ ---
class TrashMob extends NetworkNode {
    constructor(type, hp) {
        super(type, "MOB", hp, type);
    }
    act(party) {
        const target = party[Math.floor(Math.random() * party.length)];
        if (target && !target.isDead) {
            printMessage(`🤖 ${this.name} атакует ${target.playerName}`);
            target.takeDamage(15, this.name);
        }
    }
}

class Boss extends NetworkNode {
    constructor() {
        super("Legacy Mainframe", "BOSS", 500, "BOSS");
        this.turnCount = 0;
        this.targets = [];
    }
    act(party) {
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
        
        // if (this.turnCount % 3 === 0) {
        //     printMessage(`☠️ БОСС ИСПОЛЬЗУЕТ !OVERLOAD (AOE)`);
        //     aliveHeroes.forEach(h => h.takeDamage(15, this.name));
        //     this.addLatency(20);
        // } else {
        //     // Атака случайной цели
        //     const target = aliveHeroes[Math.floor(Math.random() * aliveHeroes.length)];
        //     printMessage(`🤖 Босс атакует ${target.playerName}`);
        //     target.takeDamage(25, this.name);
        //     this.addLatency(5);
        // }
        if (this.turnCount % 3 === 0) {
            this.overload(aliveHeroes);
        } else {
            //атака выбранных на предыдущем ходу целей
            if (this.targets.length == 0) this.targets = this.aim_targets(party);
            this.targets.forEach(target => {
                printMessage(`🤖 Босс атакует ${target.playerName}`);
                target.takeDamage(25, this.name);
                this.addLatency(5);
            });
            this.targets = this.aim_targets(party);

        }
    }
    aim_targets(party){
        const targets = [];
        const targetsCount = 1;
        if (party.length > 3)  targetsCount = Math.floor(Math.random() * (party.length - 3 + 1)) + 3;
        while (targets.length < targetsCount) {
            const randomPlayer = party[Math.floor(Math.random() * party.length)];
            
            // Проверяем, чтобы не добавить одного и того же дважды
            if (!targets.includes(randomPlayer)) {
                targets.push(randomPlayer);
            }
        }
        printMessage(`☠️ БОСС нацелился на ${targets.map(t => t.playerName).join(' | ')}, защищайте союзников`);
        return targets;
    }
}

// --- ЛОГИКА КОМНАТ (THE HOPS) ---
class Room {
    constructor(level, type) {
        this.level = level;
        this.type = type; // "mob", "boss", "empty"
        this.enemy = null;
        this.isCleared = false;
        
        this.setup();
    }

    setup() {
        if (this.type === "mob") {
            const names = ["Firewall Watchdog", "AntiVirus Daemon", "Protocol Droid"];
            const name = names[Math.floor(Math.random() * names.length)];
            this.enemy = new TrashMob(name, 100 + (this.level * 20));
        } else if (this.type === "boss") {
            this.enemy = new Boss();
        }
    }
}

// --- ДВИЖОК ИГРЫ ---
class Game {
    constructor() {
        this.heroes = [];
        this.currentRoomIndex = 0;
        this.rooms = [
            new Room(1, "mob"),
            new Room(2, "mob"),
            new Room(3, "boss") // Финальный слой
        ];
        this.isGameStart = false;
        this.isGameOver = false;
        this.timerId = null;
    }

    startGame() {
        this.isGameStart = true;
        this.startTimer(10); // Тики игры
        printMessage("=== СЕТЕВОЙ РЕЙД НАЧАЛСЯ! ===", "SYSTEM");
        this.enterRoom();
    }

    enterRoom() {
        const room = this.rooms[this.currentRoomIndex];
        printMessage(`>>> ВХОД В СЛОЙ ${room.level}: ${room.enemy ? room.enemy.name : "Пусто"} <<<`, "SYSTEM");
        printMessage("Доступные действия: !Attack, !Heal, !Search (поиск бонуса)");
    }

    startTimer(seconds) {
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = setInterval(() => this.nextTurn(), seconds * 1000);
    }

    nextTurn() {
        if (this.isGameOver || !this.isGameStart) return;

        const room = this.rooms[this.currentRoomIndex];
        const activeHeroes = this.heroes.filter(h => !h.isDead);

        // 1. Проверка вайпа
        if (activeHeroes.length === 0 && this.heroes.length > 0) {
            printMessage("💀 ВАЙП! Связь потеряна.", "SYSTEM");
            this.isGameOver = true;
            clearInterval(this.timerId);
            return;
        }

        // 2. Логика боя
        if (room.enemy && !room.enemy.isDead) {
            // Враг атакует
            room.enemy.act(activeHeroes);
            
            // Если враг умер от дотов или рефлектов (на будущее)
            if (room.enemy.hp <= 0) {
                room.enemy.isDead = true;
                printMessage(`🏆 ${room.enemy.name} уничтожен!`, "SYSTEM");
                this.roomCleared();
            }
        } else if (!room.isCleared) {
            // Если врага не было изначально
            this.roomCleared();
        }

        // 3. Обновление статусов героев (реконнект)
        this.heroes.forEach(h => {
            if (h.reconnectTimer > 0) {
                h.reconnectTimer--;
                if(h.reconnectTimer === 0) printMessage(`✅ ${h.playerName} снова в сети!`);
            }
        });
        
        // Авто-снижение Latency в простое
        if (room.isCleared) {
             this.heroes.forEach(h => h.addLatency(-5));
        }
    }

    roomCleared() {
        const room = this.rooms[this.currentRoomIndex];
        room.isCleared = true;
        
        if (room.type === "boss") {
            printMessage("🎉 ПОБЕДА! LEGACY MAINFRAME ВЗЛОМАН!", "SYSTEM");
            this.isGameOver = true;
            clearInterval(this.timerId);
        } else {
            printMessage("✅ Слой зачищен. Переход на следующий уровень через 10 сек...", "SYSTEM");
            setTimeout(() => {
                this.currentRoomIndex++;
                if (this.currentRoomIndex < this.rooms.length) {
                    this.enterRoom();
                }
            }, 10000);
        }
    }

    // --- ИГРОВЫЕ ДЕЙСТВИЯ ---

    // Поиск бонусов (механика The Hops)
    search(player) {
        const hero = this.heroes.find(h => h.playerName === player);
        if (!hero || hero.isDead) return;

        const room = this.rooms[this.currentRoomIndex];
        if (!room.isCleared && room.enemy && !room.enemy.isDead) {
            // Можно искать и во время боя, но это риск
        }

        hero.addLatency(CONFIG.SEARCH_COST);
        if (Math.random() < CONFIG.SEARCH_CHANCE) {
            printMessage(`🔍 ${player} нашел "Бит Данных"! Все восстановили 20 HP.`);
            this.heroes.forEach(h => { if (!h.isDead) h.hp = Math.min(h.hp + 20, h.maxHp); });
        } else {
            printMessage(`🔍 ${player} ничего не нашел, только потратил трафик.`);
        }
    }

    // Обработка атаки
    processAttack(playerName) {
        const hero = this.heroes.find(h => h.playerName === playerName);
        if (!hero) return;
        
        const room = this.rooms[this.currentRoomIndex];
        if (!room.enemy || room.enemy.isDead) {
            printMessage(`${playerName}, здесь некого бить!`);
            return;
        }

        // Пример маппинга простых команд на скиллы
        if (hero.role === "DD") {
            if (hero instanceof Injector) hero.skill1_Payload(room.enemy);
        } else if (hero.role === "Tank") {
            if (hero instanceof Firewall) hero.skill3_Traceback(room.enemy);
        } else {
            printMessage(`${playerName} пытается ударить палкой, но он саппорт.`);
            room.enemy.takeDamage(5, playerName); // слабый удар
            hero.addLatency(5);
        }
        
        // Проверка смерти врага сразу после удара
        if (room.enemy.hp <= 0 && !room.enemy.isDead) {
            room.enemy.isDead = true;
            printMessage(`🏆 ${room.enemy.name} уничтожен игроком ${playerName}!`, "SYSTEM");
            this.roomCleared();
        }
    }

    addPlayer(playerName, roleArg) {
        if (this.heroes.some(h => h.playerName === playerName)) return;
        
        // Если роль не задана, рандом
        let role = roleArg;
        if (!role) {
            const roles = ["tank", "dd", "heal"];
            role = roles[Math.floor(Math.random() * roles.length)];
        }

        let newHero;
        switch (role.toLowerCase()) {
            case "tank": newHero = new Firewall(playerName); break;
            case "dd": newHero = new Injector(playerName); break;
            case "heal": newHero = new LoadBalancer(playerName); break;
            default: newHero = new Injector(playerName); // Фоллбек
        }
        
        this.heroes.push(newHero);
        printMessage(`${playerName} присоединился как ${newHero.name}`, "SYSTEM");
    }
}

// --- STREAMERBOT EVENTS ---

client.on('Raw.ActionCompleted', async (data) => {
    // Безопасное чтение данных
    if (!data?.data?.arguments) return;

    const args = data.data.arguments;
    const command = args.commandName;
    const userName = data.data.user?.name || "Anonymous";

    // 1. Старт игры
    if (command === "StartGame") {
        if (!game || game.isGameOver) {
            game = new Game();
            game.startGame();
        } else {
            printMessage("Игра уже идет!", "SYSTEM");
        }
        return;
    }

    if (!game || !game.isGameStart || game.isGameOver) return;

    // 2. Присоединение
    if (command === "JoinBattle") {
        // Можно передать роль аргументом, если настроено в Streamerbot
        const role = args.role || null; 
        game.addPlayer(userName, role);
    }

    // 3. Атака
    if (command === "Attack") {
        game.processAttack(userName);
    }

    // 4. Поиск (The Hops mechanic)
    if (command === "Search") {
        game.search(userName);
    }
    
    // 5. Лечение (упрощенно для примера)
    if (command === "Heal") {
         const hero = game.heroes.find(h => h.playerName === userName);
         if (hero && hero instanceof LoadBalancer) {
             // Лечим самого раненого
             const target = game.heroes.sort((a,b) => a.hp - b.hp)[0];
             hero.skill3_Hotfix(target);
         }
    }
});