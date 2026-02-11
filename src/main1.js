const client = new StreamerbotClient();
const isGameStart = false;

const chatContainer = document.getElementById('chat-container');

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
            printMessage(`%c💀 ${this.name} отключен от сети (DISCONNECT)!`, 'color: red; font-weight: bold;');
        }
        if (this.latency >= CONFIG.LATENCY_MAX && this.reconnectTimer === 0) {
            this.reconnectTimer = CONFIG.RECONNECT_TURNS;
            this.latency = 0; // Сброс при перегрузке
            printMessage(`%c🔌 ${this.name} перегрелся! ПЕРЕПОДКЛЮЧЕНИЕ (${CONFIG.RECONNECT_TURNS} ход.)`, 'color: orange; font-weight: bold;');
        }
    }

    // Получение урона
    takeDamage(amount, sourceName) {
        if (this.isDead) return;

        let finalDamage = amount;

        // Механика Intercept (Щит)
        if (this.statuses.shielded) {
            printMessage(`🛡️ ${this.name} блокирует атаку щитом!`);
            this.statuses.shielded = false;
            finalDamage = 0;
        }

        // Механика Obfuscate (Шум)
        if (this.statuses.obfuscated) {
            printMessage(`🌫️ Атака по ${this.name} потерялась в шуме (урон снижен)`);
            finalDamage = Math.floor(amount * 0.5);
            this.statuses.obfuscated = false;
        }

        this.hp -= finalDamage;
        printMessage(`💥 ${sourceName} наносит ${finalDamage} урона по ${this.name}. [HP: ${this.hp}/${this.maxHp}]`);
        this.checkStatus();
    }

    // Изменение Latency
    addLatency(amount) {
        this.latency += amount;
        if (this.latency < 0) this.latency = 0;
        printMessage(`📶 ${this.name} Latency: ${this.latency}% (+${amount})`);
        this.checkStatus();
    }
}

// --- КЛАССЫ ГЕРОЕВ ---

class Firewall extends NetworkNode {
    constructor(playerName) { super("Firewall", "Tank", 150, playerName); }

    skill1_Intercept(target) { // !intercept
        if (!this.canAct()) return;
        printMessage(`🛡️ ${this.name} использует !intercept на ${target.name}`);
        target.statuses.shielded = true;
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }

    skill2_PacketFilter(party) { // !packet_filter
        if (!this.canAct()) return;
        printMessage(`🛡️ ${this.name} использует !packet_filter. Группа получает временную защиту.`);
        // Упрощение для MVP: лечим чуть-чуть всех, имитируя снижение урона
        party.forEach(p => { if(!p.isDead) p.hp += 5; });
        this.payCost(CONFIG.LATENCY_COST_ULT);
    }

    skill3_Traceback(target) { // !traceback
        if (!this.canAct()) return;
        printMessage(`🎯 ${this.name} использует !traceback на ${target.name}. УЯЗВИМОСТЬ ВСКРЫТА!`);
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
        printMessage(`⚔️ ${this.name} отправляет !payload в ${target.name}`);
        target.takeDamage(20, this.name);
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }

