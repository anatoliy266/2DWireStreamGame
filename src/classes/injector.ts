import { CONFIG } from "../config";
import { NetworkNode } from "./base";

export class Injector extends NetworkNode {
  constructor(playerName: string) {
    super("Injector", "dd", 80, playerName);
  }

  skill1_Payload(target: NetworkNode) {
    // !payload
    // debugger;
    if (!this.canAct()) return;
    console.log(`⚔️ ${this.name} отправляет !payload в ${target.name}`);
    target.takeDamage(20, this.name);
    this.payCost(CONFIG.LATENCY_COST_BASIC);
  }

  skill2_Inject(target: NetworkNode) {
    // !inject
    if (!this.canAct()) return;
    if (target.statuses.vulnerable) {
      console.log(
        `☣️ ${this.name} использует !inject в УЯЗВИМОСТЬ! КРИТИЧЕСКИЙ УРОН!`,
      );
      target.takeDamage(50, this.name);
      target.statuses.vulnerable = false; // Снимаем метку
    } else {
      console.log(
        `⚔️ ${this.name} пытается сделать !inject, но уязвимости нет. Обычный урон.`,
      );
      target.takeDamage(15, this.name);
    }
    this.payCost(CONFIG.LATENCY_COST_ULT);
  }

  skill3_Obfuscate() {
    // !obfuscate
    if (!this.canAct()) return;
    console.log(`👻 ${this.name} включает !obfuscate (маскировка трафика)`);
    this.statuses.obfuscated = true;
    this.payCost(CONFIG.LATENCY_COST_BASIC);
  }
}
