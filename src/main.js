const client = new StreamerbotClient();
const isGameStart = false;

const playersNodes = [];

/**
 * === NETWORK RAID MVP ===
 * Основано на GDD: Firewall, Injector, LoadBalancer vs Legacy Mainframe
 */

// --- КОНФИГУРАЦИЯ ---
const CONFIG = {
    LATENCY_MAX: 100,
    LATENCY_COST_BASIC: 10,
    LATENCY_COST_ULT: 25,
    RECONNECT_TURNS: 2
};

// --- БАЗОВЫЙ КЛАСС УЗЛА ---
class NetworkNode {
    constructor(name, role, hp, playerName) {
        this.name = name;
        this.role = role;
        this.hp = hp;
        this.maxHp = hp;
        this.playerName = playerName;
        this.latency = 0;
        this.isDead = false;
        this.reconnectTimer = 0; // Если > 0, узел в стане
        this.statuses = {
            vulnerable: false, // Для комбо Traceback -> Inject
            shielded: false,   // Intercept
            obfuscated: false  // Зашумление
        };
    }

    // Проверка состояния
    checkStatus() {
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
            console.log(`%c💀 ${this.name} отключен от сети (DISCONNECT)!`, 'color: red; font-weight: bold;');
        }
        if (this.latency >= CONFIG.LATENCY_MAX && this.reconnectTimer === 0) {
            this.reconnectTimer = CONFIG.RECONNECT_TURNS;
            this.latency = 0; // Сброс при перегрузке
            console.log(`%c🔌 ${this.name} перегрелся! ПЕРЕПОДКЛЮЧЕНИЕ (${CONFIG.RECONNECT_TURNS} ход.)`, 'color: orange; font-weight: bold;');
        }
    }

    // Получение урона
    takeDamage(amount, sourceName) {
        if (this.isDead) return;

        let finalDamage = amount;

        // Механика Intercept (Щит)
        if (this.statuses.shielded) {
            console.log(`🛡️ ${this.name} блокирует атаку щитом!`);
            this.statuses.shielded = false;
            finalDamage = 0;
        }

        // Механика Obfuscate (Шум)
        if (this.statuses.obfuscated) {
            console.log(`🌫️ Атака по ${this.name} потерялась в шуме (урон снижен)`);
            finalDamage = Math.floor(amount * 0.5);
            this.statuses.obfuscated = false;
        }

        this.hp -= finalDamage;
        console.log(`💥 ${sourceName} наносит ${finalDamage} урона по ${this.name}. [HP: ${this.hp}/${this.maxHp}]`);
        this.checkStatus();
    }

    // Изменение Latency
    addLatency(amount) {
        this.latency += amount;
        if (this.latency < 0) this.latency = 0;
        console.log(`📶 ${this.name} Latency: ${this.latency}% (+${amount})`);
        this.checkStatus();
    }
}

// --- КЛАССЫ ГЕРОЕВ ---

class Firewall extends NetworkNode {
    constructor(playerName) { super("Firewall", "Tank", 150, playerName); }

    skill1_Intercept(target) { // !intercept
        if (!this.canAct()) return;
        console.log(`🛡️ ${this.name} использует !intercept на ${target.name}`);
        target.statuses.shielded = true;
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }

    skill2_PacketFilter(party) { // !packet_filter
        if (!this.canAct()) return;
        console.log(`🛡️ ${this.name} использует !packet_filter. Группа получает временную защиту.`);
        // Упрощение для MVP: лечим чуть-чуть всех, имитируя снижение урона
        party.forEach(p => { if(!p.isDead) p.hp += 5; });
        this.payCost(CONFIG.LATENCY_COST_ULT);
    }

    skill3_Traceback(target) { // !traceback
        if (!this.canAct()) return;
        console.log(`🎯 ${this.name} использует !traceback на ${target.name}. УЯЗВИМОСТЬ ВСКРЫТА!`);
        target.takeDamage(10, this.name);
        target.statuses.vulnerable = true; // Триггер для Инжектора
        // Бесплатно по GDD
    }
}

class Injector extends NetworkNode {
    constructor(playerName) { super("Injector", "DD", 80, playerName); }

    skill1_Payload(target) { // !payload
        // debugger;
        if (!this.canAct()) return;
        console.log(`⚔️ ${this.name} отправляет !payload в ${target.name}`);
        target.takeDamage(20, this.name);
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }

    skill2_Inject(target) { // !inject
        if (!this.canAct()) return;
        if (target.statuses.vulnerable) {
            console.log(`☣️ ${this.name} использует !inject в УЯЗВИМОСТЬ! КРИТИЧЕСКИЙ УРОН!`);
            target.takeDamage(50, this.name);
            target.statuses.vulnerable = false; // Снимаем метку
        } else {
            console.log(`⚔️ ${this.name} пытается сделать !inject, но уязвимости нет. Обычный урон.`);
            target.takeDamage(15, this.name);
        }
        this.payCost(CONFIG.LATENCY_COST_ULT);
    }

    skill3_Obfuscate() { // !obfuscate
        if (!this.canAct()) return;
        console.log(`👻 ${this.name} включает !obfuscate (маскировка трафика)`);
        this.statuses.obfuscated = true;
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }
}

