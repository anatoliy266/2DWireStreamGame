// =====================================================
// 4. Менеджер отображения (UI) — исправлены потенциальные null-ошибки
// =====================================================

import { Player, PlayerState } from "./Entities";
import { GameLogger } from "./GameController";
import { EnemyManager, PlayerManager, SlotManager } from "./Managers";

export class UIManager {
    private introContainer: HTMLElement | null = null;
    private resultContainer: HTMLElement | null = null;
    private currentHop: number = 1;

    constructor(
        private playerManager: PlayerManager,
        private enemyManager: EnemyManager,
        private slotManager: SlotManager,
        private logger: GameLogger,
        private prepDuration: number,
        private resultDuration: number
    ) {}

    hideResultIfVisible(): void {
        if (this.resultContainer) {
            this.resultContainer.remove();
            this.resultContainer = null;
        }
    }

    setCurrentHop(hop: number): void {
        this.currentHop = hop;
        this.renderHops();
    }

    showIntro(onComplete?: () => void): void {
        if (this.introContainer) this.introContainer.remove();

        const container = this.createTerminalWindow('intro-terminal', '#0f0', '0 0 30px #0f0');
        container.innerHTML = this.getIntroHTML();
        document.body.appendChild(container);
        this.introContainer = container;

        setTimeout(() => { container.style.opacity = '1'; }, 10);
        this.animateIntroMessages(container);
        this.animateProgressBar(container);

        setTimeout(() => {
            this.hideIntro();
            onComplete?.();
        }, this.prepDuration);
    }

    hideIntro(): void {
        if (this.introContainer) {
            this.introContainer.style.opacity = '0';
            setTimeout(() => {
                this.introContainer?.remove();
                this.introContainer = null;
            }, 500);
        }
    }

    showResult(): void {
        if (this.resultContainer) this.resultContainer.remove();

        const container = this.createTerminalWindow('result-terminal', '#f00', '0 0 30px #f00');
        container.innerHTML = this.getResultHTML();
        document.body.appendChild(container);
        this.resultContainer = container;

        setTimeout(() => { container.style.opacity = '1'; }, 10);

        setTimeout(() => {
            if (this.resultContainer) {
                this.resultContainer.style.opacity = '0';
                setTimeout(() => {
                    this.resultContainer?.remove();
                    this.resultContainer = null;
                }, 500);
            }
        }, this.resultDuration);
    }

    showPlayerJoined(player: Player): void {
        console.log('showPlayerJoined for', player.name);

        const container = document.createElement('div');
        container.id = 'player-join-notification';
        container.style.position = 'fixed';
        container.style.width = '25vw';
        container.style.maxWidth = '300px';
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        container.style.border = '2px solid #0f0';
        container.style.color = '#0f0';
        container.style.fontFamily = 'Courier New, monospace';
        container.style.padding = '10px';
        container.style.zIndex = '9999';
        container.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';
        container.style.overflow = 'hidden';
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.3s';
        container.style.boxSizing = 'border-box';
        container.style.pointerEvents = 'none';

        const scenario = this.getRandomJoinScenario(player.name);
        const asciiDiv = document.createElement('pre');
        asciiDiv.style.margin = '0 0 10px 0';
        asciiDiv.style.fontSize = 'clamp(8px, 2vw, 12px)';
        asciiDiv.style.lineHeight = '1.2';
        asciiDiv.style.textAlign = 'center';
        asciiDiv.style.whiteSpace = 'pre-wrap';
        asciiDiv.style.wordBreak = 'break-all';
        asciiDiv.innerText = scenario.ascii.join('\n');
        container.appendChild(asciiDiv);

        const msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = '10px';
        msgDiv.style.minHeight = '60px';
        msgDiv.style.fontSize = 'clamp(10px, 2.5vw, 14px)';
        container.appendChild(msgDiv);

        const messageLines: HTMLDivElement[] = [];
        scenario.messages.forEach(msg => {
            const line = document.createElement('div');
            line.innerText = msg;
            line.style.marginBottom = '2px';
            line.style.opacity = '0';
            line.style.transition = 'opacity 0.3s';
            msgDiv.appendChild(line);
            messageLines.push(line);
        });

        const progressContainer = document.createElement('div');
        progressContainer.style.width = '100%';
        progressContainer.style.height = '8px';
        progressContainer.style.backgroundColor = '#003300';
        progressContainer.style.border = '1px solid #0f0';
        progressContainer.style.marginTop = '10px';
        const progressBar = document.createElement('div');
        progressBar.style.width = '0%';
        progressBar.style.height = '100%';
        progressBar.style.backgroundColor = '#0f0';
        progressBar.style.transition = 'width 2s linear';
        progressContainer.appendChild(progressBar);
        container.appendChild(progressContainer);

        document.body.appendChild(container);
        container.offsetHeight; // force reflow

        this.positionElementRandomly(container);

        setTimeout(() => { container.style.opacity = '1'; }, 10);

        let msgIndex = 0;
        const interval = setInterval(() => {
            if (msgIndex < messageLines.length) {
                messageLines[msgIndex].style.opacity = '1';
                msgIndex++;
            } else {
                clearInterval(interval);
            }
        }, 500);

        setTimeout(() => { progressBar.style.width = '100%'; }, 100);

        setTimeout(() => {
            container.style.opacity = '0';
            setTimeout(() => container.remove(), 300);
        }, 4000);
    }

