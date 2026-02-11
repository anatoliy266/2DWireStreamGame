import { CONFIG } from "../config";
import { printMessage } from "../utils";
import { NetworkNode } from "./base";

export class Firewall extends NetworkNode {
  constructor(playerName: string) { super("Firewall", "tank", 150, playerName); }
  skill1_Intercept(target: NetworkNode) {
    if (!this.canAct()) return;
    printMessage(`${this.playerName} использует !intercept на ${target.playerName}`);
    target.statuses.shielded = true;
    this.payCost(CONFIG.LATENCY_COST_BASIC);
  }
  skill2_PacketFilter(party: NetworkNode[]) {
    if (!this.canAct()) return;
    printMessage(`🛡️ ${this.playerName} использует !packet_filter. Группа получает временную защиту.`);
    party.forEach(p => { if (!p.isDead) p.hp += 5; });
    this.payCost(CONFIG.LATENCY_COST_ULT);
  }
  skill3_Traceback(target: NetworkNode) {
    if (!this.canAct()) return;
    printMessage(`${this.playerName} использует !traceback на ${target.name}. УЯЗВИМОСТЬ!`);
    target.takeDamage(10, this.playerName);
    target.statuses.vulnerable = true;
  }
}
