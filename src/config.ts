/** Game layout & physics constants (logical design resolution) */

export const DESIGN_W = 960;
export const DESIGN_H = 640;

/** Toy cabinet / frame */
export const CABINET = {
  margin: 24,
  frameColor: 0xc4a35a,
  frameDark: 0x8b6914,
  frameLight: 0xe8d5a3,
  bodyColor: 0xd4a84b,
  bodyShadow: 0x9a7220,
  plasticBeige: 0xe8c97a,
};

/** Water tank (inner play area) */
export const TANK = {
  x: 180,
  y: 70,
  width: 600,
  height: 420,
  wallThickness: 10,
  waterColor: 0x3a9ec9,
  waterAlpha: 0.35,
  bgColor: 0x1a5f7a,
  borderColor: 0xb8d4e0,
  borderHighlight: 0xffffff,
  borderShadow: 0x4a6a78,
};

/** Pegs (vertical pins to ring onto) */
export const PEGS = [
  { x: 380, y: 280, height: 160, radius: 7 },
  { x: 580, y: 280, height: 160, radius: 7 },
];

/** Rings */
export const RINGS = {
  countMin: 5,
  countMax: 8,
  outerRadius: 28,
  innerRadius: 14,
  thickness: 10, // visual depth
  colors: [
    0xe74c3c, // red
    0xf39c12, // orange
    0xf1c40f, // yellow
    0x2ecc71, // green
    0x3498db, // blue
    0x9b59b6, // purple
    0xe91e63, // pink
    0x1abc9c, // teal
  ],
  density: 0.0008,
  friction: 0.08,
  restitution: 0.35,
  frictionAir: 0.02,
};

/** Buttons */
export const BUTTONS = {
  left: { x: 90, y: 520, radius: 42 },
  right: { x: 870, y: 520, radius: 42 },
  color: 0xd32f2f,
  pressColor: 0x9a1f1f,
  rimColor: 0x5d4037,
  labelColor: 0xfff8e1,
};

/** Water jet */
export const WATER_JET = {
  shortPressMs: 180,
  weakForce: 0.0012,
  strongForce: 0.0035,
  weakRadius: 90,
  strongRadius: 160,
  particleRateWeak: 8,
  particleRateStrong: 22,
  jetXLeft: TANK.x + 50,
  jetXRight: TANK.x + TANK.width - 50,
  jetY: TANK.y + TANK.height - 8,
  upwardBias: -0.85,
  lateralSpread: 0.35,
};

/** Physics */
export const PHYSICS = {
  gravityY: 0.55,
  buoyancy: 0.00095,
  waterDrag: 0.045,
  waterAngularDrag: 0.04,
  surfaceTensionPull: 0.00008,
  pegFriction: 0.4,
  wallFriction: 0.15,
  scoredSettleFrames: 45,
  scoredYTolerance: 18,
  scoredVelMax: 1.2,
};

/** Particles budget (Pi 5 friendly) */
export const PARTICLES = {
  maxWater: 280,
  maxBubbles: 80,
  maxGlitter: 40,
  maxFireworks: 200,
  waterLife: 0.9,
  bubbleLife: 2.2,
  glitterLife: 6,
};

/** UI colors */
export const UI = {
  panelBg: 0x3e2723,
  textGold: 0xffe082,
  textCream: 0xfff8e1,
  textDark: 0x3e2723,
  successGreen: 0x66bb6a,
  overlay: 0x0a1520,
};
