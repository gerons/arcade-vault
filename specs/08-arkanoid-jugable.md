# 08 — Arkanoid jugable

- Estado: Aprobado
- Fecha: 2026-07-23
- Dependencias: [05-asteroides-jugable](05-asteroides-jugable.md) (patrón de motor +
  reproductor), [06-leaderboard-catalogo-supabase](06-leaderboard-catalogo-supabase.md)
  (tablas `games`/`scores`, RLS, trigger), [07-tetris-jugable](07-tetris-jugable.md)
  (segundo caso real del mismo patrón, confirma que es reutilizable)
- Objetivo: Portar el juego de referencia Arkanoid
  (`references/started-games/04-arkanoid/game.js` + `levels.js`) a un motor TypeScript
  real, agregarlo como nuevo juego "ARKANOID" al catálogo de Supabase, y hacerlo
  jugable de punta a punta en `/juego/arkanoide/jugar` con HUD real, pausa real, fin de
  partida automático y guardado de puntuación real en `scores`.

## Alcance

### Incluye

- Nueva fila en `public.games` (Supabase, no un array mock): `id: "arkanoid"`,
  `title: "ARKANOID"`, `cat: "ARCADE"`, `cover: "cover-arkanoid"`, `color: "magenta"`,
  `short`/`long` adaptados del `README.md` del juego de referencia. El juego aparece en
  la Biblioteca (`/`, `/games`), es filtrable por categoría ARCADE, y tiene su propia
  página de detalle (`/juego/arkanoid`) igual que cualquier otro juego (sin cambios en
  esa pantalla). Es una entrada **nueva e independiente** de `bloque-buster` (la
  maqueta ARCADE/cyan/`cover-bricks` ya existente en el catálogo) — mismo criterio que
  el spec 05 usó para no tocar `rocas` al agregar `asteroides`.
- Clase CSS `.cover-arkanoid` en `app/globals.css`, siguiendo el patrón visual de
  coberturas existentes (`.cover-bricks`, `.cover-asteroides`), reusando `--magenta`.
- Puerto a TypeScript del motor del juego
  (`references/started-games/04-arkanoid/game.js` + `levels.js`, constantes
  `PADDLE_SPEED`/`BLOCK_*`/`BASE_BALL_V*`, objetos `paddle`/`ball`, arrays
  `blocks`/`explosions`, funciones `initPaddle`/`initBall`/`loadLevel`/`collideAABB`/
  `update`/`draw`) en un módulo nuevo `app/lib/games/arkanoid/engine.ts`, preservando
  la lógica y balance del original (velocidad de pelota por nivel, 10 pts por bloque,
  5 niveles con sus patrones de `levels.js`, animación de explosión) sin cambios de
  diseño.
- Componente de juego real `app/juego/arkanoid/ArkanoidGame.tsx` (client component) que
  monta el `<canvas>` de 800×600 vía `useRef`/`useEffect`, corre el loop con
  `requestAnimationFrame`, captura movimiento del paddle por `mousemove` sobre el
  canvas y por teclado (flechas ← →) con `preventDefault`, y limpia listeners/loop al
  desmontar.
- `app/juego/[id]/jugar/GamePlayerClient.tsx` detecta `game.id === "arkanoid"`
  (`isArkanoid`, en paralelo a `isAsteroides`/`isTetris`) y renderiza `ArkanoidGame` en
  vez de la arena decorativa mock.
- HUD de React (Jugador/Puntuación/Vidas/Nivel) sincronizado en vivo con el
  `EngineSnapshot` real (`score`, `lives`, `level`, `state`) — mismo shape que
  `AsteroidesEngine`, sin necesidad de adaptar el HUD (a diferencia de tetris, que
  reemplaza "Vidas" por "Líneas": arkanoid sí tiene vidas y nivel). El HUD que el motor
  original dibuja dentro del canvas (Score/Nivel/vidas) se desactiva para no
  duplicarlo.
