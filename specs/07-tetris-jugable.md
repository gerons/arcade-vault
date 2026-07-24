# 07 — Tetris jugable

- Estado: Aprobado
- Fecha: 2026-07-23
- Dependencias: [05-asteroides-jugable](05-asteroides-jugable.md) (patrón de motor TypeScript + reproductor real), [06-leaderboard-catalogo-supabase](06-leaderboard-catalogo-supabase.md) (tablas `games`/`scores`, RLS, trigger — ya existentes, sin cambios)
- Objetivo: Portar el juego de referencia Tetris (`references/started-games/03-tetris/game.js`) a un módulo TypeScript real, agregarlo como nuevo juego "TETRIS" al catálogo de Supabase, y hacerlo jugable de punta a punta con leaderboard real, siguiendo el mismo patrón que "asteroides".

## Alcance

**Incluye:**

- Nueva fila en `public.games` (Supabase, vía migración/`apply_migration`): `id: "tetris"`, `title: "TETRIS"`, `cat: "PUZZLE"`, `color: "yellow"`, `cover: "cover-tetris"`, `short`/`long` adaptados del `README.md` del juego de referencia, `best_score: 0`, `plays: 0` (el trigger `handle_score_upsert` los mantiene).
- Clase CSS `.cover-tetris` en `app/globals.css`, siguiendo el patrón visual de las coberturas existentes (`.cover-asteroides`, gradientes + `::before`/`::after`, sin arte real).
- Puerto a TypeScript del motor (`references/started-games/03-tetris/game.js`) en `app/lib/games/tetris/engine.ts`: tablero `10×20` (`COLS`/`ROWS`/`BLOCK`), las 7 piezas estándar (I, O, T, S, Z, J, L) con sus colores, rotación con wall kicks (`[0,±1,±2]`), soft drop y hard drop, pieza fantasma (_ghost piece_), vista previa de la siguiente pieza, sistema de puntuación (`LINE_SCORES` × nivel), niveles (cada 10 líneas, `dropInterval` decreciente) — preservando lógica y balance del original sin cambios de diseño.
- `EngineSnapshot` con el shape `{ score, lines, level, state }` (sin `lives` — Tetris no tiene vidas; variación del contrato ya prevista en el spec 05 para juegos sin ese concepto).
- Doble canvas: `board` (300×600, resolución interna fija) + `next-canvas` (120×120) para la vista previa de la siguiente pieza. `createEngine(boardCanvas, nextCanvas)` acepta ambos.
- Componente `app/juego/tetris/TetrisGame.tsx` (client component) que monta ambos `<canvas>` vía `useRef`, instancia el motor en `useEffect`, expone un handle imperativo `{pause, resume, reset}`, se suscribe a `onSnapshotChange`, captura teclado (flechas, `X`, espacio) con `preventDefault`, y limpia listeners/loop al desmontar.
- `app/juego/[id]/jugar/GamePlayerClient.tsx` agrega una segunda rama `isTetris = game.id === "tetris"` (junto a la ya existente `isAsteroides`) y renderiza `TetrisGame`; el HUD muestra "Puntuación"/"Líneas"/"Nivel" para Tetris en vez de "Puntuación"/"Vidas"/"Nivel".
- Botón **PAUSA/REANUDAR** conectado de verdad al motor (`stop()`/`start()`) para Tetris.
- Fin de juego automático: cuando una pieza nueva colisiona al aparecer (`spawn()` del original), el snapshot pasa a `state: "gameover"` y se abre el modal existente de fin de partida con el puntaje real.
- Botón **FIN** oculto para Tetris (igual que asteroides) — el fin es automático.
- Guardado real de puntuación: reutiliza el mecanismo genérico ya existente en `GamePlayerClient.tsx` (`upsert` con `onConflict: "user_id,game_id"`, `game_id: game.id`) — no requiere cambios, ya funciona para cualquier `game.id` nuevo.
- "JUGAR DE NUEVO" reinicia el motor por completo (`reset()` → equivalente a `init()`): tablero, puntuación, líneas y nivel vuelven al estado inicial.
- "SALIR" navega a `/juego/tetris` deteniendo el loop y limpiando listeners.