class LoadBalancer extends NetworkNode {
    constructor(playerName) { super("LoadBalancer", "Support", 100, playerName); }

    skill1_Bridge(party) { // !bridge
        if (!this.canAct()) return;
        console.log(`⚖️ ${this.name} строит !bridge. Выравнивание Latency...`);
        let totalLat = 0;
        let activeCount = 0;
        party.forEach(p => { if (!p.isDead) { totalLat += p.latency; activeCount++; } });
        const avg = Math.floor(totalLat / activeCount);
        party.forEach(p => { if (!p.isDead) p.latency = avg; });
        console.log(`Все живые узлы теперь имеют Latency: ${avg}%`);
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }

    skill2_Compress(target) { // !compress
        if (!this.canAct()) return;
        console.log(`🐌 ${this.name} делает !compress на ${target.name}`);
        target.addLatency(20); // Забиваем канал боссу
        this.payCost(CONFIG.LATENCY_COST_ULT);
    }

    skill3_Hotfix(target) { // !hotfix
        if (!this.canAct()) return;
        console.log(`🚑 ${this.name} накатывает !hotfix на ${target.name}`);
        target.hp += 30;
        if (target.hp > target.maxHp) target.hp = target.maxHp;
        target.addLatency(-20); // Снижаем латенси
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }
}

// Расширение прототипа для общих методов героев
NetworkNode.prototype.canAct = function() {
    if (this.isDead) { console.log(`${this.name} мертв.`); return false; }
    if (this.reconnectTimer > 0) { console.log(`${this.name} перезагружается...`); return false; }
    return true;
};

NetworkNode.prototype.payCost = function(cost) {
    this.addLatency(cost);
};


// --- БОСС ---
class Boss extends NetworkNode {
    constructor() {
        super("Legacy Mainframe", "BOSS", 500);
        this.turnCount = 0;
    }

    act(party) {
        if (this.reconnectTimer > 0) {
            this.reconnectTimer--;
            console.log(`💤 Босс перезагружается. Осталось ходов: ${this.reconnectTimer}`);
            return;
        }
        if (this.latency >= 100) {
             // Босс тоже подчиняется правилам Latency
             this.reconnectTimer = 1; 
             this.latency = 0;
             console.log(`🔥 БОСС ПЕРЕГРЕЛСЯ!`);
             return;
        }

        this.turnCount++;
        const aliveHeroes = party.filter(h => !h.isDead);
        if (aliveHeroes.length === 0) return;

        console.log(`%c⚠️ ХОД БОССА (Turn ${this.turnCount})`, 'color: red; font-size: 14px');

        // Логика из GDD: каждые 3 хода спец атака
        if (this.turnCount % 3 === 0) {
            this.overload(aliveHeroes);
        } else {
            // Атака самого слабого (по HP)
            aliveHeroes.sort((a, b) => a.hp - b.hp);
            const target = aliveHeroes[0];
            console.log(`🤖 Босс атакует слабейшего: ${target.name}`);
            target.takeDamage(25, this.name);
            this.addLatency(5);
        }
    }

    overload(heroes) {
        console.log(`☠️ БОСС ИСПОЛЬЗУЕТ !OVERLOAD (AOE)`);
        heroes.forEach(h => h.takeDamage(15, this.name));
        this.addLatency(20);
    }
}

// --- ДВИЖОК ИГРЫ ---

class Game {
    constructor() {
        this.heroes = [
            // new Firewall(),
            // new Injector(),
            // new LoadBalancer()
        ];
        this.boss = new Boss();
        this.turn = 1;
        this.isGameOver = false;
        this.isGameStart = false;

        this.timerId = null; // Храним ID таймера, чтобы потом остановить
        this.counter = 0;

        this.printIntro();

        this.startTimer(10);
    }

    startTimer(seconds) {
        // Если таймер уже запущен, сначала очистим старый
        if (this.timerId) this.stopTimer();

        console.log("Таймер запущен!");

        // ВАЖНО: Используем стрелочную функцию () =>, чтобы this указывал на класс
        this.timerId = setInterval(() => {
            this.nextTurn();
        }, seconds * 1000); // Переводим секунды в миллисекунды
    }

    printIntro() {
        console.clear();
        console.log("%c=== NETWORK RAID START ===", "color: lime; font-size: 20px; background: black; padding: 10px;");
        console.log("Цель: Уничтожить Legacy Mainframe.");
        console.log("Внимание: Следите за Latency! Если будет 100% - вы пропустите 2 хода.");
        this.help();
        this.status();
    }

    status() {
        console.table(this.heroes.map(h => ({
            Name: h.name,
            HP: `${h.hp}/${h.maxHp}`,
            Latency: `${h.latency}%`,
            Status: h.reconnectTimer > 0 ? `RECONNECT (${h.reconnectTimer})` : 'Active'
        })));
        console.log(`👾 BOSS HP: ${this.boss.hp} | Latency: ${this.boss.latency}%`);
    }

