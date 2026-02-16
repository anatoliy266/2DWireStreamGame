import { StreamerbotClient } from "@streamerbot/client";
import { GameController } from "./GameController";

const game = new GameController();
const client = new StreamerbotClient();

// --- STREAMER.BOT INTEGRATION ---
client.on("Raw.ActionCompleted", async (data: any) => {
  if (!data.data || !data.data.arguments) return;

  const args = data.data.arguments;
  const commandName = args.commandName as string; 
  const rawInput = (args.rawInput as string) || "";
  
  const userId = data.data.user?.id;
  const userName = data.data.user?.name || "Anonymous";

  if (!userId) return;

  // System
  if (commandName === "StartGame") {
    if (!game.isGameRunning) game.startGame();
    return;
  }

  // Determine Intent from Chat
  let intent = "";
  if (commandName === "Attack") intent = "attack";
  else if (commandName === "Def") intent = "defend";
  
  // Modifiers
  let fullCommand = intent;
  if (rawInput.includes("sudo")) fullCommand = "sudo " + intent;

  if (intent) {
    game.handleInput(userId.toString(), userName, fullCommand, args);
  }
});

// For testing purposes: Mock connection
// client.connect(); 

// --- MANUAL DEBUG CONTROLS (For Browser Testing without Twitch) ---
// Add global functions to window so we can button mash in console or via temp buttons
(window as any).debugGame = game;
(window as any).mockChat = (name: string, cmd: string) => {
    game.handleInput(name, name, cmd, {});
};