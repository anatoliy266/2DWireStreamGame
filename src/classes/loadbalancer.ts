import { CONFIG } from "../config";
import { NetworkNode } from "./base";

export class LoadBalancer extends NetworkNode {
  constructor(playerName: string) {
    super("LoadBalancer", "heal", 100, playerName);
  }

  skill1_Bridge(party: NetworkNode[]) {
    // !bridge
    if (!this.canAct()) return;
    console.log(`⚖️ ${this.name} строит !bridge. Выравнивание Latency...`);
    let totalLat = 0;
    let activeCount = 0;
    party.forEach((p) => {
      if (!p.isDead) {
        totalLat += p.latency;
        activeCount++;
      }
    });
    const avg = Math.floor(totalLat / activeCount);
    party.forEach((p) => {
      if (!p.isDead) p.latency = avg;
    });
    console.log(`Все живые узлы теперь имеют Latency: ${avg}%`);
    this.payCost(CONFIG.LATENCY_COST_BASIC);
  }

  skill2_Compress(target: NetworkNode) {
    // !compress
    if (!this.canAct()) return;
    console.log(`🐌 ${this.name} делает !compress на ${target.name}`);
    target.addLatency(20); // Забиваем канал боссу
    this.payCost(CONFIG.LATENCY_COST_ULT);
  }

  skill3_Hotfix(target: NetworkNode) {
    // !hotfix
    if (!this.canAct()) return;
    console.log(`🚑 ${this.name} накатывает !hotfix на ${target.name}`);
    target.hp += 30;
    if (target.hp > target.maxHp) target.hp = target.maxHp;
    target.addLatency(-20); // Снижаем латенси
    this.payCost(CONFIG.LATENCY_COST_BASIC);
  }
}
