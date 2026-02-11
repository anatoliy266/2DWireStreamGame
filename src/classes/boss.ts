import { NetworkNode } from "./base";

export class Boss extends NetworkNode {
  turnCount: number;
  constructor() {
    super("Legacy Mainframe", "boss", 500, "BOSS");
    this.turnCount = 0;
  }

  act(party: NetworkNode[]) {
    if (this.reconnectTimer > 0) {
      this.reconnectTimer--;
      console.log(
        `💤 Босс перезагружается. Осталось ходов: ${this.reconnectTimer}`,
      );
      return;
    }
    if (this.latency >= 100) {
      // Босс тоже подчиняется правилам Latency
      this.reconnectTimer = 1;
      this.latency = 0;
      console.log(`🔥 БОСС ПЕРЕГРЕЛСЯ!`);
      return;
    }

    this.turnCount++;
    const aliveHeroes = party.filter((h) => !h.isDead);
    if (aliveHeroes.length === 0) return;

    console.log(
      `%c⚠️ ХОД БОССА (Turn ${this.turnCount})`,
      "color: red; font-size: 14px",
    );

    // Логика из GDD: каждые 3 хода спец атака
    if (this.turnCount % 3 === 0) {
      this.overload(aliveHeroes);
    } else {
      // Атака самого слабого (по HP)
      aliveHeroes.sort((a, b) => a.hp - b.hp);
      const target = aliveHeroes[0];
      console.log(`🤖 Босс атакует слабейшего: ${target.name}`);
      target.takeDamage(25, this.name);
      this.addLatency(5);
    }
  }

  overload(heroes: NetworkNode[]) {
    console.log(`☠️ БОСС ИСПОЛЬЗУЕТ !OVERLOAD (AOE)`);
    heroes.forEach((h) => h.takeDamage(15, this.name));
    this.addLatency(20);
  }
}
