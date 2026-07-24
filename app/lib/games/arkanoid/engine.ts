// Puerto TypeScript de references/started-games/04-arkanoid/game.js + levels.js
// Lógica y balance preservados 1:1; el HUD y overlay internos del canvas
// quedan desactivados porque el HUD/modal de React los reemplaza.
// gameState "win" (5 niveles completados) se mapea a state:"gameover" en el
// snapshot público, igual que perder la 3ª vida.
const W = 800;
const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const EXPLOSION_DURATION = 150;
const SOUND_BASE = "/games/arkanoid/sounds";
const SPRITESHEET_SRC = "/games/arkanoid/spritesheet-breakout.png";
interface SpriteRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}
const SPRITES: {
  paddle: SpriteRect;
  ball: SpriteRect;
  blocks: Record<string, SpriteRect>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};
const EXPLOSION_FRAMES: Record<string, SpriteRect[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};
let spritesheet: HTMLCanvasElement | null = null;
let spritesheetLoading: Promise<void> | null = null;
function loadSpritesheet(): Promise<void> {
  if (spritesheet) return Promise.resolve();
  if (spritesheetLoading) return spritesheetLoading;
  spritesheetLoading = new Promise((resolve) => {
    const rawImg = new Image();
    rawImg.onload = () => {
      const oc = document.createElement("canvas");
      oc.width = rawImg.width;
      oc.height = rawImg.height;
      const octx = oc.getContext("2d")!;
      octx.drawImage(rawImg, 0, 0);
      spritesheet = oc;
      resolve();
    };
    rawImg.onerror = () => resolve();
    rawImg.src = SPRITESHEET_SRC;
  });
  return spritesheetLoading;
}
function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: SpriteRect,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!spritesheet) return;
  ctx.drawImage(
    spritesheet,
    frame.sx,
    frame.sy,
    frame.sw,
    frame.sh,
    x,
    y,
    w,
    h,
  );
}
function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: "paddle" | "ball" | `block_${string}`,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!spritesheet) return;
  const sp = name.startsWith("block_")
    ? SPRITES.blocks[name.slice(6)]
    : SPRITES[name as "paddle" | "ball"];
  if (!sp) return;
  ctx.drawImage(spritesheet, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
}
interface Level {
  speed: number;
  blocks: { col: number; row: number; color: string }[];
}
const LEVELS: Level[] = (() => {
  const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];
  const l1: Level["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });
  const l2: Level["blocks"] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });
  const l3: Level["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });
  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: Level["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });
  const l5: Level["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }
  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();
interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}
interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
}
export type EngineState = "playing" | "dead" | "gameover";
export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}
export interface ArkanoidEngine {
  start(): void;
  stop(): void;
  reset(): void;
  getSnapshot(): EngineSnapshot;
  onSnapshotChange(cb: (s: EngineSnapshot) => void): () => void;
  destroy(): void;
}
export function createEngine(canvas: HTMLCanvasElement): ArkanoidEngine {
  const ctx = canvas.getContext("2d")!;
  loadSpritesheet();
  const bounceSound = new Audio(`${SOUND_BASE}/ball-bounce.mp3`);
  const breakSound = new Audio(`${SOUND_BASE}/break-sound.mp3`);
  function playSound(sound: HTMLAudioElement) {
    try {
      (sound.cloneNode() as HTMLAudioElement).play().catch(() => {});
    } catch {
      // autoplay bloqueado o audio no soportado: el juego sigue en silencio
    }
  }
  const paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball = { x: 0, y: 0, w: 16, h: 16, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let gameState: "playing" | "gameover" | "win" = "playing";
  let currentLevel = 1;
  const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false };
  function initPaddle() {
    paddle.x = (canvas.width - paddle.w) / 2;
  }
  function initBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }
  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * level.speed;
    ball.vy = BASE_BALL_VY * level.speed;
  }
  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }
  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(
      0,
      Math.min(canvas.width - paddle.w, mouseX - paddle.w / 2),
    );
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key in keys) {
      e.preventDefault();
      keys[e.key] = true;
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key in keys) keys[e.key] = false;
  };
  canvas.addEventListener("mousemove", onMouseMove);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  function initGame() {
    lives = 3;
    score = 0;
    gameState = "playing";
    initPaddle();
    loadLevel(1);
  }
  function update(dt: number) {
    if (gameState !== "playing") return;
    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(
        canvas.width - paddle.w,
        paddle.x + PADDLE_SPEED * dt,
      );
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.x + ball.w >= canvas.width) {
      ball.x = canvas.width - ball.w;
      ball.vx = -Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playSound(bounceSound);
    }
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      playSound(bounceSound);
    }
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        ball.vy = -ball.vy;
        playSound(breakSound);
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < 5) loadLevel(currentLevel + 1);
          else gameState = "win";
        }
        break;
      }
    }
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);
    if (ball.y > canvas.height) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameState = "gameover";
      } else {
        initBall();
      }
    }
  }
  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const block of blocks) {
      if (block.alive)
        drawSprite(
          ctx,
          `block_${block.color}`,
          block.x,
          block.y,
          block.w,
          block.h,
        );
    }
    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawFrame(
        ctx,
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }
    drawSprite(ctx, "paddle", paddle.x, paddle.y, paddle.w, paddle.h);
    drawSprite(ctx, "ball", ball.x, ball.y, ball.w, ball.h);
    // HUD y overlays internos (score/nivel/vidas, GAME OVER, pausa) desactivados:
    // los reemplaza la UI de React.
  }
  let rafId: number | null = null;
  let lastTime: number | null = null;
  function publicState(): EngineState {
    return gameState === "playing" ? "playing" : "gameover";
  }
  function snapshot(): EngineSnapshot {
    return { score, lives, level: currentLevel, state: publicState() };
  }
  const listeners = new Set<(s: EngineSnapshot) => void>();
  function notify() {
    const s = snapshot();
    listeners.forEach((cb) => cb(s));
  }
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    notify();
    rafId = requestAnimationFrame(loop);
  }
  initGame();
  return {
    start() {
      if (rafId !== null) return;
      lastTime = null;
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      lastTime = null;
    },
    reset() {
      initGame();
      notify();
    },
    getSnapshot() {
      return snapshot();
    },
    onSnapshotChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    destroy() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      canvas.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      listeners.clear();
    },
  };
}
