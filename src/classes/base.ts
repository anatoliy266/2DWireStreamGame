import { CONFIG } from "../config";

export type boss = "boss";

export type players = "dd" | "heal" | "tank";

export type role = players | boss;

export class NetworkNode {
  name: string;
  role: role;
  hp: number;
  maxHp: number;
  playerName: string;
  latency: number;
  isDead: boolean;
  reconnectTimer: number;
  statuses: {
    vulnerable: boolean; // Для комбо Traceback -> Inject
    shielded: boolean; // Intercept
    obfuscated: boolean;
  };
  constructor(name: string, role: role, hp: number, playerName: string) {
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
      shielded: false, // Intercept
      obfuscated: false, // Зашумление
    };
  }

  // Проверка состояния
  checkStatus() {
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      console.log(
        `%c💀 ${this.name} отключен от сети (DISCONNECT)!`,
        "color: red; font-weight: bold;",
      );
    }
    if (this.latency >= CONFIG.LATENCY_MAX && this.reconnectTimer === 0) {
      this.reconnectTimer = CONFIG.RECONNECT_TURNS;
      this.latency = 0; // Сброс при перегрузке
      console.log(
        `%c🔌 ${this.name} перегрелся! ПЕРЕПОДКЛЮЧЕНИЕ (${CONFIG.RECONNECT_TURNS} ход.)`,
        "color: orange; font-weight: bold;",
      );
    }
  }

  // Получение урона
  takeDamage(amount: number, sourceName: string) {
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
    console.log(
      `💥 ${sourceName} наносит ${finalDamage} урона по ${this.name}. [HP: ${this.hp}/${this.maxHp}]`,
    );
    this.checkStatus();
  }

  // Изменение Latency
  addLatency(amount: number) {
    this.latency += amount;
    if (this.latency < 0) this.latency = 0;
    console.log(`📶 ${this.name} Latency: ${this.latency}% (+${amount})`);
    this.checkStatus();
  }

  canAct() {
    if (this.isDead) {
      console.log(`${this.name} мертв.`);
      return false;
    }
    if (this.reconnectTimer > 0) {
      console.log(`${this.name} перезагружается...`);
      return false;
    }
    return true;
  }
  payCost(cost: number) {
    this.addLatency(cost);
  }
}
