import {
  BallDefinition,
  BallTypeId,
  BlindStage,
  BossModifier,
  RelicDefinition,
  TableUpgradeDefinition,
} from './types';

export const BALL_DEFINITIONS: Record<BallTypeId, BallDefinition> = {
  chrome: {
    id: 'chrome',
    name: 'Chrome Standard',
    color: '#e2e8f0',
    glowColor: '#38bdf8',
    secondaryColor: '#94a3b8',
    cost: 4,
    mass: 1.0,
    restitution: 1.0,
    speedMultiplier: 1.0,
    chipBonusMultiplier: 1.0,
    badge: 'STD',
    description: 'Balanced arcade steel sphere. Reliable trajectory and bounce.',
  },
  plasma: {
    id: 'plasma',
    name: 'Plasma Core',
    color: '#ff2a85',
    glowColor: '#ff2a85',
    secondaryColor: '#ff94c2',
    cost: 6,
    mass: 0.92,
    restitution: 1.12,
    speedMultiplier: 1.08,
    chipBonusMultiplier: 1.35,
    badge: '+35% CHIPS',
    description: '+35% Base Chips on all hits and +0.25 Mult on every Pop Bumper hit.',
  },
  tungsten: {
    id: 'tungsten',
    name: 'Heavy Tungsten',
    color: '#a855f7',
    glowColor: '#c084fc',
    secondaryColor: '#6b21a8',
    cost: 6,
    mass: 1.45,
    restitution: 0.9,
    speedMultiplier: 0.96,
    chipBonusMultiplier: 1.25,
    badge: '2x TARGETS',
    description: 'High-mass juggernaut. Deals 2.5x Chips & +1.0 Mult on Drop Targets and Spinners.',
  },
  quantum: {
    id: 'quantum',
    name: 'Quantum Echo',
    color: '#00f5d4',
    glowColor: '#00f5d4',
    secondaryColor: '#ccfbf1',
    cost: 8,
    mass: 0.95,
    restitution: 1.08,
    speedMultiplier: 1.05,
    chipBonusMultiplier: 1.15,
    badge: 'PHANTOM SPLIT',
    description: 'Every 12th hit or Nexus Core strike spawns a temporary Phantom Ball for Multiball chaos!',
  },
  gold: {
    id: 'gold',
    name: 'Aurum Bullion',
    color: '#facc15',
    glowColor: '#eab308',
    secondaryColor: '#fef08a',
    cost: 7,
    mass: 1.1,
    restitution: 1.02,
    speedMultiplier: 1.0,
    chipBonusMultiplier: 1.1,
    badge: '$$ MINTER',
    description: 'Every 9 bumper/target hits mints +$1 immediately, plus +8 Chips per $1 owned.',
  },
  superconductor: {
    id: 'superconductor',
    name: 'Superconductor',
    color: '#38bdf8',
    glowColor: '#00e5ff',
    secondaryColor: '#e0f2fe',
    cost: 8,
    mass: 0.9,
    restitution: 1.18,
    speedMultiplier: 1.16,
    chipBonusMultiplier: 1.2,
    badge: 'HYPER COMBO',
    description: 'Combo timer decays 60% slower. Every Flipper strike grants +0.4 Mult.',
  },
};