- Botón **PAUSA/REANUDAR** conectado a `stop()`/`start()` del motor para arkanoid; se
  descarta portar el overlay de pausa propio del original (selector de nivel 1–5 por
  click) — el sitio ya tiene su propio botón de pausa/reanudar.
- Botón **FIN** oculto para arkanoid (mismo criterio que asteroides/tetris): el fin de
  partida es automático.
- Fin de partida automático: tanto perder la 3ª vida como completar los 5 niveles
  (`gameState === 'win'` en el original) disparan `state: "gameover"` en el snapshot;
  la página `/jugar` abre el modal existente con el puntaje real en ambos casos. El
  overlay interno de "GAME OVER"/victoria del motor original queda desactivado.
- "JUGAR DE NUEVO" en el modal llama `engine.reset()` (equivalente a
  `initPaddle()` + `loadLevel(1)` + `score`/`lives` a su valor inicial).
- Guardado real de puntuación: upsert en `scores` (`onConflict: "user_id,game_id"`)
  solo con sesión activa — ya implementado de forma genérica en `GamePlayerClient.tsx`
  (`saveScore`), no se reimplementa, solo se verifica que sigue aplicando para
  `game.id === "arkanoid"`.
- Sonido: el original reproduce `bounceSound`/`breakSound` (`assets/sounds/*.mp3`) vía
  `Audio`/`cloneNode().play()`. Se porta igual en el motor (mismos assets, copiados a
  `public/` si el repo lo requiere para servirlos) — es la única mecánica del original
  con audio real entre los juegos portados hasta ahora; si falla la carga de audio
  (bloqueo de autoplay del navegador antes de interacción), el juego debe seguir
  siendo jugable en silencio, sin romper el loop.

### No incluye (fuera de alcance)

- Cualquier cambio al juego mock "BLOQUE BUSTER" (`bloque-buster`) ya existente en el
  catálogo — queda intacto, sin relación con esta implementación.
- Arquitectura genérica de registro de motores de juego — se especializa únicamente
  para `id === "arkanoid"`, mismo patrón puntual que asteroides/tetris.
- Controles táctiles/móviles — el juego es jugable con mouse (dentro del área del
  `crt-screen`) y teclado (flechas), igual que el original con mouse de escritorio; en
  móvil queda como limitación conocida, sin resolver en este spec.
- Overlay de pausa propio del original con selector de nivel 1–5 — se descarta portar
  esa función; el sitio ya tiene su propio flujo de pausa/reanudar y no expone salto de
  nivel manual en ningún otro juego portado.
- Modificar los archivos originales de `references/started-games/04-arkanoid/`
  (`game.js`, `levels.js`, `index.html`, `assets/`) — se leen como referencia para
  portar la lógica, no se editan ni se borran.
- Balance/features nuevas (power-ups, dificultad extra, más niveles) — se porta el
  juego tal cual es, sin agregar ni quitar mecánicas.
- Tabla de puntuaciones del Salón de la Fama (`/salon`) — arkanoid participa igual que
  cualquier otro juego vía `scores`/`getLeaderboard`, sin lógica especial ahí.

## Modelo de datos

### Catálogo (`public.games`, INSERT)

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'arkanoid',
  'ARKANOID',
  'Rompe hileras de bloques con tu paleta y una pelota rebotante.',
  'Paleta y pelota en un canvas clásico de rompe-bloques. Recorré 5 niveles con patrones de bloques y velocidad de pelota crecientes, evitá perder tus 3 vidas y hacé estallar cada bloque en una lluvia de píxeles.',
  'ARCADE',
  'cover-arkanoid',
  'magenta'
);
```

`best_score`/`plays` usan sus defaults (`0`); el trigger `handle_score_upsert` los
actualiza a partir de la primera puntuación guardada.

### Motor (`app/lib/games/arkanoid/engine.ts`)

Mismo contrato que `AsteroidesEngine` — arkanoid sí tiene vidas y nivel, así que no
hace falta ajustar el shape del snapshot:

```ts
export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number; // 1–5, según LEVELS
  state: EngineState;
}

