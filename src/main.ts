import './style.css';
import {
  BALL_DEFINITIONS,
  RELIC_DEFINITIONS,
  TABLE_UPGRADES,
} from './content';
import { PinballGame } from './physics';
import { TableRenderer } from './renderer';
import { BallTypeId, RelicDefinition, TableUpgradeDefinition } from './types';

interface ShopState {
  relicOffers: { def: RelicDefinition; sold: boolean }[];
  ballOffers: { type: BallTypeId; cost: number; sold: boolean }[];
  upgradeOffers: { def: TableUpgradeDefinition; cost: number; sold: boolean }[];
  rerollCost: number;
}

class AppController {
  private game: PinballGame;
  private renderer!: TableRenderer;
  private shop: ShopState = {
    relicOffers: [],
    ballOffers: [],
    upgradeOffers: [],
    rerollCost: 2,
  };

  // Cached DOM references for high-frequency HUD updates
  private elStageScore!: HTMLElement;
  private elTargetScore!: HTMLElement;
  private elProgressFill!: HTMLElement;
  private elEarlyCashoutContainer!: HTMLElement;
  private elBallChips!: HTMLElement;
  private elBallMult!: HTMLElement;
  private elComboBadge!: HTMLElement;
  private elLastHit!: HTMLElement;
  private elGoldVal!: HTMLElement;
  private elAnteVal!: HTMLElement;
  private elTiltFill!: HTMLElement;
  private elTiltStatus!: HTMLElement;
  private elRelicList!: HTMLElement;
  private elBallRack!: HTMLElement;
  private elOverlayContainer!: HTMLElement;

  private lastPhase: string = '';