    updateTimer(seconds: number): void {
        const el = document.getElementById('timer-display');
        if (el) el.innerText = seconds.toString();
    }

    renderAll(): void {
        this.renderEnemies();
        this.renderBuffer();
        this.renderPlayers();
        this.renderHops();
    }

    renderEnemies(): void {
        const container = document.getElementById('enemy-container');
        if (!container) return;
        container.innerHTML = '';
        this.enemyManager.alive.forEach(e => {
            const div = document.createElement('div');
            div.className = 'enemy-slot';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span>[!] ${e.name}</span>
                    <span>${e.integrity}/${e.maxIntegrity}</span>
                    <span>${e.latency}%</span>
                </div>
                <div style="font-size:0.8em">LINKED: A${e.slotIndex + 1}</div>
                <div class="bar-container"><div class="hp-bar" style="width:${e.healthPercent}%; background:red;"></div></div>
            `;
            container.appendChild(div);
        });
    }

    renderBuffer(): void {
        this.slotManager.attackSlots.forEach((slot, i) => {
            const el = document.getElementById(`slot-a${i + 1}`);
            if (el) {
                el.className = `slot filled-${slot.level}`;
                el.innerText = `[A${i + 1}] ${slot.level > 0 ? `ATTACK X${slot.level} (${slot.totalPower})` : 'EMPTY'}`;
            }
        });

        this.slotManager.defenseSlots.forEach((slot, i) => {
            const el = document.getElementById(`slot-d${i + 1}`);
            if (el) {
                const targetName = slot.assignedPlayerId ? this.playerManager.getPlayerName(slot.assignedPlayerId) : 'NONE';
                el.className = `slot defense-slot filled-${slot.level}`;
                if (slot.isEmpty()) el.classList.add('danger');
                el.innerHTML = `
                    <span>[D${i + 1}] ${targetName}</span>
                    <span>${slot.level > 0 ? `SHIELD X${slot.level} (${slot.totalPower})` : 'VULNERABLE'}</span>
                `;
            }
        });
    }

    renderPlayers(): void {
        const list = document.getElementById('player-list');
        if (!list) return;

        const sorted = this.playerManager.allPlayers.sort((a, b) => b.integrity - a.integrity);
        list.innerHTML = '';
        sorted.forEach(p => {
            const div = document.createElement('div');
            div.className = `player-card ${p.state}`;
            let status = p.state === PlayerState.ACTIVE ? '' : `[${p.state.toUpperCase()}]`;
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span>${p.name} ${status}</span>
                    <span>${p.latency}ms</span>
                    <span>${p.integrity}%</span>
                    <span>⭐ ${p.contribution}</span>
                </div>
            `;
            list.appendChild(div);
        });
    }

    renderHops(): void {
        for (let i = 1; i <= 4; i++) {
            const el = document.getElementById(`hop-${i}`);
            if (el) {
                if (i === this.currentHop) el.classList.add('active');
                else el.classList.remove('active');
            }
        }
    }

    showInterface(): void {
        const el = document.getElementById('general-store');
        const svg = document.getElementById('circuit-svg');
        el?.classList.remove('element-out');
        svg?.classList.remove('element-out');
        el?.classList.add('element-in');
        svg?.classList.add('element-in');
    }