export const RELIC_DEFINITIONS: RelicDefinition[] = [
  {
    id: 'kinetic_dynamo',
    name: 'Kinetic Dynamo',
    icon: '⚡',
    rarity: 'Common',
    cost: 5,
    description: 'Every 4th Pop Bumper hit grants +1.2 Mult for the current ball.',
  },
  {
    id: 'ricochet_prism',
    name: 'Ricochet Prism',
    icon: '💠',
    rarity: 'Common',
    cost: 4,
    description: 'Slingshot kicks grant +120 Chips and +0.5 Mult.',
  },
  {
    id: 'wizard_coin',
    name: 'Arcade Token',
    icon: '🪙',
    rarity: 'Common',
    cost: 5,
    description: 'Completing the N-E-O top rollover lanes immediately awards +$3 and +200 Chips.',
  },
  {
    id: 'hyper_spinner',
    name: 'Turbine Overclock',
    icon: '🌀',
    rarity: 'Uncommon',
    cost: 6,
    description: 'Orbit Spinner revolutions grant +55 extra Chips and +0.25 Mult per spin.',
  },
  {
    id: 'sniper_optics',
    name: 'Sniper Optics',
    icon: '🎯',
    rarity: 'Uncommon',
    cost: 6,
    description: 'Knocking down any Drop Target grants +150 Chips and permanently adds +5 Chips to all Bumpers.',
  },
  {
    id: 'voltage_coils',
    name: 'High-Voltage Coils',
    icon: '🔋',
    rarity: 'Rare',
    cost: 8,
    description: 'Every time a ball strikes an active Flipper, multiply current Ball Mult by x1.12.',
  },
  {
    id: 'chain_lightning',
    name: 'Tesla Arc Coil',
    icon: '🌩️',
    rarity: 'Rare',
    cost: 8,
    description: 'Hitting a Pop Bumper zaps 2 nearby Bumpers with lightning for +75% of their Chips!',
  },
  {
    id: 'twin_core',
    name: 'Twin-Core Injector',
    icon: '♊',
    rarity: 'Legendary',
    cost: 10,
    description: 'Launching your FIRST ball each stage automatically spawns a Phantom Multiball!',
  },
  {
    id: 'golden_bumper',
    name: 'Midas Bumper',
    icon: '👑',
    rarity: 'Common',
    cost: 5,
    description: 'Every 8th Pop Bumper hit mints +$1 credit.',
  },
  {
    id: 'vampire_capacitor',
    name: 'Lazarus Shield',
    icon: '🛡️',
    rarity: 'Rare',
    cost: 8,
    description: 'First ball that would drain each stage is magnetically saved back into play with x1.4 Mult!',
  },
  {
    id: 'momentum_engine',
    name: 'Velocity Vector',
    icon: '🚀',
    rarity: 'Uncommon',
    cost: 6,
    description: 'Fast hits deal bonus Chips equal to 12x the ball speed.',
  },
  {
    id: 'combo_singularity',
    name: 'Combo Singularity',
    icon: '🌌',
    rarity: 'Legendary',
    cost: 10,
    description: 'Every 10x Combo milestone multiplies your current Ball Mult by x1.35!',
  },
  {
    id: 'midas_plunger',
    name: 'Bullion Capacitor',
    icon: '💎',
    rarity: 'Uncommon',
    cost: 7,
    description: 'Each ball starts with +0.5 Base Mult for every $5 you currently hold.',
  },
  {
    id: 'afterburner',
    name: 'Skill Shot Thruster',
    icon: '🔥',
    rarity: 'Common',
    cost: 4,
    description: 'Hitting the flashing Skill Shot lane at launch grants +400 Chips, +2.5 Mult, and +$2.',
  },
  {
    id: 'overdrive_core',
    name: 'Nexus Amplifier',
    icon: '☢️',
    rarity: 'Uncommon',
    cost: 7,
    description: 'Nexus Reactor charges 2x faster and Jackpot awards x1.5 Mult + 1,000 Base Chips.',
  },
  {
    id: 'scrap_magnet',
    name: 'Salvage Drone',
    icon: '🧲',
    rarity: 'Common',
    cost: 5,
    description: 'Earn an extra +$3 at the end of every victorious stage.',
  },
  {
    id: 'neon_prism',
    name: 'Chromatic Lens',
    icon: '🌈',
    rarity: 'Rare',
    cost: 8,
    description: 'When 2 or more balls are in play (Multiball), all hits award 2x Chips and +0.3 Mult!',
  },
  {
    id: 'chrono_stabilizer',
    name: 'Gyro Stabilizer',
    icon: '🧭',
    rarity: 'Common',
    cost: 4,
    description: 'Reduces Tilt build-up by 50% and grants +1.0 Mult every time you Nudge the table.',
  },
];

export const TABLE_UPGRADES: TableUpgradeDefinition[] = [
  {
    id: 'bumper_power',
    name: 'Bumper Overclock',
    icon: '💥',
    baseCost: 4,
    maxLevel: 8,
    description: 'Upgrades all Pop Bumpers (+30 Base Chips & stronger impulse per level).',
  },
  {
    id: 'extra_bumpers',
    name: 'Extra Bumper Nodes',
    icon: '🔮',
    baseCost: 6,
    maxLevel: 2,
    description: 'Installs additional neon Pop Bumpers in the mid-playfield cluster.',
  },
  {
    id: 'target_amp',
    name: 'Drop Bank Matrix',
    icon: '🎛️',
    baseCost: 5,
    maxLevel: 6,
    description: 'Increases Drop Target hit & bank completion Chips by +45% per level.',
  },
  {
    id: 'spinner_boost',
    name: 'Orbit Turbines',
    icon: '🌪️',
    baseCost: 5,
    maxLevel: 6,
    description: 'Spinners spin longer and award +35 Chips per revolution per level.',
  },
  {
    id: 'left_kickback',
    name: 'Left Outlane Laser',
    icon: '⚡',
    baseCost: 5,
    maxLevel: 3,
    description: 'Arms a laser kickback in the Left Outlane (1 charge per level each stage).',
  },
  {
    id: 'right_kickback',
    name: 'Right Outlane Laser',
    icon: '⚡',
    baseCost: 5,
    maxLevel: 3,
    description: 'Arms a laser kickback in the Right Outlane (1 charge per level each stage).',
  },
  {
    id: 'center_post',
    name: 'Center Plasma Post',
    icon: '🛡️',
    baseCost: 6,
    maxLevel: 3,
    description: 'Raises a protective plasma post between the main flippers (wider shield per level).',
  },
  {
    id: 'upper_flipper',
    name: 'Upper Cyber Flipper',
    icon: '🦾',
    baseCost: 7,
    maxLevel: 1,
    description: 'Installs a synchronized Upper-Left mini-flipper for cross-table shots & Nexus hits!',
  },
];

