export type TokenType = "PREFIX" | "COMMAND_WORD" | "MODIFIER" | "SUFFIX" | "PARAM";

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
    type: TokenType | null;
    contributors: string[]; // Player names for logs
}

export interface Token {
  key: string;
  type: TokenType;
  basePower: number;
  semanticTags: string[];
  author: string;
}

export interface Command {
  tokens: Token[];
  basePower: number;
  contributors: Map<string, number>;
  tags: Set<string>;
}