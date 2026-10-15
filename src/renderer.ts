import { BALL_DEFINITIONS } from './content';
import { PLAYFIELD_CENTER_X, PinballGame, TABLE_HEIGHT, TABLE_WIDTH } from './physics';

export class TableRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D Canvas context not available');
    this.ctx = ctx;
    this.resize();
  }

  public resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = TABLE_WIDTH * dpr;
    this.canvas.height = TABLE_HEIGHT * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  public render(game: PinballGame, dt: number): void {
    this.animTime += dt;
    const ctx = this.ctx;

    ctx.save();

    // Screen Shake offset
    if (game.screenShake > 0.2) {
      const sx = (Math.random() - 0.5) * game.screenShake * 1.4;
      const sy = (Math.random() - 0.5) * game.screenShake * 1.4;
      ctx.translate(sx, sy);
    }

    // 1. Background & Cyber Grid
    this.drawBackground(ctx, game);

    // 2. Playfield Decals (Nexus Core, Lane Arrows, Kickback Lasers)
    this.drawPlayfieldDecals(ctx, game);

    // 3. Rollover Lanes (N - E - O)
    this.drawRolloverLanes(ctx, game);

    // 4. Spinners
    this.drawSpinners(ctx, game);

    // 5. Drop Targets
    this.drawDropTargets(ctx, game);

    // 6. Walls & Slingshots
    this.drawWalls(ctx, game);

    // 7. Posts
    this.drawPosts(ctx, game);

    // 8. Pop Bumpers
    this.drawBumpers(ctx, game);

    // 9. Plunger Assembly
    this.drawPlunger(ctx, game);

    // 10. Flippers
    this.drawFlippers(ctx, game);

    // 11. Shockwaves & Lightning Arcs
    this.drawShockwavesAndLightning(ctx, game);

    // 12. Balls & Trails
    this.drawBalls(ctx, game);

    // 13. Particles
    this.drawParticles(ctx, game);

    // 14. Blackout Boss Darkness Overlay (if active)
    if (game.activeBossId === 'blackout' && game.phase === 'playing') {
      this.drawBlackoutMask(ctx, game);
    }

    // 15. Floating Score Popups
    this.drawFloatingTexts(ctx, game);

    // 16. Screen Flash Overlay (Jackpot / Multiball)
    if (game.screenFlash > 0) {
      ctx.fillStyle = `rgba(0, 245, 212, ${game.screenFlash * 0.25})`;
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
    }

    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    const grad = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT);
    grad.addColorStop(0, '#060714');
    grad.addColorStop(0.5, '#0b0e26');
    grad.addColorStop(1, '#050611');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // Subtle synthwave grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.055)';
    ctx.lineWidth = 1;
    for (let x = 20; x <= 500; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, TABLE_HEIGHT);
      ctx.stroke();
    }
    for (let y = 40; y <= TABLE_HEIGHT; y += 32) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(500, y);
      ctx.stroke();
    }

    // Table Center Watermark Telemetry
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.11)';
    ctx.font = '900 22px "Orbitron", "Rajdhani", system-ui, sans-serif';
    ctx.fillText('PINBALLITE // OVERDRIVE', PLAYFIELD_CENTER_X, 515);

    const progress = Math.min(1, game.stageScore / Math.max(1, game.currentStage.targetScore));
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = progress >= 1 ? 'rgba(0, 245, 212, 0.35)' : 'rgba(148, 163, 184, 0.22)';
    ctx.fillText(
      progress >= 1
        ? '★ STAGE TARGET CLEARED - BONUS GOLD ACTIVE ★'
        : `TARGET PROGRESS: ${Math.floor(progress * 100)}%`,
      PLAYFIELD_CENTER_X,
      536
    );
    ctx.restore();
  }

  private drawPlayfieldDecals(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    const cx = PLAYFIELD_CENTER_X;
    const cy = 435;

    // Nexus Reactor Core
    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(this.animTime * 6);
    const coreColor = game.nexusReady ? '#00f5d4' : '#a855f7';

    // Outer ambient glow
    const radGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 44);
    radGrad.addColorStop(
      0,
      game.nexusReady ? 'rgba(0, 245, 212, 0.38)' : 'rgba(168, 85, 247, 0.22)'
    );
    radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fill();

    // 10 Charge Segments around Nexus Core
    const segments = game.nexusMaxCharge;
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2 - Math.PI / 2 + 0.06;
      const a2 = ((i + 1) / segments) * Math.PI * 2 - Math.PI / 2 - 0.06;
      ctx.beginPath();
      ctx.arc(cx, cy, 31, a1, a2);
      const isCharged = i < game.nexusCharge || game.nexusReady;
      ctx.strokeStyle = isCharged ? coreColor : 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = isCharged ? 4.5 : 3;
      ctx.stroke();
    }

    // Inner rotating ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.animTime * (game.nexusReady ? 3.2 : 1.1));
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = '800 9px "JetBrains Mono", monospace';
    ctx.fillStyle = game.nexusReady ? '#00f5d4' : '#e2e8f0';
    ctx.fillText(game.nexusReady ? 'JACKPOT!' : 'NEXUS', cx, cy + 3);
    ctx.font = '700 8px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
    ctx.fillText(
      game.nexusReady ? `SHOOT FOR MULTIBALL` : `${game.nexusCharge}/${game.nexusMaxCharge}`,
      cx,
      cy + 45
    );
    ctx.restore();

    // Outlane Laser Kickbacks
    if (game.leftKickbacksLeft > 0) {
      this.drawKickbackLaser(ctx, 22, 62, 650, game.leftKickbacksLeft, pulse);
    }
    if (game.rightKickbacksLeft > 0) {
      this.drawKickbackLaser(ctx, 420, 460, 650, game.rightKickbacksLeft, pulse);
    }

    // Lazarus Shield indicator across drain if available
    if (game.hasRelic('vampire_capacitor') && !game.lazarusUsedThisStage) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 42, 133, ${0.45 + pulse * 0.35})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(165, 775);
      ctx.lineTo(317, 775);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 42, 133, 0.75)';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LAZARUS MAGNET ARMED', PLAYFIELD_CENTER_X, 792);
      ctx.restore();
    }
  }

  private drawKickbackLaser(
    ctx: CanvasRenderingContext2D,
    x1: number,
    x2: number,
    y: number,
    charges: number,
    pulse: number
  ): void {
    ctx.save();
    ctx.shadowColor = '#00f5d4';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(0, 245, 212, ${0.65 + pulse * 0.35})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    ctx.fillStyle = '#00f5d4';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`LASER x${charges}`, (x1 + x2) / 2, y - 7);
    ctx.restore();
  }

  private drawRolloverLanes(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    for (const lane of game.rolloverLanes) {
      ctx.save();
      if (lane.isSkillShot) {
        const pulse = 0.5 + 0.5 * Math.sin(this.animTime * 10);
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.6 + pulse * 0.4})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(lane.x, lane.y, lane.radius + 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.font = '800 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SKILL', lane.x, lane.y - 22);
      }

      ctx.beginPath();
      ctx.arc(lane.x, lane.y, lane.radius, 0, Math.PI * 2);
      ctx.fillStyle = lane.lit ? 'rgba(0, 245, 212, 0.28)' : 'rgba(15, 23, 42, 0.7)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = lane.lit ? '#00f5d4' : 'rgba(56, 189, 248, 0.35)';
      ctx.stroke();

      ctx.fillStyle = lane.lit ? '#00f5d4' : '#64748b';
      ctx.font = '800 13px "Orbitron", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lane.label, lane.x, lane.y + 1);
      ctx.restore();
    }
  }

  private drawSpinners(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    for (const sp of game.spinners) {
      ctx.save();
      ctx.translate(sp.x, sp.y);

      // Outer housing ring
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, sp.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating turbine bar
      const bladeHalfWidth = sp.radius * Math.cos(sp.angle);
      ctx.strokeStyle = Math.abs(sp.spinVelocity) > 2 ? '#00f5d4' : '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-bladeHalfWidth, 0);
      ctx.lineTo(bladeHalfWidth, 0);
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawDropTargets(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    for (const dt of game.dropTargets) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(dt.x1, dt.y1);
      ctx.lineTo(dt.x2, dt.y2);

      if (dt.isDown) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.shadowColor = dt.color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = dt.color;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawWalls(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const w of game.walls) {
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);

      if (w.isOneWayGate) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (w.isSlingshot) {
        ctx.shadowColor = '#ff2a85';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ff2a85';
        ctx.lineWidth = 4.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = w.color || '#00f5d4';
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawPosts(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    for (const p of game.posts) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = p.color;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBumpers(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    for (const b of game.bumpers) {
      ctx.save();
      const scale = 1 + b.hitAnim * 0.22;
      const r = b.radius * scale;

      // Outer neon aura
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14 + b.hitAnim * 16;

      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fillStyle = b.hitAnim > 0.2 ? b.color : '#0f172a';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = b.color;
      ctx.stroke();

      // Inner ring
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 0.68, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Value readout inside bumper
      const displayChips =
        game.activeBossId === 'dampener' ? Math.round(b.baseChips * 0.5) : b.baseChips;
      ctx.fillStyle = b.hitAnim > 0.2 ? '#090d16' : '#f8fafc';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${displayChips}`, b.x, b.y + 1);
      ctx.restore();
    }
  }

  private drawPlunger(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    const laneCenterX = 481;
    const baseY = 824;
    const compress = game.plungerCharge * 24;
    const headY = 802 + compress;

    ctx.save();
    // Spring coils
    ctx.strokeStyle = game.isChargingPlunger ? '#ff2a85' : '#facc15';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const coils = 5;
    for (let i = 0; i <= coils; i++) {
      const y = headY + ((baseY - headY) * i) / coils;
      const x = laneCenterX + (i % 2 === 0 ? -9 : 9);
      if (i === 0) ctx.moveTo(laneCenterX - 11, headY);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Plunger head plate
    ctx.fillStyle = game.isChargingPlunger ? '#ff2a85' : '#facc15';
    ctx.fillRect(laneCenterX - 13, headY - 4, 26, 6);
    ctx.restore();
  }

  private drawFlippers(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    for (const f of game.flippers) {
      ctx.save();
      ctx.translate(f.pivotX, f.pivotY);
      ctx.rotate(f.currentAngle);

      const color = game.isTilted ? '#64748b' : f.isPressed ? '#00f5d4' : '#38bdf8';
      ctx.shadowColor = color;
      ctx.shadowBlur = f.isPressed ? 14 : 6;

      // Capsule path from (0,0) with radius baseRadius to (length, 0) with radius tipRadius
      ctx.beginPath();
      ctx.arc(0, 0, f.baseRadius, Math.PI / 2, (Math.PI * 3) / 2);
      ctx.arc(f.length, 0, f.tipRadius, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();

      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.stroke();

      // Pivot core dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private drawBalls(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    for (const ball of game.balls) {
      const def = BALL_DEFINITIONS[ball.type];

      // Draw motion trail
      for (let i = 0; i < ball.trail.length; i++) {
        const pt = ball.trail[i];
        const ratio = (i + 1) / ball.trail.length;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, ball.radius * ratio * 0.82, 0, Math.PI * 2);
        ctx.fillStyle = def.glowColor;
        ctx.globalAlpha = ratio * 0.32;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Draw Ball Sphere
      ctx.save();
      ctx.shadowColor = def.glowColor;
      ctx.shadowBlur = 14;

      const grad = ctx.createRadialGradient(
        ball.x - 3.5,
        ball.y - 3.5,
        2,
        ball.x,
        ball.y,
        ball.radius
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.55, def.color);
      grad.addColorStop(1, def.secondaryColor);

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      if (ball.isPhantom) {
        ctx.strokeStyle = '#00f5d4';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawShockwavesAndLightning(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    for (const sw of game.shockwaves) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    for (const arc of game.lightningArcs) {
      ctx.save();
      ctx.strokeStyle = arc.color;
      ctx.shadowColor = arc.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      const midX = (arc.x1 + arc.x2) / 2 + (Math.random() - 0.5) * 26;
      const midY = (arc.y1 + arc.y2) / 2 + (Math.random() - 0.5) * 26;
      ctx.lineTo(midX, midY);
      ctx.lineTo(arc.x2, arc.y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    for (const p of game.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBlackoutMask(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 4, 12, 0.82)';
    ctx.beginPath();
    ctx.rect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
    for (const ball of game.balls) {
      ctx.moveTo(ball.x + 88, ball.y);
      ctx.arc(ball.x, ball.y, 88, 0, Math.PI * 2, true);
    }
    ctx.moveTo(PLAYFIELD_CENTER_X + 145, 730);
    ctx.arc(PLAYFIELD_CENTER_X, 730, 145, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.restore();
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D, game: PinballGame): void {
    for (const ft of game.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `900 ${Math.round(13 * ft.scale)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}
