# Plantilla de spec — nuevo juego jugable con leaderboard

Esta plantilla especializa el `template.md` genérico de specs del repo (ver
`~/.claude/skills/spec/template.md` si existe) para el caso concreto de "portar/crear
un juego jugable e integrarlo con el leaderboard real de Supabase". No es texto para
copiar literal — es la forma que debe tener el spec resultante. Usa como referencia
directa los specs [05-asteroides-jugable](../../../specs/05-asteroides-jugable.md) y
[06-leaderboard-catalogo-supabase](../../../specs/06-leaderboard-catalogo-supabase.md),
que ya resolvieron este mismo problema para "asteroides".

---

## Header

```markdown
# NN — <Título del juego> jugable

- Estado: Draft
- Fecha: YYYY-MM-DD
- Dependencias: [05-asteroides-jugable](05-asteroides-jugable.md) (patrón de motor +
  reproductor), [06-leaderboard-catalogo-supabase](06-leaderboard-catalogo-supabase.md)
  (tablas `games`/`scores`, RLS, trigger)
- Objetivo: una sola oración. Ej.: "Portar <juego> de references/started-games/<carpeta>
  a un motor TypeScript real, agregarlo al catálogo y hacerlo jugable con leaderboard
  real en Supabase."
```

## Alcance

**Incluye** (adaptar del spec 05, sección por sección):

- Nueva fila en `public.games` (Supabase) — no un array mock — con `id`, `title`,
  `short`, `long`, `cat`, `cover`, `color`; `best_score`/`plays` en `0` (el trigger los
  mantiene).
- Clase CSS `.cover-<slug>` en `app/globals.css`, siguiendo el patrón visual de
  coberturas existentes (gradientes + `::before`/`::after`, sin arte real).
- Puerto/creación del motor en `app/lib/games/<slug>/engine.ts`, exponiendo el mismo
  contrato que `AsteroidesEngine` (`start/stop/reset/getSnapshot/onSnapshotChange/destroy`,
  `EngineSnapshot {score, lives, level, state}` — ajustar campos si el juego no tiene
  vidas/niveles, documentarlo explícitamente).
- Wrapper React `app/juego/<slug>/<Name>Game.tsx` (client component) que monta el/los
  `<canvas>`, corre el loop, captura teclado con `preventDefault`, limpia al desmontar.
- `app/juego/[id]/jugar/GamePlayerClient.tsx` detecta `game.id === "<slug>"` y renderiza
  el componente real en vez de la arena decorativa mock.
- HUD de React sincronizado en vivo vía `onSnapshot`; HUD interno del canvas
  desactivado.
- Pausa real (`stop()`/`start()` del motor) y fin de partida (automático o manual,
  según lo definido en la Fase 1 del skill).
- Guardado real de puntuación: upsert en `scores` (`onConflict: "user_id,game_id"`)
  solo con sesión activa; estado de invitado con link a `/login` (ya implementado de
  forma genérica en `GamePlayerClient.tsx` — no reimplementar, solo verificar que
  sigue aplicando).

**No incluye (fuera de alcance)** — adaptar según el juego, pero como mínimo:

- Cambios a juegos ya existentes en el catálogo — quedan intactos.
- Arquitectura genérica de registro de motores — se especializa solo para
  `id === "<slug>"`, mismo patrón que el spec 05 dejó para "asteroides".
- Controles táctiles/móviles, salvo pedido explícito.
- Modificar el archivo original `references/started-games/<carpeta>/game.js` (si
  aplica) — se lee, no se edita.
- Cambios al esquema de `games`/`scores`/RLS/trigger — ya existen del spec 06.

## Modelo de datos

