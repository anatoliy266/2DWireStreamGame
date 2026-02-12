import { printMessage } from "../utils"; // Предполагаем наличие
import { Game } from "./game";

// Типы команд согласно GDD
export type ActionType = "ATTACK" | "DEFENSE" | "HEAL";

// Атомарная команда (Unit)
export interface BufferUnit {
  id: string;
  action: ActionType;
  targetId: string; // ID врага или игрока
  modifiers: string[]; // Названия скиллов/модификаторов
  power: number; // Базовая сила
  owners: string[]; // Список игроков, вложившихся в этот юнит
  comboMultiplier: number; // x1.0, x1.5, x2.0, x4.0
  type: "attack" | "defense";
}

export class NetworkBuffer {
  // Слоты буфера (GDD: 3 атаки, 4 защиты)
  attackSlots: BufferUnit[] = [];
  defenseSlots: BufferUnit[] = [];
  
  // Лимиты
  readonly MAX_ATTACK_SLOTS = 3;
  readonly MAX_DEFENSE_SLOTS = 4;
  readonly MAX_COMBO = 4; // x4 кап

  // Игроки, назначенные на защитные слоты в текущем ходу
  designatedDefenders: string[] = [];

  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  // Начало хода: назначаем случайных "дефендеров" (GDD п.1)
  initTurn(allPlayerNames: string[]) {
    this.attackSlots = [];
    this.defenseSlots = [];
    
    // Выбираем до 4 случайных игроков для защитных слотов
    this.designatedDefenders = [];
    const pool = [...allPlayerNames];
    for (let i = 0; i < this.MAX_DEFENSE_SLOTS; i++) {
      if (pool.length === 0) break;
      const rnd = Math.floor(Math.random() * pool.length);
      this.designatedDefenders.push(pool[rnd]);
      // Можно повторно выбирать (согласно GDD), но для MVP сделаем без повторов если игроков хватает
      // Если хотим повторы как в GDD: не удаляем из pool
    }
    
    printMessage(`🛡️ Назначены на защиту портов: ${this.designatedDefenders.join(", ")}`, "BUFFER");
  }

  // Добавление команды в Raw Pool -> попытка Fusion -> Slot или Overflow
  addCommand(playerName: string, action: ActionType, targetId: string, power: number, modifier: string) {
    const type = (action === "ATTACK") ? "attack" : "defense"; // HEAL можно считать defense или attack в зависимости от контекста, здесь упростим
    
    const newUnit: BufferUnit = {
      id: Math.random().toString(36).substr(2, 9),
      action,
      targetId,
      modifiers: [modifier],
      power,
      owners: [playerName],
      comboMultiplier: 1.0,
      type: type as "attack" | "defense"
    };

    const targetSlots = type === "attack" ? this.attackSlots : this.defenseSlots;
    const maxSlots = type === "attack" ? this.MAX_ATTACK_SLOTS : this.MAX_DEFENSE_SLOTS;

    // 1. Попытка Combo Fusion (GDD п.4)
    // Ищем слот с таким же ACTION или TARGET, который еще не достиг капа
    const comboCandidate = targetSlots.find(slot => 
      (slot.action === newUnit.action || slot.targetId === newUnit.targetId) && 
      slot.owners.length < this.MAX_COMBO
    );

    if (comboCandidate) {
      this.performFusion(comboCandidate, newUnit);
      return;
    }

    // 2. Если Fusion невозможен, занимаем новый слот
    if (targetSlots.length < maxSlots) {
      targetSlots.push(newUnit);
      printMessage(`[BUFFER] New Unit: [${modifier}] ${action} (by ${playerName})`, "SYSTEM");
    } else {
      // 3. Overflow (GDD п.7)
      this.triggerOverflow(playerName, newUnit);
    }
  }

  private performFusion(base: BufferUnit, incoming: BufferUnit) {
    // Слияние (GDD п.5)
    base.owners.push(...incoming.owners);
    base.modifiers.push(...incoming.modifiers);
    base.power += incoming.power; // Складываем базовую силу

    // Расчет множителя (GDD п.6)
    const count = base.owners.length;
    if (count === 2) base.comboMultiplier = 1.5;
    else if (count === 3) base.comboMultiplier = 2.0;
    else if (count >= 4) base.comboMultiplier = 2.6; // Кап

    printMessage(`⚡ COMBO FUSION X${count}! [${base.modifiers.join("+")}] Power: ${Math.floor(base.power * base.comboMultiplier)}`, "BUFFER");
  }

  private triggerOverflow(causer: string, unit: BufferUnit) {
    // Расчет урона Overflow (GDD п.7)
    // Упрощенная формула: (Текущая длина + 1 - Макс) * 10
    const overflowDamage = 15; 

    printMessage(`⚠️ OVERFLOW! Буфер переполнен командой от ${causer}!`, "ERROR");

    // Урон наносится:
    // 1. Владельцам атакующих юнитов в комбо (всем кто сейчас в атакующих слотах)
    const victims = new Set<string>();
    
    // Добавляем виновника
    victims.add(causer);

    // Добавляем назначенных защитников (GDD п.7 - страдают они)
    this.designatedDefenders.forEach(d => victims.add(d));

    // Наносим Latency урон
    victims.forEach(vName => {
      const hero = this.game.heroes.find(h => h.playerName === vName);
      if (hero) {
        hero.addLatency(overflowDamage);
        printMessage(`💥 ${vName} получил ${overflowDamage} Latency dmg (Overflow)`, "ERROR");
      }
    });
  }

  // Выполнение буфера в конце хода
  resolveBuffer() {
    const room = this.game.rooms[this.game.currentRoomIndex];
    if (!room.enemy || room.enemy.isDead) return;

    printMessage("🔄 ВЫПОЛНЕНИЕ БУФЕРА...", "SYSTEM");

    // 1. Атака Босса (освобождает слоты атаки)
    if (this.attackSlots.length > 0) {
        this.attackSlots.forEach(unit => {
            const finalDamage = Math.floor(unit.power * unit.comboMultiplier);
            const owners = unit.owners.join("+");
            
            printMessage(`⚔️ EXECUTE: ${owners} наносят ${finalDamage} урона! (Combo x${unit.comboMultiplier})`);
            
            // Наносим урон врагу
            room.enemy?.takeDamage(finalDamage, owners);
        });
        this.attackSlots = []; // Очистка
    } else {
        printMessage("... Буфер атаки пуст.", "SYSTEM");
    }

    // Защитные слоты сохраняются до момента атаки босса (которая происходит сразу после execute)
  }

  // Босс атакует и тратит защитные слоты
  absorbDamage(damage: number): number {
    if (this.defenseSlots.length > 0) {
        // Берем первый защитный слот
        const defUnit = this.defenseSlots.shift(); // Удаляем слот (тратится)
        if (defUnit) {
            const mitigation = Math.floor(defUnit.power * defUnit.comboMultiplier);
            printMessage(`🛡️ BLOCK! Комбо [${defUnit.owners.join("+")}] поглотило ${mitigation} урона.`);
            
            const remaining = Math.max(0, damage - mitigation);
            return remaining;
        }
    }
    return damage;
  }
}