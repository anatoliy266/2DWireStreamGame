import { NetworkNode } from "./base";
import { Boss } from "./boss";
import { Firewall } from "./firewall";
import { Injector } from "./injector";
import { LoadBalancer } from "./loadbalancer";

export class Game {
  heroes: (LoadBalancer | Injector | Firewall)[];
  boss: Boss;
  turn: number;
  isGameOver: boolean;
  timerId?: ReturnType<typeof setTimeout>;
  counter: number;
  constructor() {
    this.heroes = [
      // new Firewall("test"), new Injector(), new LoadBalancer()
    ];
    this.boss = new Boss();
    this.turn = 1;
    this.isGameOver = false;

    // this.timerId = null; // Храним ID таймера, чтобы потом остановить
    this.counter = 0;

    this.printIntro();

    this.startTimer(10);
  }

  startTimer(seconds: number) {
    // Если таймер уже запущен, сначала очистим старый
    if (this.timerId) this.stopTimer();

    console.log("Таймер запущен!");

    // ВАЖНО: Используем стрелочную функцию () =>, чтобы this указывал на класс
    this.timerId = setInterval(() => {
      this.nextTurn();
    }, seconds * 1000); // Переводим секунды в миллисекунды
  }
  stopTimer() {
    this.timerId?.close();
  }

  printIntro() {
    console.clear();
    console.log(
      "%c=== NETWORK RAID START ===",
      "color: lime; font-size: 20px; background: black; padding: 10px;",
    );
    console.log("Цель: Уничтожить Legacy Mainframe.");
    console.log(
      "Внимание: Следите за Latency! Если будет 100% - вы пропустите 2 хода.",
    );
    this.help();
    this.status();
  }

  status() {
    console.table(
      this.heroes.map((h) => ({
        Name: h.name,
        HP: `${h.hp}/${h.maxHp}`,
        Latency: `${h.latency}%`,
        Status:
          h.reconnectTimer > 0 ? `RECONNECT (${h.reconnectTimer})` : "Active",
      })),
    );
    console.log(`👾 BOSS HP: ${this.boss.hp} | Latency: ${this.boss.latency}%`);
  }

  help() {
    console.group("📜 СПИСОК КОМАНД (введите в консоль):");
    console.log(
      "game.fw_intercept(heroIndex)  - Firewall: Защитить союзника (0=FW, 1=INJ, 2=LB)",
    );
    console.log(
      "game.fw_traceback()           - Firewall: Атака + Уязвимость (на Босса)",
    );
    console.log("game.inj_payload()            - Injector: Базовый урон");
    console.log(
      "game.inj_inject()             - Injector: Крит (если есть уязвимость)",
    );
    console.log("game.inj_obfuscate()          - Injector: Защита себя");
    console.log(
      "game.lb_bridge()              - LoadBalancer: Уравнять Latency всем",
    );
    console.log(
      "game.lb_hotfix(heroIndex)     - LoadBalancer: Лечение + Снижение Latency",
    );
    console.log(
      "game.skip()                   - Пропустить ход (снижает Latency на 15)",
    );
    console.groupEnd();
  }

  // Обработка конца хода
  nextTurn() {
    if (this.boss.hp <= 0) {
      console.log(
        "%c🏆 ПОБЕДА! СИСТЕМА ВЗЛОМАНА.",
        "color: lime; font-size: 30px",
      );
      this.isGameOver = true;
      return;
    }

    // Ход босса
    this.boss.act(this.heroes);

    // Проверка поражения
    if (this.heroes.every((h) => h.isDead)) {
      console.log(
        "%c💀 ВАЙП! Соединение разорвано.",
        "color: red; font-size: 30px",
      );
      this.isGameOver = true;
      return;
    }

    // Обновление таймеров героев
    this.heroes.forEach((h) => {
      if (h.reconnectTimer > 0) {
        h.reconnectTimer--;
        if (h.reconnectTimer === 0) console.log(`✅ ${h.name} снова в сети!`);
      }
    });

    this.turn++;
    console.log(`\n--- TURN ${this.turn} ---`);
    this.status();
  }

  //  TODO:  игра расчитана на то что в [0] всегда будет дд и так далее
  // это критический баг

  // Firewall Actions
  fw_intercept(targetIdx: number) {
    if (this.checkEnd()) return;
    this.heroes[0].skill1_Intercept(this.heroes[targetIdx]);
    this.nextTurn();
  }
  fw_traceback() {
    if (this.checkEnd()) return;
    this.heroes[0].skill3_Traceback(this.boss);
    this.nextTurn();
  }

  // Injector Actions
  inj_payload() {
    if (this.checkEnd()) return;
    this.heroes[1].skill1_Payload(this.boss);
    this.nextTurn();
  }
  inj_inject() {
    if (this.checkEnd()) return;
    this.heroes[1].skill2_Inject(this.boss);
    this.nextTurn();
  }
  inj_obfuscate() {
    if (this.checkEnd()) return;
    this.heroes[1].skill3_Obfuscate();
    this.nextTurn();
  }

  // LoadBalancer Actions
  lb_bridge() {
    if (this.checkEnd()) return;
    this.heroes[2].skill1_Bridge(this.heroes);
    this.nextTurn();
  }
  lb_hotfix(targetIdx: number) {
    if (this.checkEnd()) return;
    this.heroes[2].skill3_Hotfix(this.heroes[targetIdx]);
    this.nextTurn();
  }

  // General
  skip() {
    if (this.checkEnd()) return;
    console.log("⏳ Команда пропускает ход для охлаждения систем...");
    this.heroes.forEach((h) => {
      if (!h.isDead && h.reconnectTimer === 0) {
        h.addLatency(-15);
      }
    });
    this.nextTurn();
  }

  checkEnd() {
    if (this.isGameOver) {
      console.log("Игра окончена. Обновите страницу для рестарта.");
      return true;
    }
    return false;
  }
}
