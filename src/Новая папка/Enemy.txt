export type EnemyType = 'DAEMON' | 'HUNTER' | 'MAINFRAME';

export class Enemy {
    id: string;
    name: string;
    type: EnemyType;
    integrity: number;
    maxIntegrity: number;
    linkedSlotIndex: number; // 0, 1 или 2 (A1-A3)

    constructor(id: string, name: string, type: EnemyType, hp: number, slot: number) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.integrity = hp;
        this.maxIntegrity = hp;
        this.linkedSlotIndex = slot;
    }

    takeDamage(amount: number) {
        this.integrity -= amount;
        if (this.integrity < 0) this.integrity = 0;
    }

    get isDead(): boolean {
        return this.integrity <= 0;
    }
}