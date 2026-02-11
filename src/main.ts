import { StreamerbotClient } from "@streamerbot/client";
import { players, role } from "./classes/base";
import { Firewall } from "./classes/firewall";
import { Game } from "./classes/game";
import { Injector } from "./classes/injector";
import { LoadBalancer } from "./classes/loadbalancer";

// Инициализация клиента
const client = new StreamerbotClient();

// Хранилище состояния игры
let game: Game | undefined;

client.on("Raw.ActionCompleted", async (data) => {
  // 1. Безопасная валидация данных
  if (!data.data || !data.data.arguments) {
    // Можно раскомментировать для отладки, но обычно это спам
    // console.warn("Received event without arguments", data);
    return;
  }

  const args = data.data.arguments;
  const commandName = args.commandName;
  
  // Получаем имя пользователя безопасно (с фоллбеком)
  const userName = data.data.user?.name || "Anonymous";

  // --- ЛОГИКА КОМАНД ---

  // 1. Старт игры
  if (commandName === "StartGame") {
    if (!game || game.isGameOver) {
      console.log("🎮 Запуск новой игры...");
      game = new Game();
      game.startGame();
    } else {
      console.log("⚠️ Игра уже идет!");
    }
    return;
  }

  // Если игры нет или она закончилась, остальные команды игнорируем
  if (!game || !game.isGameStart || game.isGameOver) return;

  // 2. Присоединение к битве
  if (commandName === "JoinBattle") {
    // Если в Streamerbot настроен аргумент role, берем его, иначе undefined (в Game будет рандом)
    const roleArg = args.role as string | undefined;
    game.addPlayer(userName, roleArg);
  }

  // 3. Атака (делегируем логику в Game)
  if (commandName === "Attack") {
    game.processAttack(userName);
  }

  // 4. Поиск (механика The Hops)
  if (commandName === "Search") {
    game.search(userName);
  }

  // 5. Лечение
  if (commandName === "Heal") {
    // Ищем героя по имени игрока
    const hero = game.heroes.find((h) => h.playerName === userName);
    
    // Проверяем, что это LoadBalancer
    if (hero && hero instanceof LoadBalancer) {
        // Находим самого раненого (сортировка по HP)
        const aliveHeroes = game.heroes.filter(h => !h.isDead);
        if (aliveHeroes.length > 0) {
            const target = aliveHeroes.sort((a, b) => a.hp - b.hp)[0];
            hero.skill3_Hotfix(target);
        } else {
            console.log(`🚑 ${userName}, лечить некого...`);
        }
    } else {
        console.log(`⚠️ ${userName} пытается лечить, но он не LoadBalancer.`);
    }
  }
});