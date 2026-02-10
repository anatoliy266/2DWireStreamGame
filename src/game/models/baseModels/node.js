class Node {
    constructor(name, hp, latency) {
        this.name = name;
        this.hp = hp;
        this.latency = latency;

        this.effects = {
            vulnerable: 0,   // ходы уязвимости
            obfuscated: 0   // ходы зашумления (для Injector)
        };

        this.lastDamageTaken = 0;
    }

    takeDamage(amount) {
        this.lastDamageTaken = amount;
        this.hp -= amount;
        console.log(`${this.name} получает ${amount} урона, HP=${this.hp}`);
    }

    spendLatency(amount) {
        if (this.latency >= amount) {
            this.latency -= amount;
            return true;
        }
        console.log(`${this.name} не хватает Latency!`);
        return false;
    }

    tickEffects() {
        for (let key in this.effects) {
            if (this.effects[key] > 0) this.effects[key]--;
        }
    }
}