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
    if (!game.isGameRunning) {
      game.prepareGame();
    }
    return;
  }

  // Determine Intent from Chat
  ////////////////////////////////////////////////////////////////////
  //переписать блок чтобы реагировал не на команды а на чат сообщения, условно чтобы типы писали линух подобные командыы а интерпретатор в пуле их парсил и комбинировал в комбухи
  ////////////////////////////////////////////////////////////////////
});

client.on("Twitch.ChatMessage", async (data: any) => {
  console.log(data);
  const userId = data.data.user?.id;
  const userName = data.data.user?.name || "Anonymous";
  if (game.isPrepStage) {
    const userId = data.data.user?.id;
    const userName = data.data.user?.name || "Anonymous";
    game.addPlayer(userId, userName,);
    return;
  }
  const text: string = data.data.text;
  game.handleInput(userId.toString(), userName, text);
});
// For testing purposes: Mock connection
// client.connect(); 

// --- MANUAL DEBUG CONTROLS (For Browser Testing without Twitch) ---
// Add global functions to window so we can button mash in console or via temp buttons
(window as any).debugGame = game;
(window as any).mockChat = (name: string, cmd: string) => {
  game.handleInput(name, name, cmd, {});
};