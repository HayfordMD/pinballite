export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary';

export type BallTypeId =
  | 'chrome'
  | 'plasma'
  | 'tungsten'
  | 'quantum'
  | 'gold'
  | 'superconductor';

export interface BallDefinition {
  id: BallTypeId;
  name: string;
  color: string;
  glowColor: string;
  secondaryColor: string;
  cost: number;
  mass: number;
  restitution: number;
  speedMultiplier: number;
  chipBonusMultiplier: number;
  description: string;
  badge: string;
}

export interface RelicDefinition {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  cost: number;
  description: string;
}

export interface RelicInstance {
  def: RelicDefinition;
  pulseTimer: number;
  lastTriggerText: string;
  counter: number;
}

export interface TableUpgradeDefinition {
  id: string;
  name: string;
  icon: string;
  baseCost: number;
  maxLevel: number;
  description: string;
}

export type BlindType = 'small' | 'big' | 'boss';

export interface BossModifier {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  icon: string;
}

export interface BlindStage {
  ante: number;
  type: BlindType;
  name: string;
  targetScore: number;
  rewardGold: number;
  boss?: BossModifier;
  skipTagTitle?: string;
  skipTagDesc?: string;
  skipTagId?: string;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface ActiveBall {
  id: number;
  type: BallTypeId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  inShooterLane: boolean;
  isPhantom: boolean;
  trail: Vec2[];
  hitCount: number;
  stuckTimer: number;
}

export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  restitution?: number;
  color?: string;
  isSlingshot?: 'left' | 'right';
  isOneWayGate?: boolean;
}

export interface Bumper {
  id: string;
  x: number;
  y: number;
  radius: number;
  baseChips: number;
  color: string;
  hitAnim: number;
  level: number;
}

export interface Post {
  x: number;
  y: number;
  radius: number;
  restitution: number;
  color: string;
}

export interface DropTarget {
  id: string;
  bank: 'left' | 'right';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isDown: boolean;
  hitAnim: number;
  color: string;
}

export interface RolloverLane {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  lit: boolean;
  cooldown: number;
  isSkillShot: boolean;
}

export interface SpinnerGate {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  angle: number;
  spinVelocity: number;
  accumulatedAngle: number;
  color: string;
}

export interface Flipper {
  id: 'left' | 'right' | 'upperLeft';
  side: 'left' | 'right';
  pivotX: number;
  pivotY: number;
  length: number;
  baseRadius: number;
  tipRadius: number;
  restAngle: number;
  activeAngle: number;
  currentAngle: number;
  angularVelocity: number;
  isPressed: boolean;
  enabled: boolean;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  subtext?: string;
  color: string;
  scale: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

export interface LightningArc {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
}