    skill2_Inject(target) { // !inject
        if (!this.canAct()) return;
        if (target.statuses.vulnerable) {
            printMessage(`☣️ ${this.name} использует !inject в УЯЗВИМОСТЬ! КРИТИЧЕСКИЙ УРОН!`);
            target.takeDamage(50, this.name);
            target.statuses.vulnerable = false; // Снимаем метку
        } else {
            printMessage(`⚔️ ${this.name} пытается сделать !inject, но уязвимости нет. Обычный урон.`);
            target.takeDamage(15, this.name);
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

    skill1_Bridge(party) { // !bridge
        if (!this.canAct()) return;
        printMessage(`⚖️ ${this.name} строит !bridge. Выравнивание Latency...`);
        let totalLat = 0;
        let activeCount = 0;
        party.forEach(p => { if (!p.isDead) { totalLat += p.latency; activeCount++; } });
        const avg = Math.floor(totalLat / activeCount);
        party.forEach(p => { if (!p.isDead) p.latency = avg; });
        printMessage(`Все живые узлы теперь имеют Latency: ${avg}%`);
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }

    

    skill3_Hotfix(target) { // !hotfix
        if (!this.canAct()) return;
        printMessage(`🚑 ${this.name} накатывает !hotfix на ${target.name}`);
        target.hp += 30;
        if (target.hp > target.maxHp) target.hp = target.maxHp;
        target.addLatency(-20); // Снижаем латенси
        this.payCost(CONFIG.LATENCY_COST_BASIC);
    }
}

// Расширение прототипа для общих методов героев
NetworkNode.prototype.canAct = function() {
    if (this.isDead) { printMessage(`${this.name} мертв.`); return false; }
    if (this.reconnectTimer > 0) { printMessage(`${this.name} перезагружается...`); return false; }
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
        this.targets = [];

    }

    act(party) {
        if (this.reconnectTimer > 0) {
            this.reconnectTimer--;
            printMessage(`💤 Босс перезагружается. Осталось ходов: ${this.reconnectTimer}`);
            return;
        }
        if (this.latency >= 100) {
             // Босс тоже подчиняется правилам Latency
             this.reconnectTimer = 1; 
             this.latency = 0;
             printMessage(`🔥 БОСС ПЕРЕГРЕЛСЯ!`);
             return;
        }

        this.turnCount++;
        const aliveHeroes = party.filter(h => !h.isDead);
        if (aliveHeroes.length === 0) return;

        printMessage(`%c⚠️ ХОД БОССА (Turn ${this.turnCount})`, 'color: red; font-size: 14px');

        
        // Логика из GDD: каждые 3 хода спец атака
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

    overload(heroes) {
        printMessage(`☠️ БОСС ИСПОЛЬЗУЕТ !OVERLOAD (AOE)`);
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

        printMessage("Таймер запущен!");

        // ВАЖНО: Используем стрелочную функцию () =>, чтобы this указывал на класс
        this.timerId = setInterval(() => {
            this.nextTurn();
        }, seconds * 1000); // Переводим секунды в миллисекунды
    }

    printIntro() {
        console.clear();
        printMessage("%c=== NETWORK RAID START ===", "color: lime; font-size: 20px; background: black; padding: 10px;");
        printMessage("Цель: Уничтожить Legacy Mainframe.");
        printMessage("Внимание: Следите за Latency! Если будет 100% - вы пропустите 2 хода.");
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
        printMessage(`👾 BOSS HP: ${this.boss.hp} | Latency: ${this.boss.latency}%`);
    }

    help() {
        console.group("📜 СПИСОК КОМАНД (введите в консоль):");
        printMessage("game.fw_intercept(heroIndex)  - Firewall: Защитить союзника (0=FW, 1=INJ, 2=LB)");
        printMessage("game.fw_traceback()           - Firewall: Атака + Уязвимость (на Босса)");
        printMessage("game.inj_payload()            - Injector: Базовый урон");
        printMessage("game.inj_inject()             - Injector: Крит (если есть уязвимость)");
        printMessage("game.inj_obfuscate()          - Injector: Защита себя");
        printMessage("game.lb_bridge()              - LoadBalancer: Уравнять Latency всем");
        printMessage("game.lb_hotfix(heroIndex)     - LoadBalancer: Лечение + Снижение Latency");
        printMessage("game.skip()                   - Пропустить ход (снижает Latency на 15)");
        console.groupEnd();
    }

    // Обработка конца хода
    nextTurn() {
        if (this.boss.hp <= 0) {
            printMessage("%c🏆 ПОБЕДА! СИСТЕМА ВЗЛОМАНА.", "color: lime; font-size: 30px");
            this.isGameOver = true;
            return;
        }

        // Ход босса
        this.boss.act(this.heroes);

        // Проверка поражения
        if (this.heroes.every(h => h.isDead)) {
            printMessage("%c💀 ВАЙП! Соединение разорвано.", "color: red; font-size: 30px");
            this.isGameOver = true;
            return;
        }

        // Обновление таймеров героев
        this.heroes.forEach(h => {
            if (h.reconnectTimer > 0) {
                h.reconnectTimer--;
                if(h.reconnectTimer === 0) printMessage(`✅ ${h.name} снова в сети!`);
            }
        });

        this.turn++;
        printMessage(`\n--- TURN ${this.turn} ---`);
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
        printMessage("⏳ Команда пропускает ход для охлаждения систем...");
        this.heroes.forEach(h => {
            if (!h.isDead && h.reconnectTimer === 0) {
                h.addLatency(-15);
            }
        });
        this.nextTurn();
    }

    checkEnd() {
        if (this.isGameOver) { printMessage("Игра окончена. Обновите страницу для рестарта."); return true; }
        return false;
    }
}

function safeRemoveMessage(element) {
    if (!element || element.dataset.deleting === "true") return;
    
    element.dataset.deleting = "true"; // Флаг, чтобы не удалять дважды
    element.classList.add('fade-out');

    // 1. Попытка удалить через анимацию (для красоты)
    const onAnimationEnd = (e) => {
        if (e.animationName === 'fadeOut') {
            element.remove();
        }
    };
    element.addEventListener('animationend', onAnimationEnd, { once: true });

    // 2. Резервный таймер (предохранитель)
    // Если анимация не сработала за 700мс, удаляем вручную
    setTimeout(() => {
        if (element.parentNode) {
            element.remove();
        }
    }, 700); 
}

function printMessage(message, user){
    const messageItem = document.createElement('li');
    messageItem.className = 'message-box';

    // const user = tags['display-name'] || tags['username'];
    const userColor = '#dad607';

    messageItem.innerHTML = `
        <span class="username" style="color: ${userColor}">${user}:</span>
        <span class="text">${message}</span>
    `;

    chatContainer.prepend(messageItem);

    // Таймер жизни сообщения (1 минута)
    const lifeTimer = setTimeout(() => {
        safeRemoveMessage(messageItem);
    }, 60000);

    // Логика лимита (8 сообщений)
    const maxMessages = 8;
    const children = chatContainer.children;

    if (children.length > maxMessages) {
        for (let i = children.length - 1; i >= maxMessages; i--) {
            const el = children[i];
            // При удалении по лимиту — отменяем таймер жизни, чтобы не дублировать задачи
            clearTimeout(lifeTimer); 
            safeRemoveMessage(el);
        }
    }
}

client.on('Raw.ActionCompleted', async (data) => {
    printMessage("command triggered", data);
    if (!data.data || !data.data.arguments){
        printMessage("failed data.data reading", data);
        // return;
    }
    if (data.data.arguments.commandName === "StartGame"){
        printMessage("im here");
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
                    printMessage("im here")
                    if(game.checkEnd()) return;
                    // debugger;
                    hero.skill1_Payload(game.boss);
                } else if (hero.playerName === data.data.user.name && hero.name !== "Injector"){
                    printMessage("${data.data.user.name} is not a  DD");
                }
            });
        }
        if (data.data.arguments.commandName == "Heal"){
            
        }
    }
});