### Catálogo (`public.games`, INSERT)

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values ('<slug>', '<TÍTULO>', '<short>', '<long>', '<CAT>', 'cover-<slug>', '<color>');
```

### Motor (`app/lib/games/<slug>/engine.ts`)

```ts
export type EngineState = "playing" | "dead" | "gameover"; // ajustar si el juego difiere
export interface EngineSnapshot {
  score: number;
  lives: number; // omitir/ajustar si el juego no tiene vidas
  level: number; // omitir/ajustar si el juego no tiene niveles
  state: EngineState;
}
export interface <Name>Engine {
  start(): void;
  stop(): void;
  reset(): void;
  getSnapshot(): EngineSnapshot;
  onSnapshotChange(cb: (s: EngineSnapshot) => void): () => void;
  destroy(): void;
}
export function createEngine(canvas: HTMLCanvasElement): <Name>Engine;
```

No se agregan tablas nuevas en Supabase — reutiliza `games`/`scores` del spec 06.

## Plan de implementación

Numerado, cada paso deja el sistema funcional (mismo criterio que specs 05/06):

1. **Catálogo**: INSERT en `games` vía Supabase MCP + clase `.cover-<slug>` en
   `app/globals.css`. Sistema funcional: el juego aparece en Biblioteca/home/salón con
   leaderboard vacío, aún sin ser jugable de verdad.
2. **Motor**: crear `app/lib/games/<slug>/engine.ts` (portando `game.js` 1:1 si hay
   referencia, o implementando desde cero). Sistema sigue igual visualmente — módulo
   sin usar todavía.
3. **Componente de juego**: crear el wrapper React. Sistema sigue igual — componente
   sin integrar a `/jugar` todavía.
4. **Integrar en `/jugar`**: rama `game.id === "<slug>"` en `GamePlayerClient.tsx`,
   HUD sincronizado con el snapshot. Sistema funcional: el juego es jugable con
   teclado, HUD real.
5. **Pausa y fin de partida real**: conectar `stop()`/`start()`/`reset()`. Sistema
   funcional de punta a punta.
6. **Verificación funcional final**: `npm run dev`, jugar una partida completa,
   guardar puntuación logueado, confirmar que aparece en `/juego/<slug>` y `/salon`,
   confirmar estado de invitado sin guardado.

## Criterios de aceptación

Checklist booleano — adaptar del spec 05 al juego concreto, como mínimo:

- [ ] `npm run dev` levanta la app sin errores de build/tipo.
- [ ] "<TÍTULO>" aparece en la Biblioteca, filtrable por `<CAT>`, con su cover
      `.cover-<slug>`.
- [ ] `/juego/<slug>` muestra el detalle y el leaderboard real (vacío si aún no hay
      puntuaciones, mensaje "AÚN NO HAY PUNTUACIONES REGISTRADAS — SÉ EL PRIMERO").
- [ ] `/juego/<slug>/jugar` renderiza el canvas jugable real (no la arena decorativa).
- [ ] El HUD de React refleja en vivo el estado real de la partida.
- [ ] No hay HUD duplicado dentro del canvas.
- [ ] PAUSA/REANUDAR detiene y continúa el juego real sin perder estado.
- [ ] El fin de partida (automático o manual, según lo definido) abre el modal
      existente con el puntaje real.
- [ ] Guardar puntuación logueado hace upsert real en `scores` (no crea filas
      duplicadas para el mismo usuario+juego).
- [ ] Jugar sin sesión no permite guardar; muestra el link a `/login`.
- [ ] `games.best_score`/`games.plays` de `<slug>` se actualizan vía trigger tras
      guardar (no se tocan a mano desde el cliente).
- [ ] El archivo `game.js` original (si hubo referencia) permanece sin modificar.

## Decisiones tomadas y descartadas

Reusar/adaptar las decisiones ya validadas en los specs 05 y 06 que apliquen (motor
encapsulado vs. script global, HUD único, trigger SQL vs. update en cliente, etc.);
agregar solo las decisiones nuevas específicas de este juego.

## Riesgos identificados

Adaptar del spec 05 los riesgos que apliquen (fuga de memoria del loop, listeners
globales, escalado de canvas, divergencia de balance al portar); agregar riesgos
propios del juego si los hay.
