class Firewall extends Node {
    constructor(name, hp, latency) {
        super(name, hp, latency);

        // Перезарядки способностей
        this.cooldowns = {
            intercept: 0,
            packet_filter: 0,
            traceback: 0
        };
    }

    // --- Защитные способности ---
    
    // 1. !intercept (защита одного узла)
    intercept(target, latencyCost, cooldown) {
        if (this.cooldowns.intercept > 0) {
            console.log("!intercept в перезарядке:", this.cooldowns.intercept, "ходов");
            return;
        }

        if (!this.spendLatency(latencyCost)) return;

        console.log(`${this.name} защищает ${target.name} от следующей атаки и уменьшает Latency`);
        this.cooldowns.intercept = cooldown;
        // Можно добавить логику “следующей атаки”
    }

    // 2. !packet_filter (групповая защита)
    packetFilter(targets, latencyCost, cooldown, reductionPercent) {
        if (this.cooldowns.packet_filter > 0) {
            console.log("!packet_filter в перезарядке:", this.cooldowns.packet_filter, "ходов");
            return;
        }

        if (!this.spendLatency(latencyCost * 1.5)) return;

        console.log(`${this.name} фильтрует ${reductionPercent}% пакетов для всей группы`);
        targets.forEach(node => {
            console.log(`${node.name} получает уменьшенный урон`);
            // Здесь можно применить реальный эффект уменьшения урона
        });

        this.cooldowns.packet_filter = cooldown;
    }

    // --- Атакующая способность ---
    
    // 3. !traceback (атака на врага)
    traceback(enemy) {
        const dmg = enemy.lastDamageTaken || 50;
        console.log(`${this.name} перенаправляет атаку обратно в ${enemy.name} и вскрывает уязвимость!`);
        enemy.takeDamage(dmg);
        enemy.effects.vulnerable = 2; // 2 хода уязвимости
    }

    // --- Обновление перезарядок после хода ---
    tickCooldowns() {
        for (let skill in this.cooldowns) {
            if (this.cooldowns[skill] > 0) this.cooldowns[skill]--;
        }
    }
}


class Injector extends Node {
    constructor(name, hp, latency) {
        super(name, hp, latency);
        this.cooldowns = {
            inject: 0
        };
    }

    // 1. !payload — базовая атака
    payload(enemy, baseDamage, latencyCost) {
        if (!this.spendLatency(latencyCost)) return;

        console.log(`Injector ${this.name} отправляет payload в ${enemy.name} — узел получает урон.`);
        enemy.takeDamage(baseDamage);
    }

    // 2. !inject — по уязвимости
    inject(enemy, burstDamage, latencyCost, cooldown) {
        if (this.cooldowns.inject > 0) {
            console.log("!inject в перезарядке:", this.cooldowns.inject, "ходов");
            return;
        }

        if (!enemy.effects.vulnerable) {
            console.log(`${enemy.name} не имеет уязвимости — inject не сработал`);
            return;
        }

        if (!this.spendLatency(latencyCost)) return;

        const totalDamage = Math.floor(burstDamage * 1.5);
        console.log(`Firewall вскрыл уязвимость в ${enemy.name} — Injector ${this.name} внедряется и наносит КРИТ!`);
        enemy.takeDamage(totalDamage);

        // enemy.effects.vulnerable++; // усиливаем дебафф
        this.cooldowns.inject = cooldown;
    }

    // 3. !obfuscate — защита через зашумление
    obfuscate(latencyCost) {
        if (!this.spendLatency(latencyCost)) return;

        console.log(`Injector ${this.name} зашумил трафик — атака босса захлебнётся в помехах.`);
        this.effects.obfuscated = 1; // эффект на 1 следующий ход
    }

    tickCooldowns() {
        for (let skill in this.cooldowns) {
            if (this.cooldowns[skill] > 0) this.cooldowns[skill]--;
        }
    }
}

class LoadBalancer extends Node {
    constructor(name, hp, latency) {
        super(name, hp, latency);
        this.cooldowns = {
            compress: 0,
            hotfix: 0
        };
    }

    // 1. !bridge — балансировка Latency в рейде
    bridge(raid, percent) {
        const sorted = [...raid].sort((a, b) => a.latency - b.latency);
        const low = sorted[0];
        const high = sorted[sorted.length - 1];

        const delta = Math.floor((high.latency - low.latency) * percent / 100);

        high.latency -= delta;
        low.latency += delta;

        console.log(
            `LoadBalancer строит мост между ${high.name} и ${low.name} — Latency выровнен`
        );
        console.log(`${high.name} Latency: ${high.latency}`);
        console.log(`${low.name} Latency: ${low.latency}`);
    }

    // 2. !compress — дебафф босса
    compress(enemy, latencyDebuffPercent, damageReducePercent, cooldown, latencyCost) {
        if (this.cooldowns.compress > 0) {
            console.log("!compress в перезарядке:", this.cooldowns.compress, "ходов");
            return;
        }

        if (!this.spendLatency(latencyCost * 2)) return;

        const extraLatency = Math.floor(enemy.latency * latencyDebuffPercent / 100);
        enemy.latency += extraLatency;

        enemy.effects.compressed = 1;
        enemy.damageModifier = 1 - damageReducePercent / 100;

        console.log(`LoadBalancer ${this.name} сжал процессы ${enemy.name} — атаки замедлены.`);
        console.log(`${enemy.name} получил +${extraLatency} Latency и -${damageReducePercent}% урона`);

        this.cooldowns.compress = cooldown;
    }

    // 3. !hotfix — лечение + восстановление Latency
    hotfix(ally, healPercent, latencyReducePercent, cooldown, latencyCost) {
        if (this.cooldowns.hotfix > 0) {
            console.log("!hotfix в перезарядке:", this.cooldowns.hotfix, "ходов");
            return;
        }

        if (!this.spendLatency(latencyCost)) return;

        const healAmount = Math.floor(ally.hp * healPercent / 100);
        ally.hp += healAmount;

        const latencyReduce = Math.floor(ally.latency * latencyReducePercent / 100);
        ally.latency -= latencyReduce;

        console.log(`LoadBalancer ${this.name} накатывает hotfix на ${ally.name} — узел снова в строю!`);
        console.log(`${ally.name}: +${healAmount} HP, -${latencyReduce} Latency`);

        this.cooldowns.hotfix = cooldown;
    }

    tickCooldowns() {
        for (let skill in this.cooldowns) {
            if (this.cooldowns[skill] > 0) this.cooldowns[skill]--;
        }
    }
}