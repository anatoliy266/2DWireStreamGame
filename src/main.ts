import { StreamerbotClient } from "@streamerbot/client";
import { players, role } from "./classes/base";
import { Firewall } from "./classes/firewall";
import { Game } from "./classes/game";
import { Injector } from "./classes/injector";
import { LoadBalancer } from "./classes/loadbalancer";

const client = new StreamerbotClient();

let game: Game | undefined;

client.on("Raw.ActionCompleted", async (data) => {
  console.log("command triggered", data);
  if (!data.data || !data.data.arguments) {
    console.log("failed data.data reading", data);
    return;
  }
  if (data.data.arguments.commandName === "StartGame") {
    game = new Game();
  }

  if (!game || game.isGameOver) return;

  if (data.data.arguments.commandName === "JoinBattle") {
    // const roles = ["tank", "dd", "heal"];
    const roles: players[] = ["dd"];
    const role = roles[Math.floor(Math.random() * roles.length)];
    let player;
    switch (role) {
      case "tank":
        player = new Firewall(data.data.user.name);
        break;
      case "dd":
        // Code to be executed if expression === value2
        player = new Injector(data.data.user.name);
        break;
      case "heal":
        player = new LoadBalancer(data.data.user.name);
        // Code to be executed if expression === value2
        break;
    }
    game.heroes.push(player);
  }

  if (data.data.arguments.commandName === "Attack") {
    game.heroes.forEach((hero) => {
      if (hero.role !== "dd" || !(hero instanceof Injector))
        return console.log("${data.data.user.name} is not a  DD");

      hero.skill1_Payload(game!.boss);
    });
  }
  if (data.data.arguments.commandName == "Heal") {
    // TODO
  }
});
