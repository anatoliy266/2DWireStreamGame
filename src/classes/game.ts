// game.ts
import { CONFIG } from "../config";
import { printMessage } from "../utils";
import { NetworkNode } from "./base";
import { Firewall } from "./firewall";
import { Injector } from "./injector";
import { LoadBalancer } from "./loadbalancer";
import { TrashMob, Boss } from "./enemies";

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
      this.enemy = new TrashMob(name, 100 + (this.level * 20));
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
  timerId?: ReturnType<typeof setInterval>; // Исправлен тип с setTimeout на setInterval

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
  }

  startGame() {
    this.isGameStart = true;
    this.startTimer(10);
    printMessage("=== СЕТЕВОЙ РЕЙД НАЧАЛСЯ! ===", "SYSTEM");
    this.enterRoom();
  }

  enterRoom() {
    const room = this.rooms[this.currentRoomIndex];
    printMessage(`>>> ВХОД В СЛОЙ ${room.level}: ${room.enemy ? room.enemy.name : "Пусто"} <<<`, "SYSTEM");
    printMessage("Доступные действия: !Attack, !Heal, !Search (поиск бонуса)");
  }

  startTimer(seconds: number) {
    if (this.timerId) this.stopTimer();
    // ВАЖНО: Используем стрелочную функцию
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

    // 1. Проверка вайпа
    if (activeHeroes.length === 0 && this.heroes.length > 0) {
      printMessage("💀 ВАЙП! Связь потеряна.", "SYSTEM");
      this.isGameOver = true;
      this.stopTimer();
      return;
    }

    // 2. Логика боя
    if (room.enemy && !room.enemy.isDead) {
      // Враг атакует
      room.enemy.act(activeHeroes);

      // Если враг умер от дотов или рефлектов
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
        if (h.reconnectTimer === 0) printMessage(`✅ ${h.playerName} снова в сети!`);
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
      this.stopTimer();
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

  // --- API ИГРОКА (Действия из чата) ---

  search(playerName: string) {
    const hero = this.heroes.find(h => h.playerName === playerName);
    if (!hero || hero.isDead) return;

    // Можно искать и во время боя, но это риск (по GDD)
    hero.addLatency(CONFIG.SEARCH_COST);
    if (Math.random() < CONFIG.SEARCH_CHANCE) {
      printMessage(`🔍 ${playerName} нашел "Бит Данных"! Все восстановили 20 HP.`);
      this.heroes.forEach(h => { if (!h.isDead) h.hp = Math.min(h.hp + 20, h.maxHp); });
    } else {
      printMessage(`🔍 ${playerName} ничего не нашел, только потратил трафик.`);
    }
  }

  processAttack(playerName: string) {
    const hero = this.heroes.find(h => h.playerName === playerName);
    if (!hero) return;

    const room = this.rooms[this.currentRoomIndex];
    if (!room.enemy || room.enemy.isDead) {
      printMessage(`${playerName}, здесь некого бить!`);
      return;
    }

    // Логика авто-выбора скилла в зависимости от класса
    if (hero instanceof Injector) {
      hero.skill1_Payload(room.enemy);
    } else if (hero instanceof Firewall) {
      hero.skill3_Traceback(room.enemy);
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

  processHeal(playerName: string) {
    const hero = this.heroes.find(h => h.playerName === playerName);
    if (hero && hero instanceof LoadBalancer) {
      // Лечим самого раненого
      const alive = this.heroes.filter(h => !h.isDead);
      if (alive.length > 0) {
        const target = alive.sort((a, b) => a.hp - b.hp)[0];
        hero.skill3_Hotfix(target);
      } else {
        printMessage(`${playerName}, лечить некого...`);
      }
    }
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
      default: newHero = new Injector(playerName); // Фоллбек
    }

    this.heroes.push(newHero);
    printMessage(`${playerName} присоединился как ${newHero.name}`, "SYSTEM");
  }

  // Для совместимости с console API (отладка)
  checkEnd() {
    if (this.isGameOver) {
      console.log("Игра окончена.");
      return true;
    }
    return false;
  }
}