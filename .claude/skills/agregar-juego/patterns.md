# Receta de implementación — juego + leaderboard

Fragmentos reales del patrón canónico ("asteroides", specs 05+06). Leer esto antes de
escribir código en la Fase 3 del skill. Los nombres `<slug>`/`<Name>`/`<CAT>`/`<color>`
se reemplazan por los del juego nuevo.

## 1. Contrato del motor

Archivo canónico: `app/lib/games/asteroides/engine.ts`.

```ts
const W = 800; // resolución interna fija del canvas
const H = 600;

export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

export interface AsteroidesEngine {
  start(): void; // arranca requestAnimationFrame
  stop(): void; // cancela el loop (pausa o desmontaje)
  reset(): void; // reinicia la partida completa (equivalente a initGame())
  getSnapshot(): EngineSnapshot;
  onSnapshotChange(cb: (s: EngineSnapshot) => void): () => void; // retorna unsubscribe
  destroy(): void; // limpia listeners de teclado y cancela el loop
}

export function createEngine(canvas: HTMLCanvasElement): AsteroidesEngine {
  const ctx = canvas.getContext("2d")!;
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};
  function pressed(code: string) {
    const val = justPressed[code];
    justPressed[code] = false;
    return val;
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ... estado del juego encapsulado en variables de closure (ver game.js original) ...

  function initGame() {
    /* resetea todo el estado interno */
  }

  function update(dt: number) {
    /* lógica de física/colisiones, igual que game.js update() */
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    // dibujar entidades — SIN dibujar HUD/overlay interno: lo reemplaza React
  }

  let rafId: number | null = null;
  let lastTime: number | null = null;
  function snapshot(): EngineSnapshot {
    return { score, lives, level, state };
  }
  const listeners = new Set<(s: EngineSnapshot) => void>();
  function notify() {
    const s = snapshot();
    listeners.forEach((cb) => cb(s));
  }
  function loop(ts: number) {
    // dt clamp evita saltos grandes al reanudar tras pausa
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
      lastTime = null; // reset explícito: el primer frame post-pausa usa dt=0
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
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      listeners.clear();
    },
  };
}
```

**Al portar un `game.js` de `references/started-games/`:**

- Reemplazar `ctx`/`keys`/`justPressed`/estado global del archivo original por
  variables encapsuladas en el closure de `createEngine`.
- Portar clases (`Bullet`, `Asteroid`, `Ship`, ...) y constantes (`RADII`, `SPEEDS`,
  `POINTS`, ...) tal cual, dentro del mismo módulo — no exportarlas fuera de
  `engine.ts`, solo el contrato público de arriba.
- Si el juego original no tiene "vidas" o "nivel" (ej. tetris usa `lines`/`level` en
  vez de `lives`), **ajustar el shape de `EngineSnapshot`** y documentarlo en el spec
  — no forzar campos que no aplican.
- Si el juego usa doble canvas (ej. tetris: tablero + preview de siguiente pieza),
  `createEngine` puede aceptar un segundo argumento `nextCanvas?: HTMLCanvasElement`,
  o el wrapper React puede pasar ambos refs — decidir y documentar en el spec.
- Mantener el patrón `lastTime = null` en `start()` para que el primer frame
  post-pausa use `dt = 0` (evita saltos grandes de física).

## 2. Wrapper React

Archivo canónico: `app/juego/asteroides/AsteroidesGame.tsx`.

```tsx
"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  createEngine,
  type AsteroidesEngine,
  type EngineSnapshot,
} from "../../lib/games/asteroides/engine";

const PREVENT_DEFAULT_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

export interface AsteroidesGameHandle {
  pause(): void;
  resume(): void;
  reset(): void;
}
interface AsteroidesGameProps {
  onSnapshot: (snapshot: EngineSnapshot) => void;
}

const AsteroidesGame = forwardRef<AsteroidesGameHandle, AsteroidesGameProps>(
  function AsteroidesGame({ onSnapshot }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<AsteroidesEngine | null>(null);
    useImperativeHandle(ref, () => ({
      pause() {
        engineRef.current?.stop();
      },
      resume() {
        engineRef.current?.start();
      },
      reset() {
        engineRef.current?.reset();
      },
    }));
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const engine = createEngine(canvas);
      engineRef.current = engine;
      const unsubscribe = engine.onSnapshotChange(onSnapshot);
      onSnapshot(engine.getSnapshot()); // snapshot inicial antes del primer frame
      engine.start();
      const onKeyDown = (e: KeyboardEvent) => {
        if (PREVENT_DEFAULT_KEYS.has(e.code)) e.preventDefault();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        unsubscribe();
        engine.destroy();
        engineRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount-once: NO re-crear el engine en cada render
    return (
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{
          width: "100%",
          maxWidth: "100%",
          aspectRatio: "4 / 3", // ajustar según el canvas real del juego (ej. tetris 300x600 → 1/2)
          display: "block",
        }}
      />
    );
  },
);
export default AsteroidesGame;
```

Para `<Name>Game.tsx` nuevo: mismo esqueleto, cambiar el import del engine, el nombre
del componente/handle, el `width`/`height`/`aspectRatio` del canvas, y las teclas en
`PREVENT_DEFAULT_KEYS` según los controles reales del juego.

## 3. Wiring en el reproductor

Archivo: `app/juego/[id]/jugar/GamePlayerClient.tsx`. Es genérico y **ya soporta**
`saveScore`/estado de invitado para cualquier `game.id` — solo hace falta agregar la
rama de detección y render. Patrón a extender (mostrado con asteroides; añadir un
segundo flag en paralelo, ej. `isTetris`, sin romper el existente):