    hideInterface(): void {
        const el = document.getElementById('general-store');
        const svg = document.getElementById('circuit-svg');
        el?.classList.remove('element-in');
        svg?.classList.remove('element-in');
        el?.classList.add('element-out');
        svg?.classList.add('element-out');
    }

    private createTerminalWindow(id: string, borderColor: string, boxShadow: string): HTMLElement {
        const container = document.createElement('div');
        container.id = id;
        container.style.position = 'fixed';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.width = 'min(80vw, 600px)';
        container.style.backgroundColor = '#0a0f0a';
        container.style.border = `3px solid ${borderColor}`;
        container.style.borderRadius = '5px';
        container.style.color = borderColor;
        container.style.fontFamily = '"Courier New", monospace';
        container.style.padding = '20px';
        container.style.zIndex = '10000';
        container.style.boxShadow = boxShadow;
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.5s';
        return container;
    }

    private getIntroHTML(): string {
        const ascii = `
    ╔══════════════════════════════╗
    ║  ██╗  ██╗ █████╗  ██████╗██╗ ██╗███████╗██████╗  ║
    ║  ██║  ██║██╔══██╗██╔════╝██║ ██║██╔════╝██╔══██╗ ║
    ║  ███████║███████║██║     ███████║█████╗  ██████╔╝ ║
    ║  ██╔══██║██╔══██║██║     ██╔══██║██╔══╝  ██╔══██╗ ║
    ║  ██║  ██║██║  ██║╚██████╗██║  ██║███████╗██║  ██║ ║
    ║  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ║
    ╚══════════════════════════════╝
    `;
        return `
            <pre style="margin:0 0 15px 0; font-size:clamp(8px,2vw,14px); line-height:1.2; text-align:center;">${ascii}</pre>
            <div style="margin-bottom:20px; min-height:80px;"></div>
            <div style="width:100%; height:20px; background-color:#003300; border:1px solid #0f0; margin-top:15px;">
                <div style="width:0%; height:100%; background-color:#0f0; transition:width ${this.prepDuration}ms linear;"></div>
            </div>
        `;
    }

    private animateIntroMessages(container: HTMLElement): void {
        const messages = [
            '> INITIALIZING SECURE UPLINK...',
            '> AUTHENTICATING WITH ARCHIVE SERVER...',
            '> DECRYPTING SESSION KEY...',
            '> BYPASSING FIREWALL...',
            '> CONNECTION ESTABLISHED. AWAITING NODES...'
        ];
        const msgDiv = container.querySelector('div:nth-child(2)') as HTMLElement;
        if (!msgDiv) {
            console.warn('Message div not found in intro container');
            return;
        }
        let index = 0;
        const interval = setInterval(() => {
            if (index < messages.length) {
                const line = document.createElement('div');
                line.innerText = messages[index];
                line.style.opacity = '0';
                line.style.transition = 'opacity 0.3s';
                msgDiv.appendChild(line);
                setTimeout(() => line.style.opacity = '1', 10);
                index++;
            } else {
                clearInterval(interval);
            }
        }, 600);
    }

    private animateProgressBar(container: HTMLElement): void {
        // Ищем div с transition:width (без пробела после двоеточия)
        const bar = container.querySelector('div[style*="transition:width"]') as HTMLElement;
        if (!bar) {
            console.warn('Progress bar not found in intro container');
            return;
        }
        setTimeout(() => {
            bar.style.width = '100%';
        }, 100);
    }