export const BOSS_MODIFIERS: BossModifier[] = [
  {
    id: 'gravity_well',
    name: 'THE GRAVITY WELL',
    subtitle: 'Gravity increased by +35%. Balls drop faster & hit with heavy momentum.',
    color: '#c084fc',
    icon: '🕳️',
  },
  {
    id: 'dampener',
    name: 'THE DAMPENER',
    subtitle: 'Pop Bumpers yield -50% Base Chips. Use Drop Targets, Spinners & Lanes!',
    color: '#fb7185',
    icon: '🔇',
  },
  {
    id: 'emp_drain',
    name: 'THE EMP DRAIN',
    subtitle: 'Outlane Kickbacks are jammed and main Flippers are 15% shorter.',
    color: '#38bdf8',
    icon: '🌩️',
  },
  {
    id: 'cryo_lock',
    name: 'THE CRYO LOCK',
    subtitle: 'Combo timer runs 2x faster; losing your Combo decays 20% of current Ball Mult.',
    color: '#67e8f9',
    icon: '❄️',
  },
  {
    id: 'tax_collector',
    name: 'THE AUDITOR',
    subtitle: 'Each Flipper press deducts 25 Chips from Ball Chips (hold shots & aim carefully!).',
    color: '#facc15',
    icon: '⚖️',
  },
  {
    id: 'glitch_matrix',
    name: 'THE GLITCH MATRIX',
    subtitle: 'Magnetic anomalies periodically nudge ball trajectories in mid-table.',
    color: '#4ade80',
    icon: '👾',
  },
  {
    id: 'blackout',
    name: 'THE ECLIPSE',
    subtitle: 'Mid-table lights are dimmed; only active balls and lit targets illuminate the board.',
    color: '#818cf8',
    icon: '🌑',
  },
  {
    id: 'overlord',
    name: 'OMEGA CORE OVERLORD',
    subtitle: 'Final Ante Boss: High gravity + magnetic flux + massive score threshold!',
    color: '#ff2a85',
    icon: '👁️',
  },
];

const ANTE_BASE_SCORES = [
  1500,    // Ante 1
  4200,    // Ante 2
  10500,   // Ante 3
  25000,   // Ante 4
  60000,   // Ante 5
  140000,  // Ante 6
  320000,  // Ante 7
  750000,  // Ante 8
];

const SKIP_TAGS = [
  { id: 'gold_cache', title: 'Bounty Tag', desc: 'Instant +$7 Credits' },
  { id: 'free_relic', title: 'Relic Tag', desc: 'Gain a random Uncommon/Rare Relic' },
  { id: 'ball_pack', title: 'Arsenal Tag', desc: 'Add a random Special Ball to your queue' },
  { id: 'overclock_tag', title: 'Overclock Tag', desc: 'Upgrade Bumpers & Spinners by +1 Lv' },
];

export function generateAnteStages(ante: number): [BlindStage, BlindStage, BlindStage] {
  const base =
    ante <= ANTE_BASE_SCORES.length
      ? ANTE_BASE_SCORES[ante - 1]
      : Math.round(750000 * Math.pow(2.4, ante - 8));

  const bossIndex = ante === 8 ? 7 : (ante - 1) % (BOSS_MODIFIERS.length - 1);
  const boss = BOSS_MODIFIERS[bossIndex];

  const tag1 = SKIP_TAGS[(ante * 2) % SKIP_TAGS.length];
  const tag2 = SKIP_TAGS[(ante * 2 + 1) % SKIP_TAGS.length];

  return [
    {
      ante,
      type: 'small',
      name: `Sector ${ante}-A // Small Blind`,
      targetScore: Math.round(base),
      rewardGold: 4,
      skipTagId: tag1.id,
      skipTagTitle: tag1.title,
      skipTagDesc: tag1.desc,
    },
    {
      ante,
      type: 'big',
      name: `Sector ${ante}-B // Big Blind`,
      targetScore: Math.round(base * 1.5),
      rewardGold: 5,
      skipTagId: tag2.id,
      skipTagTitle: tag2.title,
      skipTagDesc: tag2.desc,
    },
    {
      ante,
      type: 'boss',
      name: `Sector ${ante}-Ω // ${boss.name}`,
      targetScore: Math.round(base * 2.2),
      rewardGold: 7,
      boss,
    },
  ];
}
