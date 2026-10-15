import {
  BALL_DEFINITIONS,
  BOSS_MODIFIERS,
  RELIC_DEFINITIONS,
  TABLE_UPGRADES,
  generateAnteStages,
} from './content';
import { SoundEngine } from './audio';
import {
  ActiveBall,
  BallTypeId,
  BlindStage,
  Bumper,
  DropTarget,
  Flipper,
  FloatingText,
  LightningArc,
  Particle,
  Post,
  RelicInstance,
  RolloverLane,
  Shockwave,
  SpinnerGate,
  WallSegment,
} from './types';

export const TABLE_WIDTH = 520;
export const TABLE_HEIGHT = 860;
export const PLAYFIELD_CENTER_X = 241;

export interface CashoutSummary {
  stageName: string;
  stageScore: number;
  targetScore: number;
  baseReward: number;
  ballsRemainingBonus: number;
  interestBonus: number;
  relicBonus: number;
  totalEarned: number;
  isBoss: boolean;
  anteCleared: boolean;
}

export class PinballGame {
  public sound = new SoundEngine();

  // Roguelite Run State
  public ante: number = 1;
  public stageIndex: number = 0; // 0 = small, 1 = big, 2 = boss
  public stages: [BlindStage, BlindStage, BlindStage] = generateAnteStages(1);
  public gold: number = 6;
  public maxRelics: number = 5;
  public relics: RelicInstance[] = [];
  public ballInventory: BallTypeId[] = ['chrome', 'chrome', 'chrome'];
  public upgradeLevels: Record<string, number> = {
    bumper_power: 0,
    extra_bumpers: 0,
    target_amp: 0,
    spinner_boost: 0,
    left_kickback: 0,
    right_kickback: 0,
    center_post: 0,
    upper_flipper: 0,
  };

  // Current Stage State
  public stageScore: number = 0;
  public ballChips: number = 0;
  public ballMult: number = 1.0;
  public baseBallMult: number = 1.0;
  public combo: number = 0;
  public maxComboThisStage: number = 0;
  public comboTimer: number = 0;
  public maxComboTime: number = 3.6;
  public lastHitLabel: string = 'READY TO LAUNCH';
  public lastHitPoints: number = 0;

  public ballQueue: BallTypeId[] = [];
  public ballsLaunchedThisStage: number = 0;
  public lazarusUsedThisStage: boolean = false;
  public leftKickbacksLeft: number = 0;
  public rightKickbacksLeft: number = 0;
  public nexusCharge: number = 0;
  public nexusMaxCharge: number = 10;
  public nexusReady: boolean = false;
  public nexusCooldown: number = 0;

  // Plunger & Tilt State
  public plungerCharge: number = 0;
  public isChargingPlunger: boolean = false;
  public tiltMeter: number = 0; // 0 to 100
  public isTilted: boolean = false;
  public nudgeCooldown: number = 0;
  public screenShake: number = 0;
  public screenFlash: number = 0;
  public glitchTimer: number = 0;

  // Phase management
  public phase: 'blind_select' | 'playing' | 'cashout' | 'shop' | 'gameover' | 'victory' =
    'blind_select';
  public lastCashout: CashoutSummary | null = null;
  public endlessMode: boolean = false;

  // Physics Entities
  public balls: ActiveBall[] = [];
  private nextBallId: number = 1;
  public walls: WallSegment[] = [];
  public bumpers: Bumper[] = [];
  public posts: Post[] = [];
  public dropTargets: DropTarget[] = [];
  public rolloverLanes: RolloverLane[] = [];
  public spinners: SpinnerGate[] = [];
  public flippers: Flipper[] = [];

  // Visual Effects
  public floatingTexts: FloatingText[] = [];
  public particles: Particle[] = [];
  public shockwaves: Shockwave[] = [];
  public lightningArcs: LightningArc[] = [];

  // Callbacks to notify UI
  public onStateChange?: () => void;

  constructor() {
    this.buildTableGeometry();
    this.startNewRun();
  }

  public get currentStage(): BlindStage {
    return this.stages[this.stageIndex];
  }

  public get activeBossId(): string | null {
    const stage = this.currentStage;
    return stage.type === 'boss' && stage.boss ? stage.boss.id : null;
  }

  public hasRelic(id: string): boolean {
    return this.relics.some((r) => r.def.id === id);
  }

  public getRelic(id: string): RelicInstance | undefined {
    return this.relics.find((r) => r.def.id === id);
  }

  public triggerRelic(id: string, badgeText: string): void {
    const r = this.getRelic(id);
    if (r) {
      r.pulseTimer = 0.65;
      r.lastTriggerText = badgeText;
      this.sound.playRelicTrigger();
    }
  }

  public startNewRun(): void {
    this.ante = 1;
    this.stageIndex = 0;
    this.stages = generateAnteStages(1);
    this.gold = 6;
    this.maxRelics = 5;
    this.relics = [];
    this.ballInventory = ['chrome', 'chrome', 'chrome'];
    this.endlessMode = false;

    for (const key of Object.keys(this.upgradeLevels)) {
      this.upgradeLevels[key] = 0;
    }

    this.phase = 'blind_select';
    this.buildTableGeometry();
    this.notifyUI();
  }

  public startStage(): void {
    this.phase = 'playing';
    this.stageScore = 0;
    this.combo = 0;
    this.maxComboThisStage = 0;
    this.comboTimer = 0;
    this.ballsLaunchedThisStage = 0;
    this.lazarusUsedThisStage = false;
    this.tiltMeter = 0;
    this.isTilted = false;
    this.nexusCharge = 0;
    this.nexusReady = false;
    this.balls = [];

    // Copy ball inventory for this stage
    this.ballQueue = [...this.ballInventory];

    // Configure kickbacks from upgrades (disabled if EMP Drain boss)
    const isEmpBoss = this.activeBossId === 'emp_drain';
    this.leftKickbacksLeft = isEmpBoss ? 0 : this.upgradeLevels.left_kickback;
    this.rightKickbacksLeft = isEmpBoss ? 0 : this.upgradeLevels.right_kickback;

    this.buildTableGeometry();
    this.spawnNextBallInShooter();
    this.notifyUI();
  }

  public skipCurrentBlind(): void {
    const stage = this.currentStage;
    if (stage.type === 'boss') return;

    const tagId = stage.skipTagId;
    if (tagId === 'gold_cache') {
      this.gold += 7;
      this.sound.playCoin();
    } else if (tagId === 'free_relic') {
      const pool = RELIC_DEFINITIONS.filter(
        (r) =>
          (r.rarity === 'Uncommon' || r.rarity === 'Rare') &&
          !this.hasRelic(r.id)
      );
      if (pool.length > 0 && this.relics.length < this.maxRelics) {
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        this.relics.push({ def: chosen, pulseTimer: 0.8, lastTriggerText: 'NEW!', counter: 0 });
      } else {
        this.gold += 6;
      }
      this.sound.playJackpot();
    } else if (tagId === 'ball_pack') {
      const specialTypes: BallTypeId[] = ['plasma', 'tungsten', 'quantum', 'gold', 'superconductor'];
      const chosen = specialTypes[Math.floor(Math.random() * specialTypes.length)];
      this.ballInventory.push(chosen);
      this.sound.playJackpot();
    } else if (tagId === 'overclock_tag') {
      this.upgradeLevels.bumper_power = Math.min(8, this.upgradeLevels.bumper_power + 1);
      this.upgradeLevels.spinner_boost = Math.min(6, this.upgradeLevels.spinner_boost + 1);
      this.sound.playJackpot();
    }

    this.stageIndex++;
    this.buildTableGeometry();
    this.notifyUI();
  }