```tsx
const isAsteroides = game.id === "asteroides";
const isTetris = game.id === "tetris"; // ejemplo de nueva rama

// fuente del HUD: elegir según qué motor está activo
const score = isAsteroides
  ? (snapshotAsteroides?.score ?? 0)
  : isTetris
    ? (snapshotTetris?.score ?? 0)
    : DEMO_SCORE;

// render condicional dentro de .crt-screen
{isAsteroides ? (
  <AsteroidesGame ref={asteroidesHandleRef} onSnapshot={setSnapshotAsteroides} />
) : isTetris ? (
  <TetrisGame ref={tetrisHandleRef} onSnapshot={setSnapshotTetris} />
) : (
  <div className="game-arena">{/* arena mock existente, sin cambios */}</div>
)}

// pausa: extender el onClick del botón PAUSA/REANUDAR
if (isAsteroides) (next ? asteroidesHandleRef : ...).current?.pause();
else if (isTetris) (next ? tetrisHandleRef : ...).current?.pause();

// fin de partida: extender modalOpen
const modalOpen =
  over ||
  (isAsteroides && snapshotAsteroides?.state === "gameover") ||
  (isTetris && snapshotTetris?.state === "gameover");
```

**No tocar** `saveScore` (usa `game.id` genérico), ni el bloque del modal de
guardado/estado de invitado — ya son genéricos:

```tsx
const saveScore = async () => {
  if (!user) return;
  setSaving(true);
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("scores")
      .upsert(
        {
          user_id: user.id,
          game_id: game.id,
          player_name: user.username,
          score,
        },
        { onConflict: "user_id,game_id" },
      );
    if (error) throw error;
    setSaved(true);
  } finally {
    setSaving(false);
  }
};
```

Si el juego nuevo no tiene "vidas"/"nivel" en su `EngineSnapshot`, ajustar solo la
sección del HUD que muestra esos campos para ese juego (ej. ocultar "Vidas" o
reemplazarla por "Líneas").

## 4. Migración Supabase (aplicar con `mcp__supabase__apply_migration`)

No se crea tabla nueva — `games`/`scores`/RLS/trigger ya existen (spec 06). Solo se
agrega la fila del catálogo:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  '<slug>',
  '<TÍTULO EN MAYÚSCULAS>',
  '<descripción corta, una línea>',
  '<descripción larga, un párrafo>',
  '<ARCADE|PUZZLE|SHOOTER|VERSUS>',
  'cover-<slug>',
  '<cyan|magenta|green|yellow>'
);
```

`best_score`/`plays`/`created_at` usan sus defaults (`0`, `0`, `now()`); el trigger
`handle_score_upsert` los mantiene actualizados a partir de la primera puntuación
guardada. No es necesario tocar `scores`, sus policies, ni la función/trigger.

## 5. CSS de portada

Archivo: `app/globals.css`. Patrón (`.cover-asteroides`, líneas ~815-838):

```css
.cover-<slug > {
  background: radial-gradient(circle at 50% 50%, #001a2e, #000);
}
.cover-<slug > ::after {
  content: "";
  position: absolute;
  inset: 0;
  background: /* gradientes/formas decorativas — sin arte real, solo CSS */;
}
.cover-<slug > ::before {
  content: "▲"; /* glifo temático del juego */
  position: absolute;
  left: 48%;
  top: 44%;
  color: var(--<color>);
  font-size: 22px;
  text-shadow: 0 0 8px var(--<color>);
}
```

Agregar el bloque nuevo junto a los existentes (`.cover-bricks`, `.cover-tetro`,
`.cover-snake`, `.cover-glot`, `.cover-invaders`, `.cover-rocas`, `.cover-asteroides`,
`.cover-rana`, `.cover-duelo`), reusando las variables de color ya definidas
(`--cyan`, `--magenta`, `--green`, `--yellow`).

## 6. Archivos que NO se tocan

- `app/lib/data.ts` — `getGames()`/`getGame()`/`getLeaderboard()` ya son genéricos.
- `app/lib/constants.ts` (`CATS`) — ya cubre las 4 categorías; solo tocar si el juego
  necesita una categoría nueva (decisión mayor, confirmar con el usuario primero).
- `app/page.tsx`, `app/games/page.tsx`, `app/salon/page.tsx`,
  `app/juego/[id]/page.tsx` — iteran `getGames()`/`getLeaderboard()` sin conocer
  juegos específicos.
- `app/lib/supabase/server.ts` / `client.ts` — clientes ya configurados.
- Cualquier `references/started-games/<carpeta>/game.js` — solo lectura.

## 7. Checklist de verificación final

1. `npm run dev` sin errores de build/tipo.
2. El juego aparece en Biblioteca (`/`, `/games`), filtrable por su categoría, con su
   cover nueva.
3. `/juego/<slug>` muestra detalle + leaderboard (vacío al inicio con el mensaje de
   "SÉ EL PRIMERO").
4. `/juego/<slug>/jugar` renderiza el canvas real, controles responden,
   `preventDefault` evita scroll de página con las teclas usadas.
5. HUD en vivo, sin HUD duplicado dentro del canvas.
6. PAUSA/REANUDAR conserva el estado (no reinicia posiciones).
7. Fin de partida abre el modal con el puntaje real.
8. Logueado: guardar puntuación hace upsert (verificar que jugar dos veces no crea
   fila duplicada — mismo `user_id`+`game_id`).
9. Tras guardar, `games.best_score`/`games.plays` del juego se actualizaron (trigger).
10. El puntaje aparece en `/juego/<slug>` y en `/salon` (pestaña del juego).
11. Invitado (sin sesión): no puede guardar, ve el link a `/login`.
12. `references/started-games/<carpeta>/game.js` (si hubo referencia) sigue intacto.
