import { CONFIG } from "../config";
import { printMessage } from "../utils";

export type boss = "boss";
export type mob = "mob";

export type players = "dd" | "heal" | "tank";

export type role = players | boss | mob;

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

  // Получение урона
  takeDamage(amount: number, sourceName: string) {
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

  // Изменение Latency
  addLatency(amount: number) {
    this.latency += amount;
    if (this.latency < 0) this.latency = 0;
    // console.log(`📶 ${this.name} Latency: ${this.latency}% (+${amount})`);
    this.checkStatus();
  }

  canAct(): boolean {
    if (this.isDead) {
      printMessage(`${this.playerName} мертв.`);
      return false;
    }
    if (this.reconnectTimer > 0) {
      printMessage(`${this.playerName} перезагружается...`);
      return false;
    }
    return true;
  }

  payCost(cost: number) {
    this.addLatency(cost);
  }
}