  constructor() {
    this.game = new PinballGame();
    this.mountBaseLayout();
    this.bindInputs();

    const canvas = document.getElementById('pinball-canvas') as HTMLCanvasElement;
    this.renderer = new TableRenderer(canvas);

    this.game.onStateChange = () => {
      if (this.game.phase === 'shop' && this.lastPhase !== 'shop') {
        this.rollShopOffers(true);
      }
      this.lastPhase = this.game.phase;
      this.renderStructuralUI();
    };

    this.lastPhase = this.game.phase;
    this.renderStructuralUI();

    let lastTime = performance.now();
    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      this.game.update(dt);
      this.renderer.render(this.game, dt);
      this.updateLiveHUD();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private mountBaseLayout(): void {
    const app = document.getElementById('app')!;
    app.innerHTML = `
      <!-- LEFT SIDEBAR: SCORE ENGINE & TELEMETRY -->
      <aside class="side-panel">
        <div id="blind-header-box" class="panel-section blind-card"></div>

        <div class="panel-section">
          <div class="section-label">
            <span>STAGE SCORE</span>
            <span id="hud-target-score" class="score-target">TARGET: 1,500</span>
          </div>
          <div class="score-row">
            <div id="hud-stage-score" class="score-big">0</div>
          </div>
          <div class="progress-track">
            <div id="hud-progress-fill" class="progress-fill" style="width: 0%"></div>
          </div>
          <div id="hud-early-cashout"></div>
        </div>

        <div class="panel-section">
          <div class="section-label">
            <span>ACTIVE BALL MATRIX</span>
            <span id="hud-combo-badge" class="combo-badge">COMBO x0</span>
          </div>
          <div class="balatro-calc">
            <div class="calc-box chips">
              <div class="calc-label">BALL CHIPS</div>
              <div id="hud-ball-chips" class="calc-val">0</div>
            </div>
            <div class="calc-x">×</div>
            <div class="calc-box mult">
              <div class="calc-label">BALL MULT</div>
              <div id="hud-ball-mult" class="calc-val">1.0x</div>
            </div>
          </div>
          <div class="combo-strip">
            <span style="color: var(--text-muted); font-size: 11px;">LAST HIT:</span>
            <span id="hud-last-hit" class="last-hit-ticker">READY</span>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-pill">
            <span class="section-label" style="margin:0">CREDITS</span>
            <span id="hud-gold-val" class="stat-val gold">$6</span>
          </div>
          <div class="stat-pill">
            <span class="section-label" style="margin:0">ANTE</span>
            <span id="hud-ante-val" class="stat-val ante">1 / 8</span>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-label">
            <span>STAGE BALL QUEUE</span>
            <span id="hud-balls-count" style="color: var(--neon-cyan)">3 BALLS</span>
          </div>
          <div id="hud-ball-rack" class="ball-rack"></div>
        </div>

        <div class="panel-section">
          <div class="section-label">
            <span>TILT SENSOR</span>
            <span id="hud-tilt-status" style="color: var(--neon-cyan)">STABLE</span>
          </div>
          <div class="progress-track" style="height: 7px;">
            <div id="hud-tilt-fill" class="progress-fill" style="width: 0%; background: var(--neon-pink);"></div>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            Press <b>W / ↑</b> to Nudge table. Avoid 100% Tilt!
          </div>
        </div>
      </aside>

      <!-- CENTER CABINET: PINBALL PLAYFIELD -->
      <main class="center-cabinet">
        <div class="cabinet-topbar">
          <div class="brand-title">PINBALLITE // OVERDRIVE</div>
          <div class="top-actions">
            <button id="btn-mute" class="icon-btn">🔊 SFX ON</button>
            <button id="btn-unstuck" class="icon-btn" title="Jolt stuck ball">⚡ UNSTUCK</button>
            <button id="btn-new-run" class="icon-btn">↻ NEW RUN</button>
          </div>
        </div>

        <div class="canvas-wrapper">
          <canvas id="pinball-canvas"></canvas>
        </div>

        <div class="arcade-controls">
          <button id="btn-left-flip" class="ctrl-btn">
            ◀ L-FLIP
            <span class="ctrl-sub">[A / ← / Z]</span>
          </button>
          <button id="btn-nudge" class="ctrl-btn">
            ▲ NUDGE
            <span class="ctrl-sub">[W / ↑]</span>
          </button>
          <button id="btn-launch" class="ctrl-btn launch">
            🚀 PLUNGER
            <span class="ctrl-sub">[HOLD SPACE]</span>
          </button>
          <button id="btn-right-flip" class="ctrl-btn">
            R-FLIP ▶
            <span class="ctrl-sub">[D / → / ?]</span>
          </button>
        </div>
      </main>

      <!-- RIGHT SIDEBAR: RELIC RACK & TABLE MODS -->
      <aside class="side-panel">
        <div class="panel-section" style="flex: 1; display: flex; flex-direction: column;">
          <div class="section-label">
            <span>RELIC CARTRIDGES</span>
            <span id="hud-relic-slots">0 / 5</span>
          </div>
          <div id="hud-relic-list" class="relic-list"></div>
        </div>

        <div class="panel-section">
          <div class="section-label">
            <span>TABLE ENGINEERING MODS</span>
          </div>
          <div id="hud-upgrades-list"></div>
        </div>

        <div class="panel-section">
          <div class="section-label">
            <span>TABLE RULES & COMBOS</span>
          </div>
          <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.38;">
            • <b>N-E-O Rollovers</b>: Flipper buttons cycle lit lanes. Light all 3 for <b>+2.0x Mult</b>!<br/>
            • <b>Drop Banks</b>: Clear all 3 targets on Left or Right bank for huge Chips & <b>+1.5x Mult</b>.<br/>
            • <b>Nexus Core</b>: Charge to 10/10 then shoot the center ring for <b>JACKPOT + MULTIBALL</b>!
          </div>
        </div>
      </aside>

      <div id="overlay-root"></div>
    `;

    this.elStageScore = document.getElementById('hud-stage-score')!;
    this.elTargetScore = document.getElementById('hud-target-score')!;
    this.elProgressFill = document.getElementById('hud-progress-fill')!;
    this.elEarlyCashoutContainer = document.getElementById('hud-early-cashout')!;
    this.elBallChips = document.getElementById('hud-ball-chips')!;
    this.elBallMult = document.getElementById('hud-ball-mult')!;
    this.elComboBadge = document.getElementById('hud-combo-badge')!;
    this.elLastHit = document.getElementById('hud-last-hit')!;
    this.elGoldVal = document.getElementById('hud-gold-val')!;
    this.elAnteVal = document.getElementById('hud-ante-val')!;
    this.elTiltFill = document.getElementById('hud-tilt-fill')!;
    this.elTiltStatus = document.getElementById('hud-tilt-status')!;
    this.elRelicList = document.getElementById('hud-relic-list')!;
    this.elBallRack = document.getElementById('hud-ball-rack')!;
    this.elOverlayContainer = document.getElementById('overlay-root')!;
  }

  private bindInputs(): void {
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ' || e.code === 'ShiftLeft') {
        this.game.setFlipperPressed('left', true);
        document.getElementById('btn-left-flip')?.classList.add('active');
      } else if (
        e.code === 'ArrowRight' ||
        e.code === 'KeyD' ||
        e.code === 'Slash' ||
        e.code === 'ShiftRight'
      ) {
        this.game.setFlipperPressed('right', true);
        document.getElementById('btn-right-flip')?.classList.add('active');
      } else if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') {
        if (this.game.phase === 'playing') {
          e.preventDefault();
          this.game.startPlungerCharge();
          document.getElementById('btn-launch')?.classList.add('active');
        }
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        this.game.nudgeTable(0, -1);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ' || e.code === 'ShiftLeft') {
        this.game.setFlipperPressed('left', false);
        document.getElementById('btn-left-flip')?.classList.remove('active');
      } else if (
        e.code === 'ArrowRight' ||
        e.code === 'KeyD' ||
        e.code === 'Slash' ||
        e.code === 'ShiftRight'
      ) {
        this.game.setFlipperPressed('right', false);
        document.getElementById('btn-right-flip')?.classList.remove('active');
      } else if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') {
        this.game.releasePlunger();
        document.getElementById('btn-launch')?.classList.remove('active');
      }
    });

    // On-screen arcade deck buttons
    const bindHoldButton = (id: string, onDown: () => void, onUp: () => void) => {
      const btn = document.getElementById(id)!;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        onDown();
      });
      window.addEventListener('pointerup', () => onUp());
      btn.addEventListener('pointerleave', () => onUp());
    };

    bindHoldButton(
      'btn-left-flip',
      () => this.game.setFlipperPressed('left', true),
      () => this.game.setFlipperPressed('left', false)
    );
    bindHoldButton(
      'btn-right-flip',
      () => this.game.setFlipperPressed('right', true),
      () => this.game.setFlipperPressed('right', false)
    );
    bindHoldButton(
      'btn-launch',
      () => this.game.startPlungerCharge(),
      () => this.game.releasePlunger()
    );

    document.getElementById('btn-nudge')!.addEventListener('click', () => {
      this.game.nudgeTable(0, -1);
    });

    document.getElementById('btn-mute')!.addEventListener('click', (e) => {
      const muted = this.game.sound.toggleMute();
      (e.currentTarget as HTMLElement).textContent = muted ? '🔇 MUTED' : '🔊 SFX ON';
    });

    document.getElementById('btn-unstuck')!.addEventListener('click', () => {
      this.game.unstuckBalls();
    });

    document.getElementById('btn-new-run')!.addEventListener('click', () => {
      this.game.startNewRun();
    });

    // Direct canvas pointer controls (tap left half for Left Flipper, right half for Right Flipper, or shooter lane for Plunger)
    const canvas = document.getElementById('pinball-canvas')!;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.game.phase !== 'playing') return;
      const rect = canvas.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      if (this.game.balls.some((b) => b.inShooterLane) && relX > 0.82) {
        this.game.startPlungerCharge();
      } else if (relX < 0.5) {
        this.game.setFlipperPressed('left', true);
      } else {
        this.game.setFlipperPressed('right', true);
      }
    });

    canvas.addEventListener('pointerup', () => {
      if (this.game.isChargingPlunger) {
        this.game.releasePlunger();
      }
      this.game.setFlipperPressed('left', false);
      this.game.setFlipperPressed('right', false);
    });
  }

  private updateLiveHUD(): void {
    const g = this.game;
    const target = g.currentStage.targetScore;
    this.elStageScore.textContent = g.stageScore.toLocaleString();
    this.elTargetScore.textContent = `TARGET: ${target.toLocaleString()}`;

    const pct = Math.min(100, (g.stageScore / Math.max(1, target)) * 100);
    this.elProgressFill.style.width = `${pct.toFixed(1)}%`;
    this.elProgressFill.classList.toggle('cleared', g.stageScore >= target);

    // Show "Finish Stage & Cash Out" button if target reached while playing
    const hasEarlyBtn = this.elEarlyCashoutContainer.childElementCount > 0;
    const shouldShowEarlyBtn = g.phase === 'playing' && g.stageScore >= target;
    if (shouldShowEarlyBtn && !hasEarlyBtn) {
      this.elEarlyCashoutContainer.innerHTML = `
        <button id="btn-cashout-now" class="cashout-early-btn">
          ★ TARGET MET! CASH OUT (+$${g.ballQueue.length} BALL BONUS) ★
        </button>
      `;
      document.getElementById('btn-cashout-now')?.addEventListener('click', () => {
        this.game.cashOutEarlyIfTargetMet();
      });
    } else if (!shouldShowEarlyBtn && hasEarlyBtn) {
      this.elEarlyCashoutContainer.innerHTML = '';
    }

    this.elBallChips.textContent = g.ballChips.toLocaleString();
    this.elBallMult.textContent = `${g.ballMult.toFixed(2)}x`;
    this.elComboBadge.textContent =
      g.combo > 0 ? `COMBO x${g.combo} (${g.comboTimer.toFixed(1)}s)` : 'COMBO x0';
    this.elLastHit.textContent = g.lastHitLabel;
    this.elGoldVal.textContent = `$${g.gold}`;
    this.elAnteVal.textContent = g.endlessMode ? `${g.ante} (∞)` : `${g.ante} / 8`;

    this.elTiltFill.style.width = `${g.tiltMeter}%`;
    this.elTiltStatus.textContent = g.isTilted
      ? 'TILT LOCKED!'
      : g.tiltMeter > 60
      ? 'WARNING!'
      : 'STABLE';
    this.elTiltStatus.style.color = g.isTilted ? '#ff2a85' : '#00f5d4';

    // Update Relic card pulse states in place
    const cards = this.elRelicList.querySelectorAll('.relic-card');
    g.relics.forEach((r, idx) => {
      const card = cards[idx] as HTMLElement | undefined;
      if (!card) return;
      const isPulsing = r.pulseTimer > 0;
      card.classList.toggle('pulsing', isPulsing);
      const badge = card.querySelector('.relic-trigger-pop') as HTMLElement | null;
      if (badge) {
        badge.style.display = isPulsing ? 'block' : 'none';
        badge.textContent = r.lastTriggerText;
      }
    });
  }

  private renderStructuralUI(): void {
    const g = this.game;
    const stage = g.currentStage;

    // 1. Blind Header Card
    const blindBox = document.getElementById('blind-header-box')!;
    blindBox.className = `panel-section blind-card ${stage.type === 'boss' ? 'is-boss' : ''}`;
    blindBox.innerHTML = `
      <div class="section-label">
        <span>${stage.type.toUpperCase()} BLIND</span>
        <span style="color: var(--neon-gold)">REWARD: $${stage.rewardGold}</span>
      </div>
      <div class="blind-title">${stage.name}</div>
      ${
        stage.boss
          ? `<div class="boss-warning">${stage.boss.icon} <b>${stage.boss.name}</b>: ${stage.boss.subtitle}</div>`
          : `<div style="font-size: 12px; color: var(--text-muted);">Standard cyber-table conditions. Beat the target score before draining all balls!</div>`
      }
    `;

    // 2. Ball Queue Rack
    const activeBalls = g.balls.filter((b) => !b.isPhantom).map((b) => b.type);
    const allRemaining = [...activeBalls, ...g.ballQueue];
    document.getElementById('hud-balls-count')!.textContent = `${allRemaining.length} IN QUEUE`;

    this.elBallRack.innerHTML = allRemaining
      .map((type, idx) => {
        const def = BALL_DEFINITIONS[type];
        return `
          <div
            class="ball-orb ${idx === 0 ? 'active-ball' : ''}"
            title="${def.name}: ${def.description}"
            style="background: radial-gradient(circle at 30% 30%, #fff, ${def.color}); box-shadow: 0 0 10px ${def.glowColor};"
          ></div>
        `;
      })
      .join('');

    // 3. Relic List
    document.getElementById('hud-relic-slots')!.textContent = `${g.relics.length} / ${g.maxRelics}`;
    if (g.relics.length === 0) {
      this.elRelicList.innerHTML = `
        <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 18px 8px; border: 1px dashed rgba(148,163,184,0.2); border-radius: 8px;">
          No Relics installed yet.<br/>Clear blinds & visit the Cyber Shop to equip synergies!
        </div>
      `;
    } else {
      this.elRelicList.innerHTML = g.relics
        .map((r, idx) => {
          const sellPrice = Math.max(2, Math.floor(r.def.cost / 2));
          return `
            <div class="relic-card">
              <div class="relic-trigger-pop" style="display: none"></div>
              <div class="relic-icon">${r.def.icon}</div>
              <div class="relic-info">
                <div class="relic-header">
                  <span class="relic-name">${r.def.name}</span>
                  <span class="rarity-tag rarity-${r.def.rarity}">${r.def.rarity}</span>
                </div>
                <div class="relic-desc">${r.def.description}</div>
                <button class="sell-mini-btn" data-sell-idx="${idx}">SELL +$${sellPrice}</button>
              </div>
            </div>
          `;
        })
        .join('');

      this.elRelicList.querySelectorAll('[data-sell-idx]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = Number((e.currentTarget as HTMLElement).dataset.sellIdx);
          const removed = g.relics.splice(idx, 1)[0];
          if (removed) {
            g.gold += Math.max(2, Math.floor(removed.def.cost / 2));
            g.sound.playCoin();
            this.renderStructuralUI();
          }
        });
      });
    }

    // 4. Table Upgrades Summary
    const upgradesEl = document.getElementById('hud-upgrades-list')!;
    upgradesEl.innerHTML = TABLE_UPGRADES.map((u) => {
      const lvl = g.upgradeLevels[u.id] || 0;
      return `
        <div class="upgrade-row" title="${u.description}">
          <span>${u.icon} ${u.name}</span>
          <span class="upgrade-lvl">LV ${lvl}/${u.maxLevel}</span>
        </div>
      `;
    }).join('');

    // 5. Phase Modal Overlays
    this.renderPhaseModal();
  }

  private rollShopOffers(resetCost: boolean): void {
    const g = this.game;
    if (resetCost) this.shop.rerollCost = 2;

    // Pick up to 3 unowned Relics
    const availableRelics = RELIC_DEFINITIONS.filter((r) => !g.hasRelic(r.id));
    const shuffledRelics = [...availableRelics].sort(() => Math.random() - 0.5);
    this.shop.relicOffers = shuffledRelics.slice(0, 3).map((def) => ({ def, sold: false }));

    // Pick 2 Special Balls
    const specialBallIds: BallTypeId[] = [
      'plasma',
      'tungsten',
      'quantum',
      'gold',
      'superconductor',
    ];
    const shuffledBalls = [...specialBallIds].sort(() => Math.random() - 0.5);
    this.shop.ballOffers = shuffledBalls.slice(0, 2).map((type) => ({
      type,
      cost: BALL_DEFINITIONS[type].cost,
      sold: false,
    }));

    // Pick 3 available Table Upgrades
    const availableUpgrades = TABLE_UPGRADES.filter(
      (u) => (g.upgradeLevels[u.id] || 0) < u.maxLevel
    );
    const shuffledUpgrades = [...availableUpgrades].sort(() => Math.random() - 0.5);
    this.shop.upgradeOffers = shuffledUpgrades.slice(0, 3).map((def) => {
      const currentLvl = g.upgradeLevels[def.id] || 0;
      return {
        def,
        cost: def.baseCost + currentLvl * 2,
        sold: false,
      };
    });
  }

  private renderPhaseModal(): void {
    const g = this.game;

    if (g.phase === 'playing') {
      this.elOverlayContainer.innerHTML = '';
      return;
    }

    if (g.phase === 'blind_select') {
      this.elOverlayContainer.innerHTML = `
        <div class="overlay-backdrop">
          <div class="modal-box">
            <div class="modal-header">
              <div>
                <div class="section-label" style="margin:0">ANTE ${g.ante} // SECTOR BRIEFING</div>
                <div class="modal-title">SELECT OR SKIP BLIND</div>
              </div>
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 18px; color: var(--neon-gold); font-weight: 800;">
                CREDITS: $${g.gold}
              </div>
            </div>

            <div class="blinds-grid">
              ${g.stages
                .map((st, idx) => {
                  const isCurrent = idx === g.stageIndex;
                  const isPassed = idx < g.stageIndex;
                  return `
                    <div class="blind-select-card ${isCurrent ? 'current' : ''} ${
                    isPassed ? 'passed' : ''
                  }">
                      <div>
                        <div class="section-label">
                          <span>${st.type.toUpperCase()} BLIND</span>
                          <span style="color: var(--neon-gold)">+$${st.rewardGold}</span>
                        </div>
                        <div style="font-family: 'Orbitron', sans-serif; font-size: 16px; font-weight: 800; margin-bottom: 8px;">
                          ${st.name}
                        </div>
                        <div style="font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 800; color: var(--neon-cyan); margin-bottom: 8px;">
                          ${st.targetScore.toLocaleString()} PTS
                        </div>
                        ${
                          st.boss
                            ? `<div class="boss-warning">${st.boss.icon} <b>${st.boss.name}</b><br/>${st.boss.subtitle}</div>`
                            : `<div style="font-size: 12px; color: var(--text-muted);">No table hazards active.</div>`
                        }
                      </div>

                      <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                        ${
                          isCurrent
                            ? `
                              <button id="btn-play-blind" class="primary-btn">LAUNCH STAGE ▶</button>
                              ${
                                st.type !== 'boss'
                                  ? `<button id="btn-skip-blind" class="secondary-btn">
                                      SKIP BLIND: ${st.skipTagTitle}<br/>
                                      <span style="font-size: 10px; font-family: 'Rajdhani', sans-serif; color: #cbd5e1;">(${st.skipTagDesc})</span>
                                    </button>`
                                  : ''
                              }
                            `
                            : `<div style="text-align: center; font-family: 'Orbitron', sans-serif; font-size: 11px; color: var(--text-muted);">
                                ${isPassed ? '✓ COMPLETED / SKIPPED' : 'LOCKED'}
                              </div>`
                        }
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-play-blind')?.addEventListener('click', () => {
        this.game.startStage();
      });
      document.getElementById('btn-skip-blind')?.addEventListener('click', () => {
        this.game.skipCurrentBlind();
      });
      return;
    }

    if (g.phase === 'cashout' && g.lastCashout) {
      const c = g.lastCashout;
      this.elOverlayContainer.innerHTML = `
        <div class="overlay-backdrop">
          <div class="modal-box" style="max-width: 540px;">
            <div class="modal-header">
              <div>
                <div class="section-label" style="margin:0; color: var(--neon-cyan)">STAGE TARGET DESTROYED</div>
                <div class="modal-title">${c.stageName}</div>
              </div>
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 16px; color: var(--neon-cyan);">
                ${c.stageScore.toLocaleString()} PTS
              </div>
            </div>

            <table class="cashout-table">
              <tr>
                <td>Stage Cleared Bounty</td>
                <td style="text-align: right; color: var(--neon-gold);">+$${c.baseReward}</td>
              </tr>
              <tr>
                <td>Remaining Balls Bonus ($1 × ${c.ballsRemainingBonus})</td>
                <td style="text-align: right; color: var(--neon-gold);">+$${c.ballsRemainingBonus}</td>
              </tr>
              <tr>
                <td>Vault Interest ($1 per $5 held, max $5)</td>
                <td style="text-align: right; color: var(--neon-gold);">+$${c.interestBonus}</td>
              </tr>
              ${
                c.relicBonus > 0
                  ? `<tr>
                      <td>Salvage Drone Relic Bonus</td>
                      <td style="text-align: right; color: var(--neon-gold);">+$${c.relicBonus}</td>
                    </tr>`
                  : ''
              }
              <tr class="total-row">
                <td>TOTAL PAYOUT</td>
                <td style="text-align: right;">+$${c.totalEarned} (Total: $${g.gold})</td>
              </tr>
            </table>

            <button id="btn-goto-shop" class="primary-btn" style="width: 100%; font-size: 15px; padding: 13px;">
              ENTER CYBER SHOP 🛒
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-goto-shop')?.addEventListener('click', () => {
        this.game.proceedFromCashoutToShop();
      });
      return;
    }

    if (g.phase === 'shop') {
      this.elOverlayContainer.innerHTML = `
        <div class="overlay-backdrop">
          <div class="modal-box">
            <div class="modal-header">
              <div>
                <div class="section-label" style="margin:0">BETWEEN-STAGE UPGRADE TERMINAL</div>
                <div class="modal-title">NEON CYBER SHOP</div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 800; color: var(--neon-gold);">
                  CREDITS: $${g.gold}
                </span>
                <button id="btn-reroll-shop" class="secondary-btn" ${
                  g.gold < this.shop.rerollCost ? 'disabled' : ''
                }>
                  🎲 REROLL ($${this.shop.rerollCost})
                </button>
                <button id="btn-leave-shop" class="primary-btn">
                  NEXT STAGE ▶
                </button>
              </div>
            </div>

            <div class="shop-section-title">RELIC CARTRIDGES (${g.relics.length}/${g.maxRelics} SLOTS)</div>
            <div class="shop-grid">
              ${this.shop.relicOffers
                .map((offer, idx) => {
                  const canAfford =
                    !offer.sold && g.gold >= offer.def.cost && g.relics.length < g.maxRelics;
                  return `
                    <div class="shop-item ${offer.sold ? 'sold' : ''}">
                      <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                          <span style="font-size: 22px;">${offer.def.icon}</span>
                          <span class="rarity-tag rarity-${offer.def.rarity}">${offer.def.rarity}</span>
                        </div>
                        <div class="relic-name" style="font-size: 13px; margin-bottom: 4px;">${offer.def.name}</div>
                        <div class="relic-desc">${offer.def.description}</div>
                      </div>
                      <button class="buy-btn" data-buy-relic="${idx}" ${!canAfford ? 'disabled' : ''}>
                        ${
                          offer.sold
                            ? 'INSTALLED'
                            : g.relics.length >= g.maxRelics
                            ? 'SLOTS FULL'
                            : `BUY RELIC ($${offer.def.cost})`
                        }
                      </button>
                    </div>
                  `;
                })
                .join('')}
            </div>

            <div class="shop-section-title">TABLE ENGINEERING UPGRADES (PERMANENT)</div>
            <div class="shop-grid">
              ${this.shop.upgradeOffers
                .map((offer, idx) => {
                  const curLvl = g.upgradeLevels[offer.def.id] || 0;
                  const canAfford =
                    !offer.sold && g.gold >= offer.cost && curLvl < offer.def.maxLevel;
                  return `
                    <div class="shop-item ${offer.sold ? 'sold' : ''}">
                      <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                          <span style="font-size: 20px;">${offer.def.icon}</span>
                          <span class="upgrade-lvl">LV ${curLvl} → ${curLvl + 1}</span>
                        </div>
                        <div class="relic-name" style="font-size: 13px; margin-bottom: 4px;">${offer.def.name}</div>
                        <div class="relic-desc">${offer.def.description}</div>
                      </div>
                      <button class="buy-btn" data-buy-upgrade="${idx}" ${
                    !canAfford ? 'disabled' : ''
                  }>
                        ${offer.sold ? 'UPGRADED' : `INSTALL MOD ($${offer.cost})`}
                      </button>
                    </div>
                  `;
                })
                .join('')}
            </div>

            <div class="shop-section-title">SPECIAL BALL FOUNDRY (ADDS +1 BALL TO STAGE QUEUE)</div>
            <div class="shop-grid" style="grid-template-columns: repeat(2, 1fr);">
              ${this.shop.ballOffers
                .map((offer, idx) => {
                  const def = BALL_DEFINITIONS[offer.type];
                  const canAfford = !offer.sold && g.gold >= offer.cost;
                  return `
                    <div class="shop-item ${offer.sold ? 'sold' : ''}">
                      <div style="display: flex; gap: 12px; align-items: center;">
                        <div class="ball-orb" style="width: 34px; height: 34px; flex-shrink:0; background: radial-gradient(circle at 30% 30%, #fff, ${def.color}); box-shadow: 0 0 12px ${def.glowColor};"></div>
                        <div>
                          <div class="relic-name" style="font-size: 13px;">${def.name} <span style="color: var(--neon-cyan); font-size: 10px;">[${def.badge}]</span></div>
                          <div class="relic-desc">${def.description}</div>
                        </div>
                      </div>
                      <button class="buy-btn" data-buy-ball="${idx}" ${!canAfford ? 'disabled' : ''}>
                        ${offer.sold ? 'ADDED TO BAG' : `ADD BALL TO BAG ($${offer.cost})`}
                      </button>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-reroll-shop')?.addEventListener('click', () => {
        if (g.gold >= this.shop.rerollCost) {
          g.gold -= this.shop.rerollCost;
          this.shop.rerollCost += 1;
          g.sound.playCoin();
          this.rollShopOffers(false);
          this.renderStructuralUI();
        }
      });

      document.getElementById('btn-leave-shop')?.addEventListener('click', () => {
        g.leaveShopForNextStage();
      });

      this.elOverlayContainer.querySelectorAll('[data-buy-relic]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = Number((e.currentTarget as HTMLElement).dataset.buyRelic);
          const offer = this.shop.relicOffers[idx];
          if (offer && !offer.sold && g.gold >= offer.def.cost && g.relics.length < g.maxRelics) {
            g.gold -= offer.def.cost;
            offer.sold = true;
            g.relics.push({
              def: offer.def,
              pulseTimer: 0.6,
              lastTriggerText: 'EQUIPPED',
              counter: 0,
            });
            g.sound.playCoin();
            this.renderStructuralUI();
          }
        });
      });

      this.elOverlayContainer.querySelectorAll('[data-buy-upgrade]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = Number((e.currentTarget as HTMLElement).dataset.buyUpgrade);
          const offer = this.shop.upgradeOffers[idx];
          if (offer && !offer.sold && g.gold >= offer.cost) {
            g.gold -= offer.cost;
            offer.sold = true;
            g.upgradeLevels[offer.def.id] = (g.upgradeLevels[offer.def.id] || 0) + 1;
            g.buildTableGeometry();
            g.sound.playCoin();
            this.renderStructuralUI();
          }
        });
      });

      this.elOverlayContainer.querySelectorAll('[data-buy-ball]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = Number((e.currentTarget as HTMLElement).dataset.buyBall);
          const offer = this.shop.ballOffers[idx];
          if (offer && !offer.sold && g.gold >= offer.cost) {
            g.gold -= offer.cost;
            offer.sold = true;
            g.ballInventory.push(offer.type);
            g.sound.playCoin();
            this.renderStructuralUI();
          }
        });
      });
      return;
    }

    if (g.phase === 'victory') {
      this.elOverlayContainer.innerHTML = `
        <div class="overlay-backdrop">
          <div class="modal-box" style="max-width: 520px; text-align: center;">
            <div class="section-label" style="justify-content: center; color: var(--neon-gold);">
              ★ OMEGA CORE DEFEATED // ANTE 8 CLEARED ★
            </div>
            <div class="modal-title" style="font-size: 28px; margin: 10px 0;">
              CYBER WIZARD VICTORY!
            </div>
            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 18px;">
              You conquered all 8 Antes of Pinballite! Push your build into Endless Overdrive or start a fresh run.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <button id="btn-endless" class="primary-btn">ENTER ENDLESS MODE (∞)</button>
              <button id="btn-victory-restart" class="secondary-btn">START NEW RUN</button>
            </div>
          </div>
        </div>
      `;
      document.getElementById('btn-endless')?.addEventListener('click', () => {
        g.continueEndlessMode();
      });
      document.getElementById('btn-victory-restart')?.addEventListener('click', () => {
        g.startNewRun();
      });
      return;
    }

    if (g.phase === 'gameover') {
      this.elOverlayContainer.innerHTML = `
        <div class="overlay-backdrop">
          <div class="modal-box" style="max-width: 480px; text-align: center; border-color: var(--neon-pink);">
            <div class="section-label" style="justify-content: center; color: var(--neon-pink);">
              BALLS DEPLETED // TARGET MISSED
            </div>
            <div class="modal-title" style="font-size: 28px; margin: 8px 0; color: var(--neon-pink);">
              SYSTEM DRAINED
            </div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 15px; margin: 14px 0; color: #e2e8f0;">
              Reached: <b>${g.currentStage.name}</b><br/>
              Stage Score: <b style="color: var(--neon-cyan)">${g.stageScore.toLocaleString()}</b> / ${g.currentStage.targetScore.toLocaleString()}<br/>
              Max Combo: <b style="color: var(--neon-gold)">${g.maxComboThisStage}x</b>
            </div>
            <button id="btn-retry-run" class="primary-btn" style="width: 100%; margin-top: 8px;">
              ↻ LAUNCH NEW RUN
            </button>
          </div>
        </div>
      `;
      document.getElementById('btn-retry-run')?.addEventListener('click', () => {
        g.startNewRun();
      });
    }
  }
}

new AppController();