  public buildTableGeometry(): void {
    this.walls = [];
    this.bumpers = [];
    this.posts = [];
    this.dropTargets = [];
    this.rolloverLanes = [];
    this.spinners = [];
    this.flippers = [];

    // 1. Upper Elliptical Arch from right (500, 220) to left (20, 220)
    const archSegments = 28;
    const cx = 260;
    const cy = 220;
    const rx = 240;
    const ry = 192;
    for (let i = 0; i < archSegments; i++) {
      const a1 = -(i / archSegments) * Math.PI;
      const a2 = -((i + 1) / archSegments) * Math.PI;
      this.walls.push({
        x1: cx + Math.cos(a1) * rx,
        y1: cy + Math.sin(a1) * ry,
        x2: cx + Math.cos(a2) * rx,
        y2: cy + Math.sin(a2) * ry,
        restitution: 0.85,
        color: '#00f5d4',
      });
    }

    // 2. Outer Left Wall & Apron
    this.walls.push(
      { x1: 20, y1: 220, x2: 20, y2: 350, color: '#00f5d4' },
      { x1: 20, y1: 350, x2: 38, y2: 475, color: '#00f5d4' },
      { x1: 38, y1: 475, x2: 20, y2: 535, color: '#00f5d4' },
      { x1: 20, y1: 535, x2: 20, y2: 695, color: '#38bdf8' },
      { x1: 20, y1: 695, x2: 148, y2: 790, color: '#38bdf8' }
    );

    // 3. Outer Right Wall & Shooter Lane
    this.walls.push(
      { x1: 500, y1: 220, x2: 500, y2: 825, color: '#00f5d4' },
      // Shooter lane bottom
      { x1: 462, y1: 825, x2: 500, y2: 825, color: '#facc15' },
      // Shooter lane inner divider wall
      { x1: 462, y1: 235, x2: 462, y2: 825, color: '#38bdf8' },
      // One-way gate at top of shooter lane (blocks balls from re-entering shooter lane)
      {
        x1: 462,
        y1: 235,
        x2: 498,
        y2: 192,
        color: '#facc15',
        isOneWayGate: true,
      },
      // Inner right playfield contour & apron
      { x1: 462, y1: 350, x2: 444, y2: 475, color: '#00f5d4' },
      { x1: 444, y1: 475, x2: 462, y2: 535, color: '#00f5d4' },
      { x1: 462, y1: 695, x2: 334, y2: 790, color: '#38bdf8' }
    );

    // 4. Left & Right Inlane / Outlane Dividers
    this.walls.push(
      // Left divider & inlane rail to Left Flipper pivot (148, 724)
      { x1: 64, y1: 555, x2: 64, y2: 655, color: '#a855f7' },
      { x1: 64, y1: 655, x2: 148, y2: 724, color: '#a855f7' },
      // Right divider & inlane rail to Right Flipper pivot (334, 724)
      { x1: 418, y1: 555, x2: 418, y2: 655, color: '#a855f7' },
      { x1: 418, y1: 655, x2: 334, y2: 724, color: '#a855f7' }
    );

    // 5. Left & Right Slingshots
    this.walls.push(
      // Left slingshot triangle
      { x1: 102, y1: 550, x2: 102, y2: 642, color: '#ff2a85' },
      { x1: 102, y1: 642, x2: 152, y2: 676, color: '#ff2a85' },
      {
        x1: 102,
        y1: 550,
        x2: 152,
        y2: 676,
        restitution: 1.75,
        color: '#ff2a85',
        isSlingshot: 'left',
      },
      // Right slingshot triangle
      { x1: 380, y1: 550, x2: 380, y2: 642, color: '#ff2a85' },
      { x1: 380, y1: 642, x2: 330, y2: 676, color: '#ff2a85' },
      {
        x1: 380,
        y1: 550,
        x2: 330,
        y2: 676,
        restitution: 1.75,
        color: '#ff2a85',
        isSlingshot: 'right',
      }
    );

    // 6. Top Rollover Lane Divider Fins (around N - E - O lanes)
    const finXs = [142, 208, 274, 340];
    for (const fx of finXs) {
      this.walls.push({
        x1: fx,
        y1: 98,
        x2: fx,
        y2: 148,
        color: '#38bdf8',
      });
      this.posts.push(
        { x: fx, y: 98, radius: 5, restitution: 0.9, color: '#38bdf8' },
        { x: fx, y: 148, radius: 5, restitution: 0.9, color: '#38bdf8' }
      );
    }

    // 7. Top N - E - O Rollover Sensors
    const laneXs = [175, 241, 307];
    const laneLabels = ['N', 'E', 'O'];
    const skillShotIdx = Math.floor(Math.random() * 3);
    laneXs.forEach((lx, idx) => {
      this.rolloverLanes.push({
        id: `lane_${idx}`,
        label: laneLabels[idx],
        x: lx,
        y: 123,
        radius: 17,
        lit: false,
        cooldown: 0,
        isSkillShot: idx === skillShotIdx,
      });
    });

    // 8. Upper Orbit Guides & Spinners
    this.spinners.push(
      {
        id: 'spinner_left',
        label: 'L-ORBIT',
        x: 82,
        y: 265,
        radius: 22,
        angle: 0,
        spinVelocity: 0,
        accumulatedAngle: 0,
        color: '#00f5d4',
      },
      {
        id: 'spinner_right',
        label: 'R-ORBIT',
        x: 400,
        y: 265,
        radius: 22,
        angle: 0,
        spinVelocity: 0,
        accumulatedAngle: 0,
        color: '#00f5d4',
      }
    );

    // 9. Pop Bumpers
    const bumperLvl = 1 + this.upgradeLevels.bumper_power;
    const baseBumperChips = 45 + this.upgradeLevels.bumper_power * 30;
    const bumperDefs = [
      { id: 'b_tl', x: 174, y: 245, color: '#ff2a85' },
      { id: 'b_tr', x: 308, y: 245, color: '#00f5d4' },
      { id: 'b_mid', x: 241, y: 196, color: '#facc15' },
      { id: 'b_bot', x: 241, y: 312, color: '#a855f7' },
    ];
    if (this.upgradeLevels.extra_bumpers >= 1) {
      bumperDefs.push({ id: 'b_ex1', x: 145, y: 335, color: '#38bdf8' });
    }
    if (this.upgradeLevels.extra_bumpers >= 2) {
      bumperDefs.push({ id: 'b_ex2', x: 337, y: 335, color: '#38bdf8' });
    }

    for (const b of bumperDefs) {
      this.bumpers.push({
        id: b.id,
        x: b.x,
        y: b.y,
        radius: 24,
        baseChips: baseBumperChips,
        color: b.color,
        hitAnim: 0,
        level: bumperLvl,
      });
    }

    // 10. Left & Right 3-Target Drop Banks
    for (let i = 0; i < 3; i++) {
      const t1 = i / 3;
      const t2 = (i + 0.82) / 3;
      // Left bank along (44, 358) -> (60, 468)
      this.dropTargets.push({
        id: `dt_l_${i}`,
        bank: 'left',
        x1: 44 + t1 * 16,
        y1: 358 + t1 * 110,
        x2: 44 + t2 * 16,
        y2: 358 + t2 * 110,
        isDown: false,
        hitAnim: 0,
        color: '#facc15',
      });
      // Right bank along (438, 358) -> (422, 468)
      this.dropTargets.push({
        id: `dt_r_${i}`,
        bank: 'right',
        x1: 438 - t1 * 16,
        y1: 358 + t1 * 110,
        x2: 438 - t2 * 16,
        y2: 358 + t2 * 110,
        isDown: false,
        hitAnim: 0,
        color: '#00f5d4',
      });
    }

    // 11. Posts (Rubber bounce pins at lane entrances & Nexus ring)
    this.posts.push(
      { x: 64, y: 555, radius: 6, restitution: 1.15, color: '#a855f7' },
      { x: 418, y: 555, radius: 6, restitution: 1.15, color: '#a855f7' },
      { x: 102, y: 550, radius: 6, restitution: 1.15, color: '#ff2a85' },
      { x: 380, y: 550, radius: 6, restitution: 1.15, color: '#ff2a85' },
      // Nexus Core flanking guide posts
      { x: 196, y: 425, radius: 7, restitution: 1.1, color: '#00f5d4' },
      { x: 286, y: 425, radius: 7, restitution: 1.1, color: '#00f5d4' }
    );

    // Center Plasma Post (if upgraded)
    if (this.upgradeLevels.center_post > 0) {
      this.posts.push({
        x: PLAYFIELD_CENTER_X,
        y: 758,
        radius: 6 + this.upgradeLevels.center_post * 3.5,
        restitution: 1.35,
        color: '#00f5d4',
      });
    }

    // 12. Flippers
    const isEmpBoss = this.activeBossId === 'emp_drain';
    const mainFlipperLength = isEmpBoss ? 62 : 73;

    this.flippers.push(
      {
        id: 'left',
        side: 'left',
        pivotX: 148,
        pivotY: 724,
        length: mainFlipperLength,
        baseRadius: 10,
        tipRadius: 6,
        restAngle: 0.45,
        activeAngle: -0.54,
        currentAngle: 0.45,
        angularVelocity: 0,
        isPressed: false,
        enabled: true,
      },
      {
        id: 'right',
        side: 'right',
        pivotX: 334,
        pivotY: 724,
        length: mainFlipperLength,
        baseRadius: 10,
        tipRadius: 6,
        restAngle: Math.PI - 0.45,
        activeAngle: Math.PI + 0.54,
        currentAngle: Math.PI - 0.45,
        angularVelocity: 0,
        isPressed: false,
        enabled: true,
      }
    );

    if (this.upgradeLevels.upper_flipper > 0) {
      this.flippers.push({
        id: 'upperLeft',
        side: 'left',
        pivotX: 72,
        pivotY: 325,
        length: 52,
        baseRadius: 8,
        tipRadius: 5,
        restAngle: 0.55,
        activeAngle: -0.48,
        currentAngle: 0.55,
        angularVelocity: 0,
        isPressed: false,
        enabled: true,
      });
    }
  }