    help() {
        console.group("📜 СПИСОК КОМАНД (введите в консоль):");
        console.log("game.fw_intercept(heroIndex)  - Firewall: Защитить союзника (0=FW, 1=INJ, 2=LB)");
        console.log("game.fw_traceback()           - Firewall: Атака + Уязвимость (на Босса)");
        console.log("game.inj_payload()            - Injector: Базовый урон");
        console.log("game.inj_inject()             - Injector: Крит (если есть уязвимость)");
        console.log("game.inj_obfuscate()          - Injector: Защита себя");
        console.log("game.lb_bridge()              - LoadBalancer: Уравнять Latency всем");
        console.log("game.lb_hotfix(heroIndex)     - LoadBalancer: Лечение + Снижение Latency");
        console.log("game.skip()                   - Пропустить ход (снижает Latency на 15)");
        console.groupEnd();
    }

    // Обработка конца хода
    nextTurn() {
        if (this.boss.hp <= 0) {
            console.log("%c🏆 ПОБЕДА! СИСТЕМА ВЗЛОМАНА.", "color: lime; font-size: 30px");
            this.isGameOver = true;
            return;
        }

        // Ход босса
        this.boss.act(this.heroes);

        // Проверка поражения
        if (this.heroes.every(h => h.isDead)) {
            console.log("%c💀 ВАЙП! Соединение разорвано.", "color: red; font-size: 30px");
            this.isGameOver = true;
            return;
        }

        // Обновление таймеров героев
        this.heroes.forEach(h => {
            if (h.reconnectTimer > 0) {
                h.reconnectTimer--;
                if(h.reconnectTimer === 0) console.log(`✅ ${h.name} снова в сети!`);
            }
        });

        this.turn++;
        console.log(`\n--- TURN ${this.turn} ---`);
        this.status();
    }

    // --- API ИГРОКА ---

    // Firewall Actions
    fw_intercept(targetIdx) {
        if(this.checkEnd()) return;
        this.heroes[0].skill1_Intercept(this.heroes[targetIdx]);
        this.nextTurn();
    }
    fw_traceback() {
        if(this.checkEnd()) return;
        this.heroes[0].skill3_Traceback(this.boss);
        this.nextTurn();
    }

    // Injector Actions
    inj_payload() {
        if(this.checkEnd()) return;
        this.heroes[1].skill1_Payload(this.boss);
        this.nextTurn();
    }
    inj_inject() {
        if(this.checkEnd()) return;
        this.heroes[1].skill2_Inject(this.boss);
        this.nextTurn();
    }
    inj_obfuscate() {
        if(this.checkEnd()) return;
        this.heroes[1].skill3_Obfuscate();
        this.nextTurn();
    }

    // LoadBalancer Actions
    lb_bridge() {
        if(this.checkEnd()) return;
        this.heroes[2].skill1_Bridge(this.heroes);
        this.nextTurn();
    }
    lb_hotfix(targetIdx) {
        if(this.checkEnd()) return;
        this.heroes[2].skill3_Hotfix(this.heroes[targetIdx]);
        this.nextTurn();
    }

    // General
    skip() {
        if(this.checkEnd()) return;
        console.log("⏳ Команда пропускает ход для охлаждения систем...");
        this.heroes.forEach(h => {
            if (!h.isDead && h.reconnectTimer === 0) {
                h.addLatency(-15);
            }
        });
        this.nextTurn();
    }

    checkEnd() {
        if (this.isGameOver) { console.log("Игра окончена. Обновите страницу для рестарта."); return true; }
        return false;
    }
}

// Запуск игры

// const CLASSES = {
//     tank,
//     dd,
//     heal,
// };


client.on('Raw.ActionCompleted', async (data) => {
    console.log("command triggered", data);
    if (!data.data || !data.data.arguments){
        console.log("failed data.data reading", data);
        // return;
    }
    if (data.data.arguments.commandName === "StartGame"){
        console.log("im here");
        game = new Game();
        game.isGameStart = true;
    }
    if (game && game.isGameStart){
        if (data.data.arguments.commandName === "JoinBattle"){
            // const roles = ["tank", "dd", "heal"];
            const roles = ["dd"];
            const role = roles[Math.floor(Math.random() * roles.length)];
            let player;
            switch (role) {
                case "tank":
                    player = new Firewall(data.data.user.name);
                    break;
                case "dd":
                    // Code to be executed if expression === value2
                    player = new Injector(data.data.user.name);
                    break;
                case "heal":
                    player = new LoadBalancer(data.data.user.name);
                    // Code to be executed if expression === value2
                    break;
                // ... more cases ...
                default:
                    return;
            }
            game.heroes.push(player);
        }
        if (data.data.arguments.commandName === "Attack"){
            game.heroes.forEach(hero => {
                if (hero.playerName === data.data.user.name && hero.name === "Injector"){
                    console.log("im here")
                    if(game.checkEnd()) return;
                    // debugger;
                    hero.skill1_Payload(game.boss);
                } else if (hero.playerName === data.data.user.name && hero.name !== "Injector"){
                    console.log("${data.data.user.name} is not a  DD");
                }
            });
        }
        if (data.data.arguments.commandName == "Heal"){
            
        }
    }
});