**Out of scope (para specs futuros):**

- Tema claro/oscuro propio del juego de referencia (`applyTheme`, botón `theme-toggle`, `localStorage: tetris-theme`) — la plataforma ya tiene su propio tema visual (CRT retro); portar un segundo sistema de temas sería redundante e inconsistente.
- Tecla `P` para pausar dentro del canvas — la pausa se maneja exclusivamente por el botón PAUSA/REANUDAR de React (mismo patrón que asteroides); duplicar el atajo del original generaría estados desincronizados.
- Overlay interno de "GAME OVER"/"PAUSA" y botón `restart-btn` propios del canvas — quedan desactivados; el modal de React del sitio los reemplaza, mismo criterio que asteroides.
- Controles táctiles/móviles.
- Arquitectura genérica de registro de motores para futuros juegos — se especializa solo para `id === "tetris"`, agregando una rama más al patrón ya usado para "asteroides".
- Modificar el archivo original `references/started-games/03-tetris/game.js` — se lee como referencia, no se edita ni se borra.
- Balance/features nuevas (piezas extra, dificultad distinta, sonidos) — se porta el juego tal cual.
- Cambios al esquema de `games`/`scores`, sus policies RLS o el trigger `handle_score_upsert` — ya existen del spec 06.
- Cambios a otros juegos ya existentes en el catálogo — quedan intactos.

## Modelo de datos

### Catálogo (`public.games`, INSERT)

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'tetris',
  'TETRIS',
  'El clásico de bloques que caen: encajá las piezas y limpiá líneas.',
  'Tablero de 10x20 celdas donde caen las 7 piezas estándar. Rotalas con wall kicks, usá la pieza fantasma para apuntar el aterrizaje, y acelerá la caída con soft/hard drop. La velocidad sube cada 10 líneas — sobreviví el ritmo el mayor tiempo posible.',
  'PUZZLE',
  'cover-tetris',
  'yellow'
);
```

### Motor (`app/lib/games/tetris/engine.ts`)

```ts
export type EngineState = "playing" | "gameover";

export interface EngineSnapshot {
  score: number;
  lines: number;
  level: number;
  state: EngineState;
}

export interface TetrisEngine {
  start(): void; // arranca requestAnimationFrame
  stop(): void; // cancela el loop (pausa o desmontaje)
  reset(): void; // init() — reinicia partida completa
  getSnapshot(): EngineSnapshot;
  onSnapshotChange(cb: (s: EngineSnapshot) => void): () => void; // retorna unsubscribe
  destroy(): void; // limpia listeners de teclado y cancela loop
}