  public spawnNextBallInShooter(): void {
    const nextType = this.ballQueue.shift() ?? 'chrome';

    // Reset current ball score breakdown for the new ball
    this.ballChips = 0;
    let startingMult = 1.0;
    if (this.hasRelic('midas_plunger')) {
      const bonus = Math.floor(this.gold / 5) * 0.5;
      startingMult += bonus;
      if (bonus > 0) {
        this.triggerRelic('midas_plunger', `+${bonus.toFixed(1)} MULT`);
      }
    }
    this.baseBallMult = startingMult;
    this.ballMult = startingMult;
    this.combo = 0;
    this.comboTimer = 0;
    this.tiltMeter = Math.max(0, this.tiltMeter - 50);
    this.isTilted = false;

    // Reset skill shot highlight
    const skillIdx = Math.floor(Math.random() * this.rolloverLanes.length);
    this.rolloverLanes.forEach((lane, i) => {
      lane.isSkillShot = i === skillIdx;
    });

    this.balls.push({
      id: this.nextBallId++,
      type: nextType,
      x: 481,
      y: 790,
      vx: 0,
      vy: 0,
      radius: 11,
      inShooterLane: true,
      isPhantom: false,
      trail: [],
      hitCount: 0,
      stuckTimer: 0,
    });

    this.lastHitLabel = `${BALL_DEFINITIONS[nextType].name.toUpperCase()} READY`;
    this.notifyUI();
  }

  public spawnPhantomBall(x: number, y: number, type: BallTypeId = 'quantum'): void {
    if (this.balls.length >= 4) return;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
    const speed = 520;
    this.balls.push({
      id: this.nextBallId++,
      type,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 10.5,
      inShooterLane: false,
      isPhantom: true,
      trail: [],
      hitCount: 0,
      stuckTimer: 0,
    });
    this.addFloatingText(x, y - 18, 'MULTIBALL!', '#00f5d4', 1.35);
    this.addShockwave(x, y, 95, '#00f5d4');
    this.sound.playJackpot();
  }

  public setFlipperPressed(side: 'left' | 'right', pressed: boolean): void {
    if (this.phase !== 'playing') return;
    if (this.isTilted) {
      this.flippers.forEach((f) => (f.isPressed = false));
      return;
    }

    let stateChanged = false;
    for (const f of this.flippers) {
      if (f.side === side && f.isPressed !== pressed) {
        f.isPressed = pressed;
        stateChanged = true;
      }
    }

    if (stateChanged) {
      this.sound.playFlipper(pressed);
      if (pressed) {
        this.cycleRolloverLanes(side === 'left' ? -1 : 1);

        // Check Tax Collector Boss modifier
        if (this.activeBossId === 'tax_collector' && this.balls.some((b) => !b.inShooterLane)) {
          this.ballChips = Math.max(0, this.ballChips - 25);
        }
      }
    }
  }

  private cycleRolloverLanes(dir: -1 | 1): void {
    if (this.rolloverLanes.length < 3) return;
    const states = this.rolloverLanes.map((l) => l.lit);
    const skillStates = this.rolloverLanes.map((l) => l.isSkillShot);
    const n = states.length;
    for (let i = 0; i < n; i++) {
      const src = (i - dir + n) % n;
      this.rolloverLanes[i].lit = states[src];
      this.rolloverLanes[i].isSkillShot = skillStates[src];
    }
  }

  public startPlungerCharge(): void {
    if (this.phase !== 'playing') return;
    const ballInShooter = this.balls.some((b) => b.inShooterLane);
    if (ballInShooter) {
      this.isChargingPlunger = true;
    }
  }

  public releasePlunger(): void {
    if (!this.isChargingPlunger) return;
    this.isChargingPlunger = false;

    const power = Math.max(0.35, this.plungerCharge);
    this.plungerCharge = 0;

    let launchedAny = false;
    for (const ball of this.balls) {
      if (ball.inShooterLane) {
        const def = BALL_DEFINITIONS[ball.type];
        // Launch speed between 820 and 1260 px/s with slight random variance
        const launchSpeed = (840 + power * 420 + (Math.random() - 0.5) * 35) * def.speedMultiplier;
        ball.vy = -launchSpeed;
        ball.vx = -12;
        launchedAny = true;
      }
    }

    if (launchedAny) {
      this.ballsLaunchedThisStage++;
      this.sound.playLaunch(power);

      // Twin-Core Injector Relic: spawn a free Phantom Ball on first launch of stage
      if (this.ballsLaunchedThisStage === 1 && this.hasRelic('twin_core')) {
        this.triggerRelic('twin_core', 'TWIN MULTIBALL!');
        setTimeout(() => {
          if (this.phase === 'playing') {
            this.spawnPhantomBall(241, 280, 'quantum');
          }
        }, 450);
      }
    }
  }

