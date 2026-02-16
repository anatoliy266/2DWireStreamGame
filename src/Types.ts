export type CommandType = 'attack' | 'defend' | 'finisher_attack' | 'finisher_defend';

export interface Player {
    id: string;
    name: string;
    integrity: number; // 0-100 (HP)
    latency: number;   // 0-200 (Ping)
    state: 'active' | 'blackout' | 'terminated';
    blackoutTimer: number; // turns remaining
}

export interface Enemy {
    id: string;
    name: string;
    integrity: number;
    latency: number;   // 0-200 (Ping)
    slotIndex: number; // 0, 1, 2 corresponds to A1, A2, A3
}

export interface BufferSlot {
    level: number; // 0=Empty, 1=X1, ... 4=X4
    type: CommandType | null;
    contributors: string[]; // Player names for logs
}