export interface ArkanoidEngine {
  start(): void; // arranca requestAnimationFrame
  stop(): void; // cancela el loop (pausa o desmontaje)
  reset(): void; // reinicia partida completa (paddle centrado, nivel 1, 3 vidas, score 0)
  getSnapshot(): EngineSnapshot;
  onSnapshotChange(cb: (s: EngineSnapshot) => void): () => void; // retorna unsubscribe
  destroy(): void; // limpia listeners de teclado/mouse y cancela el loop
}

export function createEngine(canvas: HTMLCanvasElement): ArkanoidEngine;
```

Las constantes (`PADDLE_SPEED`, `BLOCK_*`, `BASE_BALL_VX`/`VY`, `EXPLOSION_DURATION`),
los niveles (`LEVELS`, portados de `levels.js` tal cual) y el estado (`paddle`, `ball`,
`blocks`, `explosions`) se portan encapsulados dentro del módulo — no se exportan fuera
de `engine.ts`. `gameState === 'win'` (completar los 5 niveles) se mapea a
`state: "gameover"` en el snapshot, igual que `gameState === 'gameover'` (0 vidas) —
ambos casos terminan la partida desde la perspectiva del reproductor.

No se agregan tablas nuevas en Supabase — reutiliza `games`/`scores` del spec 06 sin
cambios de esquema.

## Plan de implementación

1. **Catálogo**: `insert into games` vía `mcp__supabase__apply_migration` + clase
   `.cover-arkanoid` en `app/globals.css` (patrón de `.cover-bricks`/`.cover-asteroides`,
   glifo temático ej. `▭` o bloques en gradiente, color `--magenta`). Sistema
   funcional: "ARKANOID" aparece en Biblioteca/home/salón con leaderboard vacío, aún
   sin ser jugable de verdad (usa la arena mock al entrar a jugar).
2. **Puerto del motor**: crear `app/lib/games/arkanoid/engine.ts` portando 1:1 la
   lógica de `game.js`/`levels.js` (constantes, `paddle`/`ball`/`blocks`/`explosions`,
   `initPaddle`/`initBall`/`loadLevel`/`collideAABB`/`update`/`draw`, sonidos) dentro
   de `createEngine(canvas)`, reemplazando `ctx`/`keys`/estado global del archivo
   original por variables encapsuladas en el closure. Expone
   `start/stop/reset/getSnapshot/onSnapshotChange/destroy`. Sistema sigue igual
   visualmente — módulo sin uso todavía.
3. **Componente de juego**: crear `app/juego/arkanoid/ArkanoidGame.tsx` (client
   component) que monta `<canvas width={800} height={600}>`, instancia `createEngine`
   en `useEffect`, se suscribe a `onSnapshotChange`, traduce `mousemove` sobre el
   canvas a coordenadas internas (mismo cálculo de `scaleX` que el original, ya que el
   canvas se escala por CSS), agrega `preventDefault()` en `keydown` de flechas, y
   llama `destroy()` en el cleanup. Sistema sigue igual — componente sin integrar a
   `/jugar` todavía.
4. **Integrar en `/jugar`**: agregar `isArkanoid = game.id === "arkanoid"` en
   `GamePlayerClient.tsx` (en paralelo a `isAsteroides`/`isTetris`, sin romper
   ninguno de los dos), renderizar `ArkanoidGame` dentro de `.crt-screen`, sincronizar
   HUD (`score`/`lives`/`level`) con el snapshot real, ocultar el botón FIN para
   arkanoid. Sistema funcional: arkanoid es jugable con mouse/teclado, HUD real.
5. **Pausa y fin de partida real**: conectar el botón PAUSA/REANUDAR a
   `stop()`/`start()` para arkanoid; extender `modalOpen` para que
   `snapshotArkanoid?.state === "gameover"` abra el modal de fin de partida; "JUGAR DE
   NUEVO" llama `engine.reset()`. Sistema funcional de punta a punta.
6. **Verificación funcional final**: `npm run dev`, jugar una partida completa de
   "ARKANOID" desde la Biblioteca: mover el paddle con mouse y con flechas, romper
   bloques de los 5 niveles, confirmar que la velocidad de la pelota aumenta por nivel,
   perder las 3 vidas (o completar los 5 niveles) y confirmar que se abre el modal con
   el puntaje real, guardar la puntuación logueado y verificar que aparece en
   `/juego/arkanoid` y en `/salon`, jugar como invitado y confirmar que no puede
   guardar, pausar/reanudar a mitad de partida sin perder posiciones, y salir a mitad
   de partida confirmando que el loop se detiene.

## Criterios de aceptación

- [ ] `npm run dev` levanta la app sin errores de build/tipo.
- [ ] "ARKANOID" aparece en la Biblioteca (`/`, `/games`), filtrable por categoría
      ARCADE, con su cover `.cover-arkanoid`, sin afectar a "BLOQUE BUSTER".
- [ ] `/juego/arkanoid` muestra el detalle (descripción, stats, leaderboard real) igual
      que cualquier otro juego; si no hay puntuaciones, muestra "AÚN NO HAY
      PUNTUACIONES REGISTRADAS — SÉ EL PRIMERO".
- [ ] `/juego/arkanoid/jugar` renderiza el canvas jugable real (no la arena
      decorativa), con paddle controlable por mouse y por flechas ← →.
- [ ] Los bloques se destruyen al ser golpeados por la pelota, suman 10 puntos cada
      uno, y disparan la animación de explosión con el color del bloque.
- [ ] Al vaciar un nivel se carga el siguiente (2 a 5) con más velocidad de pelota; al
      completar el nivel 5 termina la partida (mismo criterio que perder 0 vidas).
- [ ] El HUD de React (Jugador/Puntuación/Vidas/Nivel) refleja en vivo el score, vidas
      y nivel reales de la partida — no valores fijos de maqueta.
- [ ] Dentro del canvas no se dibuja un HUD duplicado (Score/Nivel/vidas internos del
      motor quedan desactivados), ni el overlay de pausa/selector de nivel original.
- [ ] El botón PAUSA detiene el movimiento del juego; REANUDAR lo continúa desde el
      mismo estado (sin reiniciar posiciones de paddle/pelota/bloques).
- [ ] Perder la 3ª vida o completar el nivel 5 abre automáticamente el modal de fin de
      partida con el puntaje real, sin necesidad de apretar ningún botón FIN.
- [ ] El botón FIN no aparece para arkanoid.
- [ ] Guardar puntuación en el modal hace upsert real en `scores`
      (`game_id: "arkanoid"`), sin crear una fila duplicada al guardar dos veces con el
      mismo usuario.
- [ ] `games.best_score`/`games.plays` de "arkanoid" se actualizan vía trigger tras
      guardar (no se tocan a mano desde el cliente).
- [ ] El puntaje guardado aparece en `/juego/arkanoid` y en `/salon` (pestaña
      ARKANOID).
- [ ] Jugar sin sesión (invitado) no permite guardar; el modal muestra el link a
      `/login`.
- [ ] "JUGAR DE NUEVO" reinicia la partida completa: score en 0, 3 vidas, nivel 1,
      paddle centrado, bloques del nivel 1 completos.
- [ ] El botón "SALIR" navega a `/juego/arkanoid` y detiene el loop del juego (sin
      seguir corriendo en background).
- [ ] Presionar flechas mientras se juega no scrollea la página.
- [ ] `references/started-games/04-arkanoid/game.js` y `levels.js` permanecen sin
      modificar.

## Decisiones tomadas y descartadas

- **Nuevo juego "arkanoid" en vez de reemplazar/reutilizar "bloque-buster"**: se
  descarta tocar la entrada mock ya existente en el catálogo, mismo criterio que el
  spec 05 usó para "asteroides" vs. "rocas" — arkanoid es una entrada nueva e
  independiente.
- **`cat: "ARCADE"` y `color: "magenta"`**: ARCADE porque es la categoría que ya usa
  "bloque-buster" (rompe-bloques clásico, no encaja en SHOOTER/PUZZLE/VERSUS); magenta
  porque es el único de los 4 colores del catálogo sin uso duplicado hoy (solo lo usa
  "caída"), evitando que arkanoid comparta color con "bloque-buster" (cyan) o
  "asteroides"/"duelo-pixel" (cyan también).
- **Mouse + flechas, sin overlay de pausa propio con selector de nivel**: se porta el
  control por mouse porque es el control principal del original (más preciso que
  teclado en este tipo de juego) y las flechas como alternativa ya usada en otros
  juegos del sitio; se descarta el overlay de pausa con salto de nivel del original
  porque el reproductor ya tiene su propio flujo de pausa/reanudar estandarizado, y
  ningún otro juego portado expone salto de nivel manual.
- **`gameState === 'win'` (completar 5 niveles) mapeado también a `state: "gameover"`**:
  se descarta agregar un tercer estado `"win"` al `EngineSnapshot` para no romper el
  contrato compartido con `AsteroidesEngine`/`TetrisEngine` (`"playing" | "dead" |