  public nudgeTable(dirX: -1 | 0 | 1 = 0, dirY: -1 | 0 = -1): void {
    if (this.phase !== 'playing' || this.isTilted || this.nudgeCooldown > 0) return;

    this.nudgeCooldown = 0.28;
    const tiltCost = this.hasRelic('chrono_stabilizer') ? 19 : 36;
    this.tiltMeter = Math.min(100, this.tiltMeter + tiltCost);
    this.screenShake = 9;

    const nx = dirX !== 0 ? dirX : Math.random() > 0.5 ? 1 : -1;
    for (const ball of this.balls) {
      if (!ball.inShooterLane) {
        ball.vx += nx * 135;
        ball.vy += dirY * 145;
      }
    }

    if (this.hasRelic('chrono_stabilizer')) {
      this.addMult(1.0, PLAYFIELD_CENTER_X, 600, 'GYRO +1 MULT');
      this.triggerRelic('chrono_stabilizer', '+1.0 MULT');
    }

    if (this.tiltMeter >= 100) {
      this.isTilted = true;
      this.flippers.forEach((f) => (f.isPressed = false));
      this.sound.playTiltWarning(true);
      this.addFloatingText(PLAYFIELD_CENTER_X, 420, 'TILT! FLIPPERS LOCKED', '#ff2a85', 1.5);
    } else {
      this.sound.playTiltWarning(false);
      this.addFloatingText(PLAYFIELD_CENTER_X, 660, 'NUDGE!', '#facc15', 1.0);
    }
  }

  public unstuckBalls(): void {
    for (const ball of this.balls) {
      if (ball.inShooterLane) {
        ball.x = 481;
        ball.y = 785;
        ball.vy = -1120;
      } else {
        ball.x = PLAYFIELD_CENTER_X + (Math.random() - 0.5) * 40;
        ball.y = 180;
        ball.vx = (Math.random() - 0.5) * 260;
        ball.vy = 200;
      }
    }
    this.screenShake = 5;
  }

  private scoreHit(
    ball: ActiveBall,
    rawChips: number,
    addedMult: number,
    label: string,
    x: number,
    y: number,
    color: string
  ): void {
    const ballDef = BALL_DEFINITIONS[ball.type];
    let chips = rawChips * ballDef.chipBonusMultiplier;

    // Gold Ball bonus: +8 chips per $1 owned
    if (ball.type === 'gold') {
      chips += this.gold * 8;
    }

    // Momentum Engine relic: +12x speed chips
    if (this.hasRelic('momentum_engine')) {
      const speed = Math.hypot(ball.vx, ball.vy);
      const speedBonus = Math.round((speed / 60) * 12);
      chips += speedBonus;
    }

    // Multiball Chromatic Lens relic: 2x chips & +0.3 Mult when 2+ balls active
    const activePlayfieldBalls = this.balls.filter((b) => !b.inShooterLane).length;
    if (activePlayfieldBalls >= 2 && this.hasRelic('neon_prism')) {
      chips *= 2.0;
      addedMult += 0.3;
      this.triggerRelic('neon_prism', '2X MULTIBALL!');
    }

    // Increment combo
    this.combo++;
    if (this.combo > this.maxComboThisStage) {
      this.maxComboThisStage = this.combo;
    }

    // Reset combo timer
    let comboDuration = this.maxComboTime;
    if (ball.type === 'superconductor') comboDuration *= 1.65;
    if (this.activeBossId === 'cryo_lock') comboDuration *= 0.55;
    this.comboTimer = comboDuration;

    // Small passive Mult increase every 3 combo hits
    if (this.combo % 3 === 0) {
      addedMult += 0.2;
    }

    // Combo Singularity relic: every 10x combo multiplies Mult by x1.35
    if (this.combo > 0 && this.combo % 10 === 0 && this.hasRelic('combo_singularity')) {
      this.ballMult = Number((this.ballMult * 1.35).toFixed(2));
      this.triggerRelic('combo_singularity', 'x1.35 MULT!');
      this.addFloatingText(x, y - 24, `${this.combo}x SINGULARITY!`, '#ff2a85', 1.3);
    }

    if (addedMult > 0) {
      this.ballMult = Number((this.ballMult + addedMult).toFixed(2));
    }

    chips = Math.round(chips);
    const totalPoints = Math.round(chips * this.ballMult);

    this.ballChips += chips;
    this.stageScore += totalPoints;
    this.lastHitLabel = label;
    this.lastHitPoints = totalPoints;

    // Ball-specific hit counters
    ball.hitCount++;
    if (ball.type === 'gold' && ball.hitCount % 9 === 0) {
      this.gold += 1;
      this.sound.playCoin();
      this.addFloatingText(ball.x, ball.y - 20, '+$1 GOLD BALL', '#facc15', 1.15);
    }
    if (ball.type === 'quantum' && ball.hitCount % 12 === 0 && !ball.isPhantom) {
      this.spawnPhantomBall(ball.x, ball.y, 'quantum');
    }

    const multSuffix = addedMult > 0 ? ` (+${addedMult.toFixed(1)}M)` : '';
    this.addFloatingText(x, y, `+${totalPoints.toLocaleString()}${multSuffix}`, color, 1.0);
  }

  private addMult(amount: number, x: number, y: number, label: string): void {
    this.ballMult = Number((this.ballMult + amount).toFixed(2));
    this.addFloatingText(x, y, label, '#ff2a85', 1.12);
  }

