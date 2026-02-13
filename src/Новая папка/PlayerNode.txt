export type PlayerStatus = 'OPERATIONAL' | 'UNSTABLE' | 'BLACKOUT' | 'TERMINATED';

export class PlayerNode {
    id: string;
    name: string;
    integrity: number = 100; // HP
    latency: number = 0;     // Ping
    status: PlayerStatus = 'OPERATIONAL';
    blackoutTimer: number = 0; // Ходов до выхода из стана

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    // Обработка стоимости команды
    addLatency(amount: number) {
        if (this.status === 'TERMINATED' || this.status === 'BLACKOUT') return;

        this.latency += amount;
        this.checkStatus();
    }

    // Сброс в конце хода (-15ms)
    ventLatency() {
        if (this.status === 'TERMINATED') return;
        
        // Если в блэкауте - уменьшаем таймер
        if (this.status === 'BLACKOUT') {
            this.blackoutTimer--;
            if (this.blackoutTimer <= 0) {
                this.status = 'OPERATIONAL';
                this.latency = 0; // Перезагрузка системы
                console.log(`[SYS] Node ${this.name} REBOOTED.`);
            }
            return;
        }

        // Обычное охлаждение
        this.latency = Math.max(0, this.latency - 15);
        this.checkStatus();
    }

    // Получение урона (Integrity не восстанавливается!)
    takeDamage(amount: number) {
        if (this.status === 'TERMINATED') return;
        
        this.integrity -= amount;
        if (this.integrity <= 0) {
            this.integrity = 0;
            this.status = 'TERMINATED';
            console.log(`[ALERT] Node ${this.name} TERMINATED (Connection Lost).`);
        }
    }

    private checkStatus() {
        if (this.latency >= 200) {
            this.status = 'BLACKOUT';
            this.blackoutTimer = 2;
            console.log(`[WARN] Node ${this.name} entered BLACKOUT!`);
        } else if (this.latency >= 100) {
            this.status = 'UNSTABLE';
        } else {
            this.status = 'OPERATIONAL';
        }
    }
}