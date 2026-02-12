import { CONFIG } from "../config";
import { printMessage } from "../utils";
import { Firewall } from "./firewall";
import { Injector } from "./injector";
import { LoadBalancer } from "./loadbalancer";
import { TrashMob, Boss } from "./enemies";
import { NetworkBuffer } from "./buffer";

type EnemyType = Boss | TrashMob;

class Room {
  level: number;
  type: "mob" | "boss" | "empty";
  enemy: EnemyType | null;
  isCleared: boolean;

  constructor(level: number, type: "mob" | "boss" | "empty") {
    this.level = level;
    this.type = type;
    this.enemy = null;
    this.isCleared = false;
    this.setup();
  }

  setup() {
    if (this.type === "mob") {
      const names = ["Firewall Watchdog", "AntiVirus Daemon", "Protocol Droid"];
      const name = names[Math.floor(Math.random() * names.length)];
      this.enemy = new TrashMob(name, 200 + (this.level * 50));
    } else if (this.type === "boss") {
      this.enemy = new Boss();
    }
  }
}

export class Game {

  heroes: (LoadBalancer | Injector | Firewall)[];
  rooms: Room[];
  currentRoomIndex: number;
  isGameStart: boolean;
  isGameOver: boolean;
  timerId?: ReturnType<typeof setInterval>;
  
  buffer: NetworkBuffer;

  constructor() {
    this.heroes = [];
    this.currentRoomIndex = 0;
    this.rooms = [
      new Room(1, "mob"),
      new Room(2, "mob"),
      new Room(3, "boss")
    ];
    this.isGameStart = false;
    this.isGameOver = false;
    
    // Теперь this соответствует интерфейсу, так как мы вернули методы ниже
    this.buffer = new NetworkBuffer(this);
  }

  startGame() {
    this.isGameStart = true;
    this.startTimer(15);
    printMessage("=== СЕТЕВОЙ РЕЙД НАЧАЛСЯ! ===", "SYSTEM");
    this.enterRoom();
  }

  enterRoom() {
    const room = this.rooms[this.currentRoomIndex];
    printMessage(`>>> ВХОД В СЛОЙ ${room.level}: ${room.enemy ? room.enemy.name : "Пусто"} <<<`, "SYSTEM");
    printMessage("Доступные действия: !Attack, !Defend, !Search, !Heal");
    this.buffer.initTurn(this.heroes.map(h => h.playerName));
  }

  startTimer(seconds: number) {
    if (this.timerId) this.stopTimer();
    this.timerId = setInterval(() => {
      this.nextTurn();
    }, seconds * 1000);
  }

  stopTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }

  nextTurn() {
    if (this.isGameOver || !this.isGameStart) return;

    const room = this.rooms[this.currentRoomIndex];
    const activeHeroes = this.heroes.filter(h => !h.isDead);

    printMessage("\n--- КОНЕЦ ХОДА: ВЫЧИСЛЕНИЕ ---", "SYSTEM");

    if (activeHeroes.length === 0 && this.heroes.length > 0) {
      printMessage("💀 ВАЙП! Связь потеряна.", "SYSTEM");
      this.isGameOver = true;
      this.stopTimer();
      return;
    }

    if (room.enemy && !room.enemy.isDead) {
      // 1. Игроки атакуют (Буфер)
      this.buffer.resolveBuffer();

      if (room.enemy.hp <= 0) {
        room.enemy.isDead = true;
        printMessage(`🏆 ${room.enemy.name} уничтожен!`, "SYSTEM");
        this.roomCleared();
        return;
      }

      // 2. Враг атакует
      // ИСПРАВЛЕНИЕ ОШИБКИ 2: Враг не имеет свойства damage, задаем вручную в зависимости от типа
      let rawDamage = 20;
      if (room.enemy instanceof Boss) {
          rawDamage = 50; 
      } else {
          // У мобов урон зависит от уровня комнаты
          rawDamage = 15 + (room.level * 5); 
      }

      const finalDamage = this.buffer.absorbDamage(rawDamage);

      if (finalDamage > 0) {
         printMessage(`👹 ${room.enemy.name} пробивает защиту на ${finalDamage} урона!`);
         const target = activeHeroes[Math.floor(Math.random() * activeHeroes.length)];
         target.hp -= finalDamage;
         printMessage(`💔 ${target.playerName} получает ${finalDamage} урона. (HP: ${target.hp})`);
         if (target.hp <= 0) {
             target.isDead = true;
             printMessage(`💀 ${target.playerName} отключен от сети.`);
         }
      } else {
          printMessage(`🛡️ Атака ${room.enemy.name} полностью заблокирована сетью!`);
      }
    } 

    this.buffer.initTurn(activeHeroes.map(h => h.playerName));

    this.heroes.forEach(h => {
      if (h.reconnectTimer > 0) {
        h.reconnectTimer--;
        if (h.reconnectTimer === 0) printMessage(`✅ ${h.playerName} снова в сети!`);
      }
    });
    
    printMessage("--- НАЧАЛО НОВОГО ХОДА (15 сек) ---\n", "SYSTEM");
  }

  roomCleared() {
    const room = this.rooms[this.currentRoomIndex];
    room.isCleared = true;

    if (room.type === "boss") {
      printMessage("🎉 ПОБЕДА! LEGACY MAINFRAME ВЗЛОМАН!", "SYSTEM");
      this.isGameOver = true;
      this.stopTimer();
    } else {
      printMessage("✅ Слой зачищен. Переход через 10 сек...", "SYSTEM");
      this.buffer.attackSlots = [];
      this.buffer.defenseSlots = [];
      
      setTimeout(() => {
        this.currentRoomIndex++;
        if (this.currentRoomIndex < this.rooms.length) {
          this.enterRoom();
        }
      }, 10000);
    }
  }

  // --- API ИГРОКА ---

  search(playerName: string) {
      const hero = this.heroes.find(h => h.playerName === playerName);
      if (!hero || hero.isDead) return;
      hero.addLatency(CONFIG.SEARCH_COST);
      // Логика поиска
      if (Math.random() > 0.5) {
          printMessage(`🔍 ${playerName} нашел пакет данных (+HP всем).`);
          this.heroes.forEach(h => h.hp = Math.min(h.hp + 10, h.maxHp));
      } else {
          printMessage(`🔍 ${playerName} ничего не нашел.`);
      }
  }

  processAttack(playerName: string) {
    const hero = this.heroes.find(h => h.playerName === playerName);
    if (!hero || hero.isDead) return;

    let power = 20;
    let modifier = "RAW";

    if (hero instanceof Injector) { power = 35; modifier = "INJECT"; }
    else if (hero instanceof Firewall) { power = 15; modifier = "TRACE"; }

    hero.addLatency(5);
    this.buffer.addCommand(playerName, "ATTACK", "BOSS_TARGET", power, modifier);
  }

  processDef(playerName: string) {
    const hero = this.heroes.find(h => h.playerName === playerName);
    if (!hero || hero.isDead) return;
    
    let power = 15;
    let modifier = "PING";

    if (hero instanceof Firewall) { power = 40; modifier = "FIREWALL"; }
    else if (hero instanceof LoadBalancer) { power = 25; modifier = "BALANCER"; }

    hero.addLatency(5);
    this.buffer.addCommand(playerName, "DEFENSE", "RAID_SHELL", power, modifier);
  }

  processHeal(playerName: string, targetPlayerName: string = "") {
    const hero = this.heroes.find(h => h.playerName === playerName);
    if (!hero || hero.isDead) return;

    if (hero instanceof LoadBalancer) {
        hero.addLatency(10);
        // Heal добавляем в Defense слот как спец-акцию
        this.buffer.addCommand(playerName, "DEFENSE", "HOTFIX", 30, "HEAL_PATCH");
    }
  }

  // ИСПРАВЛЕНИЕ ОШИБКИ 1: Возвращаем методы для совместимости типов

  processBridge(playerName: string, targetPlayerName1: string = "") {
    const hero = this.heroes.find(h => h.playerName === playerName);
    if (hero && hero instanceof LoadBalancer) {
        hero.addLatency(10);
        // Bridge теперь работает как защитный бафф через буфер
        this.buffer.addCommand(playerName, "DEFENSE", "BRIDGE", 20, "STABILIZE");
    }
  }

  processDebuff(playerName: string) {
    const hero = this.heroes.find(h => h.playerName === playerName);
    if (hero && hero instanceof LoadBalancer) {
        hero.addLatency(10);
        // Debuff теперь работает как атака
        this.buffer.addCommand(playerName, "ATTACK", "BOSS_Target", 10, "OVERLOAD");
    }
  }

  checkEnd() {
    if (this.isGameOver) {
      console.log("Игра окончена.");
      return true;
    }
    return false;
  }

  addPlayer(playerName: string, roleArg?: string) {
    if (this.heroes.some(h => h.playerName === playerName)) return;

    let role = roleArg;
    if (!role) {
      const roles = ["tank", "dd", "heal"];
      role = roles[Math.floor(Math.random() * roles.length)];
    }

    let newHero: Firewall | Injector | LoadBalancer;
    switch (role.toLowerCase()) {
      case "tank": newHero = new Firewall(playerName); break;
      case "dd": newHero = new Injector(playerName); break;
      case "heal": newHero = new LoadBalancer(playerName); break;
      default: newHero = new Injector(playerName);
    }

    this.heroes.push(newHero);
    printMessage(`${playerName} присоединился как ${newHero.name}`, "SYSTEM");
  }
}