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
    contributors: string[]; // Player names for logs
}


export interface Command {
  name: string;
  basePower: number;
  contributors: Map<string, number>;
  tags: Set<string>;
}

export interface Parameter{
    name: string;
    multiplier: Number;
}

export const ParametersMap: Parameter[] = [
    {
        name: "-параметр1",
        multiplier: 1.01
    },
    {
        name: "--параметр2",
        multiplier: 1.02
    }

]

export const CommandMap: Command[] = [
  {
    name: "команда1",
    basePower: 10,
    contributors: new Map(), // Map из пар ключ-значение
    tags: new Set(["атакующая", "магия"])                  // Set из строк
  },
  {
    name: "команда2",
    basePower: 7,
    contributors: new Map(),
    tags: new Set(["защита"])
  }
];