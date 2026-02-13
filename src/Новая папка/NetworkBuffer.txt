import { PlayerNode } from "./PlayerNode";

export interface Slot {
    index: number;
    count: number; // Combo X1 - X4
    locked: boolean; // Для способностей босса
    assignedEntityId: string | null; // ID игрока (Def) или ID врага (Atk)
}

export class NetworkBuffer {
    attackSlots: Slot[];
    defenseSlots: Slot[];
    readonly MAX_COMBO = 4;

    constructor() {
        this.attackSlots = [0, 1, 2].map(i => ({ index: i, count: 0, locked: false, assignedEntityId: null }));
        this.defenseSlots = [0, 1, 2, 3].map(i => ({ index: i, count: 0, locked: false, assignedEntityId: null }));
    }

    reset() {
        this.attackSlots.forEach(s => { s.count = 0; s.locked = false; });
        this.defenseSlots.forEach(s => { s.count = 0; s.locked = false; s.assignedEntityId = null; });
    }

    // === ЛОГИКА АТАКИ (Жадное заполнение) ===
    // Возвращает true, если успешно, false - если Overflow
    addAttackToken(targetSlotIndex?: number): boolean {
        // Если указан конкретный слот (например, добивание)
        if (targetSlotIndex !== undefined) {
             const slot = this.attackSlots[targetSlotIndex];
             if (slot && slot.count < this.MAX_COMBO && !slot.locked) {
                 slot.count++;
                 return true;
             }
             return false;
        }

        // Авто-роутинг: A1 -> A2 -> A3
        for (const slot of this.attackSlots) {
            // Пропускаем слоты без врагов (если враг убит, слот неактивен)
            if (!slot.assignedEntityId) continue; 
            
            if (slot.count < this.MAX_COMBO && !slot.locked) {
                slot.count++;
                return true;
            }
        }
        return false; // Все слоты полны -> Overflow
    }

    // === ЛОГИКА ЗАЩИТЫ (Спасение раненых) ===
    addDefenseToken(players: Map<string, PlayerNode>): boolean {
        // 1. Найти все защитные слоты, где есть живые игроки
        const activeSlots = this.defenseSlots
            .filter(s => s.assignedEntityId !== null)
            .map(s => {
                const player = players.get(s.assignedEntityId!);
                return { slot: s, hp: player ? player.integrity : 100 };
            })
            .sort((a, b) => a.hp - b.hp); // Сортируем от малого HP к большому

        // 2. Фаза 1: Поднять всех до X2 (безопасный минимум)
        for (const item of activeSlots) {
            if (item.slot.count < 2 && !item.slot.locked) {
                item.slot.count++;
                return true;
            }
        }

        // 3. Фаза 2: Максимизировать до X4
        for (const item of activeSlots) {
            if (item.slot.count < this.MAX_COMBO && !item.slot.locked) {
                item.slot.count++;
                return true;
            }
        }

        return false; // Overflow
    }
}