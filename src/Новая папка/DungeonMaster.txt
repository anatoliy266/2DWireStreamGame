import { Enemy } from "./Enemy";

export class DungeonMaster {
    currentHop: number = 0;
    
    // Генерация уровня согласно GDD
    loadNextHop(): Enemy[] {
        this.currentHop++;
        const enemies: Enemy[] = [];

        if (this.currentHop >= 1 && this.currentHop <= 3) {
            // HOP 1-3: Edge Firewall (Script Daemons)
            const count = Math.floor(Math.random() * 2) + 1; // 1-2 врага
            for (let i = 0; i < count; i++) {
                enemies.push(new Enemy(`mob_${Date.now()}_${i}`, `Daemon_v${this.currentHop}.${i}`, 'DAEMON', 50, i));
            }
        } 
        else if (this.currentHop === 4 || this.currentHop === 5) {
            // HOP 4-5: Deep Dive (Protocol Hunters)
            enemies.push(new Enemy(`hunter_${Date.now()}`, `Proto_Hunter`, 'HUNTER', 120, 1)); // Слот 2 (центр)
        }
        else if (this.currentHop === 6) {
            // FINAL HOP: Legacy Mainframe
            // Босс занимает все 3 слота (виртуально это 3 части босса)
            enemies.push(new Enemy(`boss_core`, `Legacy_Mainframe`, 'MAINFRAME', 1000, 1));
        }

        return enemies;
    }

    isVictory(): boolean {
        // Если прошли босса
        return this.currentHop > 6; 
    }
}