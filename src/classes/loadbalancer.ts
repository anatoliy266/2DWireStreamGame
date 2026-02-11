import { CONFIG } from "../config";
import { printMessage } from "../utils";
import { NetworkNode } from "./base";

export class LoadBalancer extends NetworkNode {
  constructor(playerName: string) { super("LoadBalancer", "heal", 100, playerName); }
  skill1_Bridge(party: NetworkNode[]) {
    if (!this.canAct()) return;
    let totalLat = 0; let activeCount = 0;
    party.forEach(p => { if (!p.isDead) { totalLat += p.latency; activeCount++; } });
    const avg = activeCount > 0 ? Math.floor(totalLat / activeCount) : 0;
    party.forEach(p => { if (!p.isDead) p.latency = avg; });
    printMessage(`Latency уравнена: ${avg}%`);
    this.payCost(CONFIG.LATENCY_COST_BASIC);
  }
  skill2_Compress(target: NetworkNode) {
    if (!this.canAct()) return;
    printMessage(`🐌 ${this.name} делает !compress на ${target.name}`);
    target.addLatency(20);
    this.payCost(CONFIG.LATENCY_COST_ULT);
  }
  skill3_Hotfix(target: NetworkNode) {
    if (!this.canAct()) return;
    printMessage(`${this.playerName} лечит ${target.playerName}`);
    target.hp = Math.min(target.hp + 30, target.maxHp);
    target.addLatency(-20);
    this.payCost(CONFIG.LATENCY_COST_BASIC);
  }
}
