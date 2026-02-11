import { CONFIG } from "../config";
import { printMessage } from "../utils";
import { NetworkNode } from "./base";

export class Injector extends NetworkNode {
  constructor(playerName: string) { super("Injector", "dd", 80, playerName); }
  skill1_Payload(target: NetworkNode) {
    if (!this.canAct()) return;
    printMessage(`${this.playerName} использует !payload на ${target.name}`);
    target.takeDamage(20, this.playerName);
    this.payCost(CONFIG.LATENCY_COST_BASIC);
  }
  skill2_Inject(target: NetworkNode) {
    if (!this.canAct()) return;
    if (target.statuses.vulnerable) {
      printMessage(`${this.playerName} использует !inject КРИТ!`);
      target.takeDamage(50, this.playerName);
      target.statuses.vulnerable = false;
    } else {
      printMessage(`${this.playerName} использует !inject (нет уязвимости)`);
      target.takeDamage(15, this.playerName);
    }
    this.payCost(CONFIG.LATENCY_COST_ULT);
  }
  skill3_Obfuscate() {
    if (!this.canAct()) return;
    printMessage(`👻 ${this.name} включает !obfuscate (маскировка трафика)`);
    this.statuses.obfuscated = true;
    this.payCost(CONFIG.LATENCY_COST_BASIC);
  }
}
