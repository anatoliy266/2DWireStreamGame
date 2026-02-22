// =====================================================
// 2. Слоты (без изменений)
// =====================================================

export abstract class BaseSlot {
    level: number = 0;
    contributors: string[] = [];
    commandName: string = '';
    totalPower: number = 0;
    powerMap: Map<string, number> = new Map();

    isEmpty(): boolean {
        return this.level === 0;
    }

    clear(): void {
        this.level = 0;
        this.contributors = [];
        this.commandName = '';
        this.totalPower = 0;
        this.powerMap.clear();
    }

    addContributor(userId: string, userName: string, power: number): void {
        this.contributors.push(userName);
        const current = this.powerMap.get(userId) || 0;
        this.powerMap.set(userId, current + power);
        this.totalPower += power;
        this.recalculateLevel();
    }

    recalculateLevel(): void {
        this.level = Math.min(4, Math.floor(this.totalPower / 50) + (this.totalPower > 0 ? 1 : 0));
    }
}

export class AttackSlot extends BaseSlot {}

export class DefenseSlot extends BaseSlot {
    constructor(public assignedPlayerId: string | null = null) {
        super();
    }
    // Данные об атаке моба на этот слот (заполняются в конце хода)
    public mobCommandName: string = '';
    public mobPower: number = 0;
    public mobParams: string = ''; // для отображения параметра
}