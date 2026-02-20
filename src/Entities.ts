// =====================================================
// 1. Базовые классы сущностей (без изменений)
// =====================================================



export enum PlayerState {
    ACTIVE = 'active',
    BLACKOUT = 'blackout',
    TERMINATED = 'terminated'
}

export class Player {
    constructor(
        public readonly id: string,
        public name: string,
        public integrity: number = 100,
        public latency: number = 0,
        public state: PlayerState = PlayerState.ACTIVE,
        public blackoutTimer: number = 0,
        public contribution: number = 0
    ) {}

    takeDamage(amount: number): void {
        this.integrity = Math.max(0, this.integrity - amount);
        if (this.integrity <= 0) {
            this.state = PlayerState.TERMINATED;
            this.integrity = 0;
        }
    }

    increaseLatency(amount: number, threshold: number, blackoutDuration: number): void {
        this.latency = Math.min(threshold, this.latency + amount);
        if (this.latency >= threshold && this.state === PlayerState.ACTIVE) {
            this.state = PlayerState.BLACKOUT;
            this.blackoutTimer = blackoutDuration;
        }
    }

    reduceLatency(amount: number): void {
        if (this.state === PlayerState.ACTIVE) {
            this.latency = Math.max(0, this.latency - amount);
        }
    }

    updateBlackout(): void {
        if (this.state === PlayerState.BLACKOUT) {
            this.blackoutTimer--;
            if (this.blackoutTimer <= 0) {
                this.state = PlayerState.ACTIVE;
                this.latency = 0;
            }
        }
    }

    isActive(): boolean {
        return this.state === PlayerState.ACTIVE;
    }

    isTerminated(): boolean {
        return this.state === PlayerState.TERMINATED;
    }
}

export enum AttackType {
    SINGLE = 'single',
    AOE = 'aoe'
}

export class Enemy {
    constructor(
        public readonly id: string,
        public name: string,
        public integrity: number,
        public maxIntegrity: number,
        public latency: number,
        public slotIndex: number,
        public baseDamage: number,
        public attackType: AttackType
    ) {}

    takeDamage(amount: number): void {
        this.integrity = Math.max(0, this.integrity - amount);
    }

    isAlive(): boolean {
        return this.integrity > 0;
    }

    get healthPercent(): number {
        return (this.integrity / this.maxIntegrity) * 100;
    }
}