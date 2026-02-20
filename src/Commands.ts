export class Parameter {
    constructor(
        public readonly name: string,
        public readonly multiplier: number
    ) {}
}

export class Command {
    constructor(
        public readonly name: string,
        public readonly basePower: number,
        public readonly tags: Set<string> = new Set(),
        public contributors: Map<string, number> = new Map()
    ) {}

    isDefense(): boolean {
        return this.tags.has('защитная');
    }

    isAttack(): boolean {
        return this.tags.has('атакующая');
    }

    clone(): Command {
        return new Command(this.name, this.basePower, new Set(this.tags), new Map(this.contributors));
    }
}


// =====================================================
// 6. Статические данные (без изменений)
// =====================================================

export const ParametersMap: Parameter[] = [
    new Parameter('-rf', 2.5),
    new Parameter('-9', 2.0),
    new Parameter('--preserve-root', 1.2),
    new Parameter('-r', 1.5),
    new Parameter('if=/dev/zero', 3.0),
    new Parameter('of=/dev/sda', 2.2),
    new Parameter('-y', 1.3),
    new Parameter('-h', 1.1),
    new Parameter('777', 2.0),
    new Parameter('644', 1.2)
];

export const CommandMap: Command[] = [
    new Command('rm', 80, new Set(['атакующая', 'деструктивная', 'файловая'])),
    new Command('dd', 120, new Set(['атакующая', 'деструктивная', 'брутфорс'])),
    new Command('kill', 50, new Set(['атакующая', 'процесс'])),
    new Command('xkill', 40, new Set(['атакующая', 'GUI'])),
    new Command('chmod_attack', 70, new Set(['атакующая', 'ослабление'])),
    new Command('chown', 100, new Set(['атакующая', 'захват'])),
    new Command('mv', 20, new Set(['атакующая', 'маскировка'])),
    new Command('sudo_apt_upgrade', 90, new Set(['защитная', 'восстановление', 'патчи'])),
    new Command('top', 30, new Set(['защитная', 'мониторинг'])),
    new Command('htop', 30, new Set(['защитная', 'мониторинг', 'интерактивная'])),
    new Command('whoami', 5, new Set(['защитная', 'идентификация'])),
    new Command('df', 15, new Set(['защитная', 'аудит', 'диски'])),
    new Command('free', 15, new Set(['защитная', 'аудит', 'память'])),
    new Command('uptime', 10, new Set(['защитная', 'аудит', 'время'])),
    new Command('chmod_defense', 60, new Set(['защитная', 'укрепление']))
];