    private getResultHTML(): string {
        const artworks = [
            `
    ╔════════════════════════════╗
    ║  ╔═╗╔═╗╔╦╗╔═╗╔╗╔╔═╗╔╦╗    ║
    ║  ║ ║╠═╣ ║ ║╣ ║║║║╣  ║     ║
    ║  ╚═╝╩ ╩ ╩ ╚═╝╝╚╝╚═╝ ╩     ║
    ║        BREACHED           ║
    ╚════════════════════════════╝
        `,
            `
    ┌────────────────────────────┐
    │  ░░░░░░░░░░░░░░░░░░░░░░░░  │
    │  ░█▀▀░█▀█░█▀▄░█▀▀░█░█░░░░  │
    │  ░█▀▀░█░█░█░█░█▀▀░▀▄▀░░░░  │
    │  ░▀░░░▀▀▀░▀▀░░▀▀▀░░▀░░░░░  │
    │     SHUTDOWN COMPLETE      │
    └────────────────────────────┘
        `,
            `
    ╔════════════════════════════╗
    ║  ╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲  ║
    ║  ╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱  ║
    ║    SYSTEM PURGED           ║
    ║  ╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲  ║
    ╚════════════════════════════╝
        `
        ];
        const selectedArt = artworks[Math.floor(Math.random() * artworks.length)];

        const sorted = this.playerManager.allPlayers.sort((a, b) => b.contribution - a.contribution);
        const leaderRows = sorted.map((p, idx) => 
            `<div style="display:flex; justify-content:space-between; padding:2px 10px; color:${idx === 0 ? '#ff0' : '#f00'}">
                <span>${idx + 1}. ${p.name}</span>
                <span>⭐ ${p.contribution}</span>
            </div>`
        ).join('');

        return `
            <pre style="margin:0 0 20px 0; font-size:clamp(8px,2vw,14px); line-height:1.2; text-align:center; color:#f00;">${selectedArt}</pre>
            <h3 style="text-align:center; margin:10px 0; color:#f00;">> TOP NODES CONTRIBUTION <</h3>
            <div style="margin-top:15px; max-height:200px; overflow-y:auto; border-top:1px solid #f00; border-bottom:1px solid #f00; padding:5px 0;">
                ${leaderRows}
            </div>
        `;
    }

    private getRandomJoinScenario(playerName: string): { ascii: string[]; messages: string[] } {
        const scenarios = [
            {
                ascii: [
                    "    _____",
                    "   /     \\",
                    "   | () |",
                    "    \\___/   ",
                    "   CONNECT"
                ],
                messages: [
                    "> ESTABLISHING SECURE LINK...",
                    "> HANDSHAKE PROTOCOL v2.3",
                    "> AUTHENTICATING NODE...",
                    `> ACCESS GRANTED: ${playerName}`,
                    "> SYNC COMPLETE."
                ]
            },
            {
                ascii: [
                    "   ╔════════╗",
                    "   ║ █▀▀ █▀▀ ║",
                    "   ║ █▀▀ ▀▀█ ║",
                    "   ╚════════╝",
                    "  TERMINAL"
                ],
                messages: [
                    "> INITIALIZING UPLINK...",
                    "> DECRYPTING SESSION KEY",
                    "> BYPASSING FIREWALL...",
                    `> NODE ${playerName} ONLINE`,
                    "> READY."
                ]
            },
            {
                ascii: [
                    "  ┌─┐┌─┐┌┬┐┌─┐",
                    "  │  │ │ ││├┤ ",
                    "  └─┘└─┘─┴┘└─┘",
                    "  CYPHER"
                ],
                messages: [
                    "> WAKING UP NEURAL INTERFACE...",
                    "> LOADING CHAOS DRIVER...",
                    `> ESTABLISHING LINK WITH ${playerName}`,
                    "> ENCRYPTION: 4096-bit RSA",
                    "> CONNECTION STABLE."
                ]
            }
        ];
        return scenarios[Math.floor(Math.random() * scenarios.length)];
    }

    private positionElementRandomly(el: HTMLElement): void {
        const rect = el.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        const width = w || 300;
        const height = h || 200;

        const sides = ['left', 'right', 'top', 'bottom'];
        const side = sides[Math.floor(Math.random() * sides.length)];
        const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

        el.style.left = '';
        el.style.right = '';
        el.style.top = '';
        el.style.bottom = '';

        switch (side) {
            case 'left':
                el.style.left = '20px';
                el.style.top = clamp(Math.random() * (winH - height), 0, winH - height) + 'px';
                break;
            case 'right':
                el.style.right = '20px';
                el.style.top = clamp(Math.random() * (winH - height), 0, winH - height) + 'px';
                break;
            case 'top':
                el.style.top = '20px';
                el.style.left = clamp(Math.random() * (winW - width), 0, winW - width) + 'px';
                break;
            case 'bottom':
                el.style.bottom = '20px';
                el.style.left = clamp(Math.random() * (winW - width), 0, winW - width) + 'px';
                break;
        }
    }
}
