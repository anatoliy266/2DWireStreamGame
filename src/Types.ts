export interface Player {
    id: string;
    name: string;
    integrity: number; // 0-100 (HP)
    latency: number;   // 0-200 (Ping)
    state: 'active' | 'blackout' | 'terminated';
    blackoutTimer: number; // turns remaining
    contribution: number;  // <-- НОВОЕ: накопленные очки за игру
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


// export interface Command {
//   name: string;
//   basePower: number;
//   contributors: Map<string, number>;
//   tags: Set<string>;
// }

// export interface Parameter{
//     name: string;
//     multiplier: Number;
// }

// export const ParametersMap: Parameter[] = [
//     {
//         name: "-параметр1",
//         multiplier: 1.01
//     },
//     {
//         name: "--параметр2",
//         multiplier: 1.02
//     }

// ]

// export const CommandMap: Command[] = [
//   {
//     name: "команда1",
//     basePower: 10,
//     contributors: new Map(), // Map из пар ключ-значение
//     tags: new Set(["атакующая", "магия"])                  // Set из строк
//   },
//   {
//     name: "команда2",
//     basePower: 7,
//     contributors: new Map(),
//     tags: new Set(["защита"])
//   }
// ];


export interface Command {
    name: string;
    basePower: number;
    contributors: Map<string, number>; // ключ – ID игрока, значение – вклад (например, уровень)
    tags: Set<string>;
}

export interface Parameter {
    name: string;
    multiplier: number;
}

// Массив параметров (модификаторов)
export const ParametersMap: Parameter[] = [
    {
        name: "-rf",
        multiplier: 2.5
    },
    {
        name: "-9",
        multiplier: 2.0
    },
    {
        name: "--preserve-root",
        multiplier: 1.2
    },
    {
        name: "-r",
        multiplier: 1.5
    },
    {
        name: "if=/dev/zero",
        multiplier: 3.0
    },
    {
        name: "of=/dev/sda",
        multiplier: 2.2
    },
    {
        name: "-y",
        multiplier: 1.3
    },
    {
        name: "-h",
        multiplier: 1.1
    },
    {
        name: "777",
        multiplier: 2.0
    },
    {
        name: "644",
        multiplier: 1.2
    }
];

// Массив команд (только атакующие и защитные)
export const CommandMap: Command[] = [
    // ===== АТАКУЮЩИЕ =====
    {
        name: "rm",
        basePower: 80,
        contributors: new Map(), // будет заполнено игроками
        tags: new Set(["атакующая", "деструктивная", "файловая"])
    },
    {
        name: "dd",
        basePower: 120,
        contributors: new Map(),
        tags: new Set(["атакующая", "деструктивная", "брутфорс"])
    },
    {
        name: "kill",
        basePower: 50,
        contributors: new Map(),
        tags: new Set(["атакующая", "процесс"])
    },
    {
        name: "xkill",
        basePower: 40,
        contributors: new Map(),
        tags: new Set(["атакующая", "GUI"])
    },
    {
        name: "chmod_attack", // атакующий вариант chmod (режим 777)
        basePower: 70,
        contributors: new Map(),
        tags: new Set(["атакующая", "ослабление"])
    },
    {
        name: "chown",
        basePower: 100,
        contributors: new Map(),
        tags: new Set(["атакующая", "захват"])
    },
    {
        name: "mv",
        basePower: 20,
        contributors: new Map(),
        tags: new Set(["атакующая", "маскировка"])
    },
    // ===== ЗАЩИТНЫЕ =====
    {
        name: "sudo_apt_upgrade",
        basePower: 90,
        contributors: new Map(),
        tags: new Set(["защитная", "восстановление", "патчи"])
    },
    {
        name: "top",
        basePower: 30,
        contributors: new Map(),
        tags: new Set(["защитная", "мониторинг"])
    },
    {
        name: "htop",
        basePower: 30,
        contributors: new Map(),
        tags: new Set(["защитная", "мониторинг", "интерактивная"])
    },
    {
        name: "whoami",
        basePower: 5,
        contributors: new Map(),
        tags: new Set(["защитная", "идентификация"])
    },
    {
        name: "df",
        basePower: 15,
        contributors: new Map(),
        tags: new Set(["защитная", "аудит", "диски"])
    },
    {
        name: "free",
        basePower: 15,
        contributors: new Map(),
        tags: new Set(["защитная", "аудит", "память"])
    },
    {
        name: "uptime",
        basePower: 10,
        contributors: new Map(),
        tags: new Set(["защитная", "аудит", "время"])
    },
    {
        name: "chmod_defense", // защитный вариант chmod (режим 644)
        basePower: 60,
        contributors: new Map(),
        tags: new Set(["защитная", "укрепление"])
    }
];