"gameover"`) que ya consume `GamePlayerClient.tsx`; completar el juego es, desde la
  perspectiva del reproductor, un fin de partida más con el puntaje final acumulado.
- **Se porta el audio del original (`bounceSound`/`breakSound`)**: a diferencia de
  asteroides (que no tenía sonido en el original), arkanoid sí lo tiene; se decide
  portarlo tal cual en vez de omitirlo, ya que es parte del feedback del juego y no
  hay motivo técnico para descartarlo — con manejo silencioso si el navegador bloquea
  el autoplay antes de interacción del usuario.
- **Reutilizar el contrato `EngineSnapshot {score, lives, level, state}` sin
  modificar**: a diferencia de tetris (que sí lo ajustó, reemplazando `lives` por
  `lines`), arkanoid tiene vidas y nivel reales como asteroides, así que no hace falta
  adaptar el HUD del reproductor para este juego.

## Riesgos identificados

- **Divergencia de balance al portar `game.js`/`levels.js` a TypeScript**: un error de
  transcripción manual (ej. una constante de velocidad o un patrón de nivel mal
  copiado) cambiaría sutilmente la dificultad respecto al original. Mitigación: portar
  función por función y los 5 niveles de `levels.js` comparando contra el archivo de
  referencia; los criterios de aceptación de velocidad creciente por nivel ayudan a
  detectar desvíos groseros.
- **Coordenadas de mouse desalineadas por el escalado CSS del canvas**: como el canvas
  interno es 800×600 pero se muestra escalado (`max-width: 100%`, `aspect-ratio: 4/3`)
  dentro del `crt-screen` responsive, un cálculo de `scaleX`/`scaleY` incorrecto en el
  wrapper React haría que el paddle no seguya al cursor con precisión. Mitigación:
  portar el mismo cálculo de `getBoundingClientRect()` + `scaleX` que ya usa
  `game.js` original.
- **Autoplay de audio bloqueado por el navegador**: `bounceSound.cloneNode().play()`
  puede rechazar la promesa si el usuario no interactuó todavía con la página (política
  de autoplay). Mitigación: envolver el `.play()` en un catch silencioso que no rompa
  el loop del juego ni lance errores no capturados a la consola en cada rebote.
- **Fuga de memoria / loop en background**: mismo riesgo ya mitigado en asteroides y
tetris — si el `useEffect` de `ArkanoidGame` no cancela `requestAnimationFrame` ni
remueve los listeners de `mousemove`/`keydown` al desmontar, el loop seguiría
corriendo invisible. Mitigación: `destroy()` del motor centraliza la limpieza, mismo
patrón que los motores anteriores.
</content>
