import { CONFIG } from "../config";
import { NetworkNode } from "./base";

export class Firewall extends NetworkNode {
  constructor(playerName: string) {
    super("Firewall", "tank", 150, playerName);
  }

  skill1_Intercept(target: NetworkNode) {
    // !intercept
    if (!this.canAct()) return;
    console.log(`🛡️ ${this.name} использует !intercept на ${target.name}`);
    target.statuses.shielded = true;
    this.payCost(CONFIG.LATENCY_COST_BASIC);
  }

  skill2_PacketFilter(party: NetworkNode[]) {
    // !packet_filter
    if (!this.canAct()) return;
    console.log(
      `🛡️ ${this.name} использует !packet_filter. Группа получает временную защиту.`,
    );
    // Упрощение для MVP: лечим чуть-чуть всех, имитируя снижение урона
    party.forEach((p) => {
      if (!p.isDead) p.hp += 5;
    });
    this.payCost(CONFIG.LATENCY_COST_ULT);
  }

  skill3_Traceback(target: NetworkNode) {
    // !traceback
    if (!this.canAct()) return;
    console.log(
      `🎯 ${this.name} использует !traceback на ${target.name}. УЯЗВИМОСТЬ ВСКРЫТА!`,
    );
    target.takeDamage(10, this.name);
    target.statuses.vulnerable = true; // Триггер для Инжектора
    // Бесплатно по GDD
  }
}