export function createEngine(
  boardCanvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
): TetrisEngine;
```

Las estructuras internas (`board`, `PIECES`, `COLORS`, `current`/`next`, `LINE_SCORES`) se portan tal cual desde `game.js`, encapsuladas dentro del módulo — no se exportan fuera de `engine.ts`. No se agregan tablas nuevas en Supabase: se reutilizan `games`/`scores` del spec 06.

## Plan de implementación

1. **Catálogo**: aplicar el `insert into games` de arriba vía `mcp__supabase__apply_migration`, y agregar la clase `.cover-tetris` en `app/globals.css`. Sistema queda funcional: "TETRIS" aparece en Biblioteca/home/Salón con leaderboard vacío — todavía no es jugable de verdad.
2. **Puerto del motor**: crear `app/lib/games/tetris/engine.ts` portando 1:1 la lógica de `game.js` (`createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`) dentro de `createEngine(boardCanvas, nextCanvas)`, reemplazando el estado global del original por variables encapsuladas en el closure. Expone `start/stop/reset/getSnapshot/onSnapshotChange/destroy`. Sistema sigue igual visualmente — módulo sin uso todavía.
3. **Componente de juego**: crear `app/juego/tetris/TetrisGame.tsx` (client component) que monta `board` (300×600) y `next-canvas` (120×120) vía `useRef`, instancia `createEngine` en `useEffect` (mount-once), expone el handle imperativo `{pause, resume, reset}`, se suscribe a `onSnapshotChange`, agrega `preventDefault()` en `keydown` de flechas/`X`/espacio, y llama `destroy()` en el cleanup. Sistema sigue igual — componente sin integrar a `/jugar` todavía.
4. **Integrar en `/jugar`**: modificar `app/juego/[id]/jugar/GamePlayerClient.tsx` para agregar `isTetris = game.id === "tetris"`, renderizar `TetrisGame` cuando corresponda, y sincronizar el HUD de React ("Puntuación"/"Líneas"/"Nivel" para Tetris) con el snapshot real. El resto del catálogo sigue sin cambios. Sistema queda funcional: Tetris es jugable con teclado, con HUD real.
5. **Pausa real y fin de partida**: conectar PAUSA/REANUDAR a `stop()`/`start()`; cuando el snapshot reporta `state === "gameover"`, abrir el modal de fin de partida existente con el `score` real, ocultar el botón FIN para Tetris. "JUGAR DE NUEVO" llama `reset()` y cierra el modal. Sistema queda funcional de punta a punta.
6. **Verificación funcional final**: `npm run dev`, jugar una partida completa de "TETRIS" desde la Biblioteca: mover con flechas, rotar (flecha arriba o `X`), soft drop (flecha abajo), hard drop (espacio), confirmar pieza fantasma y vista previa de la siguiente pieza, limpiar líneas completas, perder al colisionar una pieza nueva al spawnear, confirmar que se abre el modal con el puntaje real, guardar la puntuación logueado y verificar que aparece en `/juego/tetris` y `/salon` (pestaña TETRIS), reiniciar con "JUGAR DE NUEVO", pausar/reanudar a mitad de partida, salir a mitad de partida confirmando que el loop se detiene, y jugar como invitado confirmando que no se puede guardar.

## Criterios de aceptación

- [ ] `npm run dev` levanta la app sin errores de build/tipo.
- [ ] "TETRIS" aparece en la Biblioteca (`/`), filtrable por categoría PUZZLE, con su cover `.cover-tetris`.
- [ ] `/juego/tetris` muestra el detalle y el leaderboard real (vacío inicialmente: "AÚN NO HAY PUNTUACIONES REGISTRADAS — SÉ EL PRIMERO").
- [ ] `/juego/tetris/jugar` renderiza el tablero jugable real (no la arena decorativa) junto con la vista previa de la siguiente pieza.
- [ ] Mover la pieza con flechas izquierda/derecha, rotar con flecha arriba o `X`, soft drop con flecha abajo, hard drop con espacio.
- [ ] La pieza fantasma se dibuja en la posición de aterrizaje proyectada, con transparencia.
- [ ] Las líneas completas se eliminan y las filas superiores bajan.
- [ ] El HUD de React (Puntuación/Líneas/Nivel) refleja en vivo el estado real de la partida — no valores fijos de maqueta.
- [ ] Dentro del canvas no se dibuja un HUD duplicado (panel `SCORE`/`LINES`/`LEVEL`/overlay internos del original quedan desactivados).
- [ ] El botón PAUSA detiene el juego; REANUDAR lo continúa desde el mismo estado (sin reiniciar el tablero).
- [ ] Cuando una pieza nueva colisiona al aparecer, se abre automáticamente el modal de fin de partida con el puntaje real, sin apretar ningún botón FIN.
- [ ] El botón FIN no aparece (o está deshabilitado) para Tetris.
- [ ] Guardar puntuación en el modal hace upsert real en `scores` (`game_id: "tetris"`, `player_name: user.username`), mostrando "PUNTUACIÓN GUARDADA".
- [ ] Guardar dos veces con el mismo usuario en Tetris no crea una segunda fila (upsert por `user_id`+`game_id`).
- [ ] Jugar sin sesión (invitado) y llegar al modal de fin de partida: no aparece botón "GUARDAR PUNTUACIÓN"; aparece el link a `/login`.
- [ ] Tras guardar, `games.best_score`/`games.plays` de "tetris" se actualizan vía el trigger existente (no se tocan a mano desde el cliente).
- [ ] El puntaje guardado aparece reflejado en `/juego/tetris` y en `/salon` (pestaña TETRIS).
- [ ] "JUGAR DE NUEVO" reinicia el tablero, puntuación, líneas y nivel al estado inicial.
- [ ] El botón "SALIR" navega a `/juego/tetris` y detiene el loop del juego (sin consumo de CPU en background).
- [ ] Presionar flechas, `X` o espacio mientras se juega no scrollea la página.
- [ ] El resto de los juegos del catálogo sigue con su comportamiento actual, sin cambios.
- [ ] `references/started-games/03-tetris/game.js` permanece sin modificar.

## Decisiones tomadas y descartadas

- **Sí: portar 1:1 desde `game.js` de referencia.** Preserva mecánicas y balance ya validados (wall kicks, puntuación, velocidad por nivel) sin reinventar reglas de Tetris.
- **Sí: `EngineSnapshot` con `lines` en vez de `lives`.** Tetris no tiene vidas; forzar el campo del contrato de asteroides sería confuso. El spec 05 ya dejó previsto que el shape del snapshot puede variar por juego.
- **Sí: doble canvas (`board` + `next`) encapsulado en un solo `createEngine`.** Evita dos módulos de motor separados para un mismo juego; el original ya acopla ambos canvas en un solo flujo de dibujo.
- **No: tecla `P` de pausa propia del original.** Se descarta para no duplicar el control de pausa ya expuesto por el botón de React — un solo mecanismo de pausa evita estados desincronizados entre el motor y la UI.
- **No: `theme-toggle` propio del juego (claro/oscuro, `localStorage: tetris-theme`).** La plataforma ya define su propio tema visual (CRT retro); portar un segundo sistema de temas sería inconsistente y redundante.
- **No: overlay interno de "GAME OVER"/"PAUSA" del canvas.** Lo reemplaza el modal de React del sitio, mismo criterio que asteroides en el spec 05.
- **No: categoría SHOOTER o VERSUS.** PUZZLE es la categoría correcta para Tetris dentro de las 4 ya existentes en `CATS`.

## Riesgos identificados

| Riesgo                                                                                                                                                     | Mitigación                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Divergencia de balance al portar `game.js` a TypeScript (ej. wall kicks o `LINE_SCORES` mal transcriptos)                                                  | Portar función por función comparando contra el archivo de referencia; criterios de aceptación específicos de rotación, ghost piece y limpieza de líneas ayudan a detectar desvíos groseros. |
| `requestAnimationFrame` no pausable de forma limpia — el original acumula tiempo en `dropAccum`, que podría saltar de más al reanudar tras una pausa larga | El motor debe resetear su acumulador de tiempo (equivalente a `lastTime`/`dropAccum`) al reanudar, mismo patrón que el spec 05 definió para asteroides.                                      |
| Doble canvas (`board` + `next`) desincronizado si uno se desmonta antes que el otro                                                                        | `destroy()` centraliza la limpieza de ambos canvas; el `useEffect` mount-once de `TetrisGame.tsx` los monta y desmonta juntos.                                                               |
| Fuga de memoria / loop en background si `requestAnimationFrame` no se cancela al salir                                                                     | `destroy()` cancela el loop y remueve listeners de teclado; criterio de aceptación específico verifica que el loop se detiene al salir.                                                      |
| Escalado de dos canvas de tamaños distintos (300×600 y 120×120) en el `crt-screen` responsive                                                              | Mantener el `aspect-ratio` propio de cada canvas vía CSS, sin forzar el mismo contenedor 4:3 que usa asteroides.                                                                             |

## Qué no incluye este spec

- Tema claro/oscuro propio del juego de referencia.
- Tecla `P` de pausa (se usa exclusivamente el botón PAUSA/REANUDAR de React).
- Controles táctiles/móviles.
- Nuevas piezas, sonidos o cambios de dificultad respecto al original.
- Cambios al esquema de Supabase (`games`/`scores`/RLS/trigger) — ya existen del spec 06.

Cada uno de estos, si se necesita, va en un spec futuro.