  public update(dt: number): void {
    const clampedDt = Math.min(dt, 0.033);

    // Decay visual effects and timers
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - clampedDt * 28);
    }
    if (this.screenFlash > 0) {
      this.screenFlash = Math.max(0, this.screenFlash - clampedDt * 2.5);
    }
    if (this.nudgeCooldown > 0) {
      this.nudgeCooldown = Math.max(0, this.nudgeCooldown - clampedDt);
    }
    if (this.nexusCooldown > 0) {
      this.nexusCooldown = Math.max(0, this.nexusCooldown - clampedDt);
    }

    for (const r of this.relics) {
      if (r.pulseTimer > 0) {
        r.pulseTimer = Math.max(0, r.pulseTimer - clampedDt);
      }
    }

    for (const b of this.bumpers) {
      if (b.hitAnim > 0) {
        b.hitAnim = Math.max(0, b.hitAnim - clampedDt * 5);
      }
    }

    for (const dtTarget of this.dropTargets) {
      if (dtTarget.hitAnim > 0) {
        dtTarget.hitAnim = Math.max(0, dtTarget.hitAnim - clampedDt * 4);
      }
    }

    for (const lane of this.rolloverLanes) {
      if (lane.cooldown > 0) {
        lane.cooldown = Math.max(0, lane.cooldown - clampedDt);
      }
    }

    // Update particles, shockwaves, floating texts, lightning
    this.updateEffects(clampedDt);

    if (this.phase !== 'playing') return;

    // Plunger charging
    if (this.isChargingPlunger) {
      this.plungerCharge = Math.min(1.0, this.plungerCharge + clampedDt * 1.15);
    }

    // Slowly cool down Tilt Meter if not tilted
    if (!this.isTilted && this.tiltMeter > 0) {
      this.tiltMeter = Math.max(0, this.tiltMeter - clampedDt * 7.5);
    }

    // Combo timer decay (only when at least 1 ball is out of shooter lane)
    const inPlay = this.balls.some((b) => !b.inShooterLane);
    if (inPlay && this.combo > 0) {
      this.comboTimer -= clampedDt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
        if (this.activeBossId === 'cryo_lock') {
          this.ballMult = Math.max(
            this.baseBallMult,
            Number((this.ballMult * 0.8).toFixed(2))
          );
          this.addFloatingText(PLAYFIELD_CENTER_X, 380, 'CRYO DECAY -20% MULT', '#67e8f9', 1.1);
        }
      }
    }

    // Glitch Matrix / Overlord magnetic anomaly pulse
    if (
      inPlay &&
      (this.activeBossId === 'glitch_matrix' || this.activeBossId === 'overlord')
    ) {
      this.glitchTimer += clampedDt;
      if (this.glitchTimer >= 5.2) {
        this.glitchTimer = 0;
        for (const ball of this.balls) {
          if (!ball.inShooterLane) {
            ball.vx += (Math.random() - 0.5) * 240;
            this.addShockwave(ball.x, ball.y, 45, '#4ade80');
          }
        }
        this.addFloatingText(PLAYFIELD_CENTER_X, 360, 'MAGNETIC FLUX!', '#4ade80', 1.05);
      }
    }

    // Update Spinners
    this.updateSpinners(clampedDt);

    // Sub-stepped physics simulation (10 substeps per frame for crisp zero-tunneling collisions)
    const subSteps = 10;
    const subDt = clampedDt / subSteps;
    for (let step = 0; step < subSteps; step++) {
      this.stepFlippers(subDt);
      this.stepBalls(subDt);
    }

    // Trail & Stuck detection
    for (const ball of this.balls) {
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 14) {
        ball.trail.shift();
      }

      if (!ball.inShooterLane) {
        const speed = Math.hypot(ball.vx, ball.vy);
        if (speed < 22) {
          ball.stuckTimer += clampedDt;
          if (ball.stuckTimer > 2.2) {
            ball.vy = -260;
            ball.vx = (Math.random() - 0.5) * 220;
            ball.stuckTimer = 0;
          }
        } else {
          ball.stuckTimer = 0;
        }
      }
    }

    // Check drained balls
    this.handleDrainedBalls();
  }

  private updateSpinners(dt: number): void {
    const boostLvl = this.upgradeLevels.spinner_boost;
    const damping = Math.max(1.2, 2.4 - boostLvl * 0.2);

    for (const sp of this.spinners) {
      if (Math.abs(sp.spinVelocity) > 0.2) {
        const deltaAngle = sp.spinVelocity * dt;
        sp.angle += deltaAngle;
        sp.accumulatedAngle += Math.abs(deltaAngle);
        sp.spinVelocity *= Math.exp(-damping * dt);

        // Every half-rotation (PI radians) awards spinner points!
        while (sp.accumulatedAngle >= Math.PI) {
          sp.accumulatedAngle -= Math.PI;
          const activeBall = this.balls[0];
          if (activeBall) {
            let spinChips = 30 + boostLvl * 35;
            let spinMult = 0;
            if (activeBall.type === 'tungsten') {
              spinChips *= 2.0;
            }
            if (this.hasRelic('hyper_spinner')) {
              spinChips += 55;
              spinMult += 0.25;
              this.triggerRelic('hyper_spinner', '+0.25 MULT');
            }
            this.scoreHit(
              activeBall,
              spinChips,
              spinMult,
              `${sp.label} SPIN`,
              sp.x,
              sp.y,
              '#00f5d4'
            );
            this.sound.playSpinner();
            this.chargeNexus(1);
          }
        }
      } else {
        sp.spinVelocity = 0;
      }
    }
  }

  private stepFlippers(dt: number): void {
    const flipSpeedUp = 28.0; // rad/s when snapping up
    const flipSpeedDown = 16.0; // rad/s when returning

    for (const f of this.flippers) {
      const target = f.isPressed && !this.isTilted ? f.activeAngle : f.restAngle;
      const diff = target - f.currentAngle;

      if (Math.abs(diff) < 0.004) {
        f.currentAngle = target;
        f.angularVelocity = 0;
      } else {
        const speed = f.isPressed ? flipSpeedUp : flipSpeedDown;
        const maxStep = speed * dt;
        const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
        f.currentAngle += step;
        f.angularVelocity = step / dt;
      }
    }
  }

  private stepBalls(dt: number): void {
    const isHeavyGravity =
      this.activeBossId === 'gravity_well' || this.activeBossId === 'overlord';
    const gravity = isHeavyGravity ? 840 : 620;

    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      const def = BALL_DEFINITIONS[ball.type];

      // Check if ball exited shooter lane at the top
      if (ball.inShooterLane && ball.x < 456 && ball.y < 245) {
        ball.inShooterLane = false;
      }

      // Apply gravity
      if (!ball.inShooterLane || ball.y < 785 || ball.vy < 0) {
        ball.vy += gravity * dt;
      }

      // Integrate velocity
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Keep resting ball on plunger in shooter lane
      if (ball.inShooterLane && ball.y > 790) {
        ball.y = 790;
        ball.x = 481;
        if (ball.vy > 0) ball.vy = 0;
        ball.vx = 0;
      }

      // 1. Collide with Walls & Slingshots
      for (const wall of this.walls) {
        if (wall.isOneWayGate && ball.inShooterLane) {
          continue; // Let ball exit shooter lane freely
        }
        this.collideBallWithSegment(ball, wall, def.restitution);
      }

      // 2. Collide with Drop Targets
      for (const target of this.dropTargets) {
        if (!target.isDown) {
          this.collideBallWithDropTarget(ball, target);
        }
      }

      // 3. Collide with Posts
      for (const post of this.posts) {
        this.collideBallWithCircle(ball, post.x, post.y, post.radius, post.restitution, false);
      }

      // 4. Collide with Pop Bumpers
      for (const bumper of this.bumpers) {
        this.collideBallWithBumper(ball, bumper);
      }

      // 5. Collide with Flippers
      for (const flipper of this.flippers) {
        this.collideBallWithFlipper(ball, flipper);
      }

      // 6. Check Sensors (Rollover lanes, Spinners, Nexus Reactor, Outlane Kickbacks)
      this.checkBallSensors(ball);

      // Clamp maximum velocity so physics stay crisp and controllable
      const maxSpeed = 1480 * def.speedMultiplier;
      const spd = Math.hypot(ball.vx, ball.vy);
      if (spd > maxSpeed) {
        const scale = maxSpeed / spd;
        ball.vx *= scale;
        ball.vy *= scale;
      }
    }

    // Ball-to-Ball Collisions (during Multiball!)
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        this.collideTwoBalls(this.balls[i], this.balls[j]);
      }
    }
  }

  private collideBallWithSegment(
    ball: ActiveBall,
    wall: WallSegment,
    ballRestitution: number
  ): void {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return;

    const t = Math.max(0, Math.min(1, ((ball.x - wall.x1) * dx + (ball.y - wall.y1) * dy) / lenSq));
    const closestX = wall.x1 + t * dx;
    const closestY = wall.y1 + t * dy;

    const distX = ball.x - closestX;
    const distY = ball.y - closestY;
    const distSq = distX * distX + distY * distY;
    const minDist = ball.radius + 2.5;

    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq) || 0.001;
      const nx = distX / dist;
      const ny = distY / dist;

      // Push ball out of wall
      const overlap = minDist - dist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        const e = (wall.restitution ?? 0.72) * ballRestitution;
        ball.vx -= (1 + e) * vn * nx;
        ball.vy -= (1 + e) * vn * ny;

        // Slingshot kick!
        if (wall.isSlingshot && !this.isTilted) {
          const kickSpeed = 620;
          ball.vx = nx * kickSpeed;
          ball.vy = ny * kickSpeed - 140;
          this.sound.playSlingshot();
          this.screenShake = 5;
          this.spawnParticles(closestX, closestY, '#ff2a85', 10);

          let chips = 55;
          let mult = 0;
          if (this.hasRelic('ricochet_prism')) {
            chips += 120;
            mult += 0.5;
            this.triggerRelic('ricochet_prism', '+120c / +0.5M');
          }
          this.scoreHit(ball, chips, mult, 'SLINGSHOT', closestX, closestY, '#ff2a85');
        }
      }
    }
  }

  private collideBallWithDropTarget(ball: ActiveBall, target: DropTarget): void {
    const dx = target.x2 - target.x1;
    const dy = target.y2 - target.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return;

    const t = Math.max(
      0,
      Math.min(1, ((ball.x - target.x1) * dx + (ball.y - target.y1) * dy) / lenSq)
    );
    const closestX = target.x1 + t * dx;
    const closestY = target.y1 + t * dy;

    const distX = ball.x - closestX;
    const distY = ball.y - closestY;
    const distSq = distX * distX + distY * distY;
    const minDist = ball.radius + 5;

    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq) || 0.001;
      const nx = distX / dist;
      const ny = distY / dist;

      ball.x += nx * (minDist - dist);
      ball.y += ny * (minDist - dist);

      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        ball.vx -= 1.85 * vn * nx;
        ball.vy -= 1.85 * vn * ny;
      }

      // Knock down target!
      target.isDown = true;
      target.hitAnim = 1.0;
      this.spawnParticles(closestX, closestY, target.color, 14);
      this.addShockwave(closestX, closestY, 38, target.color);

      const ampMult = 1 + this.upgradeLevels.target_amp * 0.45;
      let chips = Math.round(110 * ampMult);
      let addedMult = 0.5;

      if (ball.type === 'tungsten') {
        chips = Math.round(chips * 2.5);
        addedMult += 1.0;
      }

      if (this.hasRelic('sniper_optics')) {
        chips += 150;
        for (const b of this.bumpers) {
          b.baseChips += 5;
        }
        this.triggerRelic('sniper_optics', '+5 BUMPER CHIPS');
      }

      // Check if entire bank is down
      const bankTargets = this.dropTargets.filter((dt) => dt.bank === target.bank);
      const allDown = bankTargets.every((dt) => dt.isDown);

      if (allDown) {
        this.sound.playDropTarget(true);
        const bankBonus = Math.round(450 * ampMult);
        this.scoreHit(
          ball,
          chips + bankBonus,
          addedMult + 1.5,
          `${target.bank.toUpperCase()} BANK CLEARED!`,
          closestX,
          closestY,
          '#facc15'
        );
        this.chargeNexus(3);
        // Pop targets back up after a moment
        setTimeout(() => {
          bankTargets.forEach((dt) => {
            dt.isDown = false;
            dt.hitAnim = 1.0;
          });
        }, 550);
      } else {
        this.sound.playDropTarget(false);
        this.scoreHit(ball, chips, addedMult, 'DROP TARGET', closestX, closestY, target.color);
        this.chargeNexus(1);
      }
    }
  }

  private collideBallWithCircle(
    ball: ActiveBall,
    cx: number,
    cy: number,
    r: number,
    restitution: number,
    isBumper: boolean
  ): boolean {
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const distSq = dx * dx + dy * dy;
    const minDist = ball.radius + r;

    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq) || 0.001;
      const nx = dx / dist;
      const ny = dy / dist;

      ball.x = cx + nx * minDist;
      ball.y = cy + ny * minDist;

      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0 || isBumper) {
        const e = restitution * BALL_DEFINITIONS[ball.type].restitution;
        ball.vx -= (1 + e) * vn * nx;
        ball.vy -= (1 + e) * vn * ny;
      }
      return true;
    }
    return false;
  }

  private collideBallWithBumper(ball: ActiveBall, bumper: Bumper): void {
    const dx = ball.x - bumper.x;
    const dy = ball.y - bumper.y;
    const distSq = dx * dx + dy * dy;
    const minDist = ball.radius + bumper.radius;

    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq) || 0.001;
      const nx = dx / dist;
      const ny = dy / dist;

      // Push out
      ball.x = bumper.x + nx * (minDist + 1);
      ball.y = bumper.y + ny * (minDist + 1);

      // Strong radial bumper impulse!
      const def = BALL_DEFINITIONS[ball.type];
      const kickSpeed = (540 + this.upgradeLevels.bumper_power * 28) * def.restitution;
      ball.vx = nx * kickSpeed + (Math.random() - 0.5) * 40;
      ball.vy = ny * kickSpeed + (Math.random() - 0.5) * 40;

      if (bumper.hitAnim < 0.7) {
        bumper.hitAnim = 1.0;
        this.screenShake = Math.min(10, this.screenShake + 3.5);
        this.sound.playBumper(this.combo, bumper.level);
        this.spawnParticles(bumper.x + nx * bumper.radius, bumper.y + ny * bumper.radius, bumper.color, 12);
        this.addShockwave(bumper.x, bumper.y, bumper.radius * 2.1, bumper.color);

        let chips = bumper.baseChips;
        if (this.activeBossId === 'dampener') {
          chips = Math.round(chips * 0.5);
        }

        let addedMult = ball.type === 'plasma' ? 0.25 : 0;

        // Kinetic Dynamo relic: every 4th bumper hit grants +1.2 Mult
        const dynamo = this.getRelic('kinetic_dynamo');
        if (dynamo) {
          dynamo.counter++;
          if (dynamo.counter % 4 === 0) {
            addedMult += 1.2;
            this.triggerRelic('kinetic_dynamo', '+1.2 MULT!');
          }
        }

        // Golden Bumper relic: every 8th bumper hit mints +$1
        const midas = this.getRelic('golden_bumper');
        if (midas) {
          midas.counter++;
          if (midas.counter % 8 === 0) {
            this.gold += 1;
            this.sound.playCoin();
            this.triggerRelic('golden_bumper', '+$1 CREDIT!');
            this.addFloatingText(bumper.x, bumper.y - 26, '+$1 MIDAS', '#facc15', 1.2);
          }
        }

        this.scoreHit(ball, chips, addedMult, 'POP BUMPER', bumper.x, bumper.y - 10, bumper.color);
        this.chargeNexus(1);

        // Tesla Arc Coil (chain_lightning) relic: zap 2 other bumpers
        if (this.hasRelic('chain_lightning')) {
          const others = this.bumpers.filter((b) => b.id !== bumper.id).slice(0, 2);
          for (const other of others) {
            other.hitAnim = 0.75;
            this.lightningArcs.push({
              x1: bumper.x,
              y1: bumper.y,
              x2: other.x,
              y2: other.y,
              color: '#00f5d4',
              life: 0.22,
            });
            const arcChips = Math.round(other.baseChips * 0.75);
            this.stageScore += Math.round(arcChips * this.ballMult);
            this.ballChips += arcChips;
          }
          this.triggerRelic('chain_lightning', 'TESLA ARC!');
        }
      }
    }
  }

  private collideBallWithFlipper(ball: ActiveBall, flipper: Flipper): void {
    const cos = Math.cos(flipper.currentAngle);
    const sin = Math.sin(flipper.currentAngle);
    const tipX = flipper.pivotX + cos * flipper.length;
    const tipY = flipper.pivotY + sin * flipper.length;

    const dx = tipX - flipper.pivotX;
    const dy = tipY - flipper.pivotY;
    const lenSq = dx * dx + dy * dy;
    const t = Math.max(
      0,
      Math.min(1, ((ball.x - flipper.pivotX) * dx + (ball.y - flipper.pivotY) * dy) / lenSq)
    );

    const closestX = flipper.pivotX + t * dx;
    const closestY = flipper.pivotY + t * dy;
    const flipperR = flipper.baseRadius + t * (flipper.tipRadius - flipper.baseRadius);

    const distX = ball.x - closestX;
    const distY = ball.y - closestY;
    const distSq = distX * distX + distY * distY;
    const minDist = ball.radius + flipperR;

    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq) || 0.001;
      const nx = distX / dist;
      const ny = distY / dist;

      // Push ball outside flipper capsule
      ball.x = closestX + nx * (minDist + 0.5);
      ball.y = closestY + ny * (minDist + 0.5);

      // Compute velocity of the contact point on the rotating flipper
      const radiusFromPivot = t * flipper.length;
      // Tangent vector of rotation (-sin, cos)
      const surfVx = -sin * flipper.angularVelocity * radiusFromPivot;
      const surfVy = cos * flipper.angularVelocity * radiusFromPivot;

      const relVx = ball.vx - surfVx;
      const relVy = ball.vy - surfVy;
      const relVn = relVx * nx + relVy * ny;

      if (relVn < 0) {
        const def = BALL_DEFINITIONS[ball.type];
        const isSwingingUp =
          (flipper.side === 'left' && flipper.angularVelocity < -1) ||
          (flipper.side === 'right' && flipper.angularVelocity > 1);

        const restitution = isSwingingUp ? 0.85 : 0.45;
        ball.vx -= (1 + restitution) * relVn * nx;
        ball.vy -= (1 + restitution) * relVn * ny;

        if (isSwingingUp) {
          // Add strong upward/aimed impulse proportional to tip leverage
          const shotBoost = (360 + t * 380) * def.speedMultiplier;
          ball.vx += nx * shotBoost * 0.75 + surfVx * 0.35;
          ball.vy += ny * shotBoost - 160;
          this.spawnParticles(closestX, closestY, '#38bdf8', 8);

          // Superconductor ball: +0.4 Mult on active flipper strike
          if (ball.type === 'superconductor') {
            this.addMult(0.4, closestX, closestY - 15, '+0.4 SUPERCONDUCTOR');
          }

          // High-Voltage Coils relic: x1.12 Ball Mult on active flipper strike
          if (this.hasRelic('voltage_coils')) {
            this.ballMult = Number((this.ballMult * 1.12).toFixed(2));
            this.triggerRelic('voltage_coils', 'x1.12 MULT!');
            this.addFloatingText(closestX, closestY - 22, 'x1.12 COIL BOOST', '#00f5d4', 1.05);
          }
        }
      }
    }
  }

  private checkBallSensors(ball: ActiveBall): void {
    // 1. Top N - E - O Rollover Lanes
    for (const lane of this.rolloverLanes) {
      if (lane.cooldown <= 0) {
        const dist = Math.hypot(ball.x - lane.x, ball.y - lane.y);
        if (dist < lane.radius + ball.radius * 0.6) {
          lane.cooldown = 0.65;
          const wasLit = lane.lit;
          lane.lit = true;

          // Check Skill Shot!
          if (lane.isSkillShot) {
            lane.isSkillShot = false;
            let skillChips = 300;
            let skillMult = 1.5;
            if (this.hasRelic('afterburner')) {
              skillChips += 400;
              skillMult += 2.5;
              this.gold += 2;
              this.triggerRelic('afterburner', '+$2 & +2.5M!');
            } else {
              this.gold += 1;
            }
            this.sound.playJackpot();
            this.scoreHit(ball, skillChips, skillMult, 'SKILL SHOT! +$1', lane.x, lane.y, '#facc15');
            this.addShockwave(lane.x, lane.y, 70, '#facc15');
          } else {
            this.sound.playRollover(false);
            this.scoreHit(
              ball,
              wasLit ? 50 : 95,
              wasLit ? 0.1 : 0.3,
              `LANE [${lane.label}]`,
              lane.x,
              lane.y,
              '#38bdf8'
            );
          }

          // Check if all 3 N - E - O lanes are lit!
          if (this.rolloverLanes.every((l) => l.lit)) {
            this.sound.playRollover(true);
            let bonusChips = 350;
            if (this.hasRelic('wizard_coin')) {
              this.gold += 3;
              bonusChips += 200;
              this.triggerRelic('wizard_coin', '+$3 TOKEN!');
            }
            this.scoreHit(ball, bonusChips, 2.0, 'N-E-O COMPLETE! +2X MULT', 241, 120, '#00f5d4');
            this.addShockwave(241, 120, 95, '#00f5d4');
            this.chargeNexus(3);
            setTimeout(() => {
              this.rolloverLanes.forEach((l) => (l.lit = false));
            }, 450);
          }
        }
      }
    }

    // 2. Orbit Spinners
    for (const sp of this.spinners) {
      const dist = Math.hypot(ball.x - sp.x, ball.y - sp.y);
      if (dist < sp.radius) {
        const speed = Math.hypot(ball.vx, ball.vy);
        if (speed > 80 && Math.abs(sp.spinVelocity) < speed * 0.08) {
          sp.spinVelocity = (ball.vy < 0 ? 1 : -1) * Math.max(18, speed * 0.065);
        }
      }
    }

    // 3. Nexus Core Reactor Sensor at (241, 435)
    if (this.nexusCooldown <= 0) {
      const distNexus = Math.hypot(ball.x - PLAYFIELD_CENTER_X, ball.y - 435);
      if (distNexus < 30) {
        this.nexusCooldown = 0.85;
        if (this.nexusReady) {
          this.nexusReady = false;
          this.nexusCharge = 0;
          this.screenFlash = 0.8;
          this.screenShake = 14;
          let jackpotChips = 800;
          if (this.hasRelic('overdrive_core')) {
            jackpotChips += 1000;
            this.ballMult = Number((this.ballMult * 1.5).toFixed(2));
            this.triggerRelic('overdrive_core', 'x1.5 OVERDRIVE!');
          }
          this.scoreHit(
            ball,
            jackpotChips,
            2.0,
            'NEXUS JACKPOT + MULTIBALL!',
            PLAYFIELD_CENTER_X,
            435,
            '#00f5d4'
          );
          this.spawnPhantomBall(PLAYFIELD_CENTER_X, 415, ball.type);
        } else {
          this.chargeNexus(2);
          this.scoreHit(ball, 120, 0.4, 'NEXUS CORE CHARGED', PLAYFIELD_CENTER_X, 435, '#a855f7');
          this.addShockwave(PLAYFIELD_CENTER_X, 435, 55, '#a855f7');
        }
      }
    }

    // 4. Left & Right Outlane Laser Kickbacks
    if (
      this.leftKickbacksLeft > 0 &&
      ball.x >= 20 &&
      ball.x <= 64 &&
      ball.y >= 635 &&
      ball.y <= 675 &&
      ball.vy > 0
    ) {
      this.leftKickbacksLeft--;
      ball.vy = -880;
      ball.vx = 45;
      this.sound.playSlingshot();
      this.addShockwave(42, 650, 50, '#00f5d4');
      this.scoreHit(ball, 200, 0.5, 'LASER KICKBACK!', 42, 635, '#00f5d4');
    }

    if (
      this.rightKickbacksLeft > 0 &&
      ball.x >= 418 &&
      ball.x <= 462 &&
      ball.y >= 635 &&
      ball.y <= 675 &&
      ball.vy > 0
    ) {
      this.rightKickbacksLeft--;
      ball.vy = -880;
      ball.vx = -45;
      this.sound.playSlingshot();
      this.addShockwave(440, 650, 50, '#00f5d4');
      this.scoreHit(ball, 200, 0.5, 'LASER KICKBACK!', 440, 635, '#00f5d4');
    }
  }

  private chargeNexus(amount: number): void {
    if (this.nexusReady) return;
    const mult = this.hasRelic('overdrive_core') ? 2 : 1;
    this.nexusCharge = Math.min(this.nexusMaxCharge, this.nexusCharge + amount * mult);
    if (this.nexusCharge >= this.nexusMaxCharge) {
      this.nexusReady = true;
      this.sound.playRollover(true);
      this.addFloatingText(PLAYFIELD_CENTER_X, 405, 'NEXUS JACKPOT READY!', '#00f5d4', 1.25);
    }
  }

  private collideTwoBalls(b1: ActiveBall, b2: ActiveBall): void {
    if (b1.inShooterLane || b2.inShooterLane) return;
    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const distSq = dx * dx + dy * dy;
    const minDist = b1.radius + b2.radius;

    if (distSq < minDist * minDist && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = (minDist - dist) * 0.5;

      b1.x -= nx * overlap;
      b1.y -= ny * overlap;
      b2.x += nx * overlap;
      b2.y += ny * overlap;

      const kx = b1.vx - b2.vx;
      const ky = b1.vy - b2.vy;
      const p = 2 * (nx * kx + ny * ky) / 2;
      b1.vx -= p * nx;
      b1.vy -= p * ny;
      b2.vx += p * nx;
      b2.vy += p * ny;
    }
  }

  private handleDrainedBalls(): void {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (!ball.inShooterLane && ball.y > TABLE_HEIGHT - 18) {
        // Check Lazarus Shield (vampire_capacitor) relic save!
        if (!ball.isPhantom && !this.lazarusUsedThisStage && this.hasRelic('vampire_capacitor')) {
          this.lazarusUsedThisStage = true;
          ball.y = 740;
          ball.x = PLAYFIELD_CENTER_X;
          ball.vy = -960;
          ball.vx = (Math.random() - 0.5) * 180;
          this.ballMult = Number((this.ballMult * 1.4).toFixed(2));
          this.triggerRelic('vampire_capacitor', 'LAZARUS SAVE x1.4M!');
          this.addShockwave(PLAYFIELD_CENTER_X, 745, 95, '#ff2a85');
          this.addFloatingText(PLAYFIELD_CENTER_X, 700, 'LAZARUS MAGNET SAVE!', '#ff2a85', 1.35);
          this.sound.playJackpot();
          continue;
        }

        // Remove drained ball
        this.balls.splice(i, 1);
        this.sound.playDrain();
      }
    }

    // If all active balls have drained:
    if (this.balls.length === 0) {
      // Did we already beat the target score? Or do we have balls left?
      if (this.stageScore >= this.currentStage.targetScore) {
        this.completeStageVictory();
      } else if (this.ballQueue.length > 0) {
        this.spawnNextBallInShooter();
      } else {
        this.phase = 'gameover';
        this.notifyUI();
      }
    }
  }

  public cashOutEarlyIfTargetMet(): void {
    if (this.phase === 'playing' && this.stageScore >= this.currentStage.targetScore) {
      this.balls = [];
      this.completeStageVictory();
    }
  }

  private completeStageVictory(): void {
    const stage = this.currentStage;
    const baseReward = stage.rewardGold;
    const ballsRemainingBonus = this.ballQueue.length;
    const interestBonus = Math.min(5, Math.floor(this.gold / 5));
    const relicBonus = this.hasRelic('scrap_magnet') ? 3 : 0;
    const totalEarned = baseReward + ballsRemainingBonus + interestBonus + relicBonus;

    this.gold += totalEarned;
    this.sound.playJackpot();

    const isBoss = stage.type === 'boss';
    const anteCleared = isBoss && this.ante >= 8 && !this.endlessMode;

    this.lastCashout = {
      stageName: stage.name,
      stageScore: this.stageScore,
      targetScore: stage.targetScore,
      baseReward,
      ballsRemainingBonus,
      interestBonus,
      relicBonus,
      totalEarned,
      isBoss,
      anteCleared,
    };

    if (anteCleared) {
      this.phase = 'victory';
    } else {
      this.phase = 'cashout';
    }
    this.notifyUI();
  }

  public proceedFromCashoutToShop(): void {
    this.phase = 'shop';
    this.notifyUI();
  }

  public continueEndlessMode(): void {
    this.endlessMode = true;
    this.phase = 'cashout';
    this.notifyUI();
  }

  public leaveShopForNextStage(): void {
    if (this.stageIndex < 2) {
      this.stageIndex++;
    } else {
      this.ante++;
      this.stageIndex = 0;
      this.stages = generateAnteStages(this.ante);
    }
    this.phase = 'blind_select';
    this.buildTableGeometry();
    this.notifyUI();
  }

  // Visual helper methods
  public addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale: number = 1.0
  ): void {
    if (this.floatingTexts.length > 28) {
      this.floatingTexts.shift();
    }
    this.floatingTexts.push({
      x,
      y,
      vy: -52,
      text,
      color,
      scale,
      alpha: 1.0,
      life: 0,
      maxLife: 0.95,
    });
  }

  public spawnParticles(x: number, y: number, color: string, count: number = 10): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 140) {
        this.particles.shift();
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 2.5,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
      });
    }
  }

  public addShockwave(x: number, y: number, maxRadius: number, color: string): void {
    this.shockwaves.push({
      x,
      y,
      radius: 8,
      maxRadius,
      color,
      alpha: 0.9,
    });
  }

  private updateEffects(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      ft.y += ft.vy * dt;
      ft.alpha = Math.max(0, 1 - ft.life / ft.maxLife);
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dt * 10);
      sw.alpha -= dt * 2.2;
      if (sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      this.lightningArcs[i].life -= dt;
      if (this.lightningArcs[i].life <= 0) {
        this.lightningArcs.splice(i, 1);
      }
    }
  }

  public notifyUI(): void {
    if (this.onStateChange) {
      this.onStateChange();
    }
  }
}
