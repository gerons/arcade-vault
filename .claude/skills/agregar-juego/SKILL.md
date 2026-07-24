---
name: agregar-juego
description: Agrega un juego jugable con su leaderboard a Arcade Vault. Primero genera un spec (estilo spec-driven, especializado desde los specs 05 y 06), y tras aprobación implementa el motor, el wrapper React, el wiring del reproductor, el CSS de portada y la fila en Supabase. Úsalo para portar un juego de references/started-games o crear uno nuevo desde cero.
disable-model-invocation: true
argument-hint: "<slug> (ej. tetris) — opcional: nombre/carpeta en references/started-games"
---

# /agregar-juego — Portar o crear un juego jugable con leaderboard

Este skill reproduce, para un juego nuevo, el patrón que los specs
[05-asteroides-jugable](../../../specs/05-asteroides-jugable.md) y
[06-leaderboard-catalogo-supabase](../../../specs/06-leaderboard-catalogo-supabase.md)
establecieron juntos: motor TypeScript encapsulado, wrapper React de canvas, wiring en
el reproductor (`GamePlayerClient.tsx`), y persistencia real de puntuaciones en
Supabase (`games` + `scores`, con RLS y trigger ya existentes).

Sigue el método spec-driven del repo (mismo espíritu que `/spec` y `/spec-impl`):
**primero un spec, después código.** No saltear la fase de spec aunque el usuario pida
ir rápido — recuérdaselo, y si insiste, igual escribe el spec (puede ser breve) antes
de tocar código.

Lee siempre `patterns.md` (misma carpeta que este archivo) antes de escribir código —
contiene los fragmentos canónicos exactos a replicar. Antes de escribir el archivo de
spec (Fase 2), lee **la skill `/spec`** (`~/.claude/skills/spec/SKILL.md` y su
`~/.claude/skills/spec/template.md`, si existen en el sistema) — es la fuente de
verdad del método spec-driven de este repo (fases, formato de header, orden de
secciones, tono al hacer preguntas) y `spec-template.md` (misma carpeta que este
archivo) la especializa para el caso concreto de "juego + leaderboard". Usar ambas
juntas: la skill `/spec` manda en estructura/proceso, `spec-template.md` manda en
contenido específico del patrón asteroides/leaderboard. Si la skill `/spec` no existe
en el sistema, seguir solo `spec-template.md` y avisar de la ausencia.

## Fase 0 — Contexto

1. Leer `CLAUDE.md`/`AGENTS.md` del repo (ya lo tienes en el contexto de sesión
   normalmente). Recordar la regla del proyecto: este Next.js tiene breaking changes
   respecto al training data — si vas a tocar convenciones de rutas/Server Components
   dudosas, revisa `node_modules/next/dist/docs/` antes de escribir código nuevo.
2. Listar `specs/` para determinar el próximo número secuencial (`NN`).
3. Releer los specs 05 y 06 completos si no están ya en contexto — son la fuente de
   verdad del patrón.
4. Determinar el slug del juego a partir de `$ARGUMENTS`. Si `$ARGUMENTS` es vacío,
   preguntar.
5. Revisar `references/started-games/`. Si existe una carpeta que coincide (por nombre
   o por pedido explícito del usuario) con el slug/tema pedido, leer su `game.js`
   completo, su `README.md` y su `index.html` — esa lectura alimenta la Fase 1 y el
   contrato del motor a portar. Si no hay carpeta de referencia, el juego se diseña
   desde cero (igual se sigue el mismo contrato de motor).
6. Confirmar en `app/lib/data.ts` y en la migración de Supabase (`mcp__supabase__list_tables`
   / `list_migrations` si hace falta refrescar memoria) que `games`/`scores` siguen
   con el esquema del spec 06 sin cambios. Si detectas una migración distinta a la
   documentada en `patterns.md`, avisa antes de continuar — el patrón podría estar
   desactualizado.

## Fase 1 — Preguntas (un solo bloque)

Antes de escribir el spec, resolvé lo que no se pueda inferir de la Fase 0. Preguntá
en un bloque único (no una por una):

1. **Origen**: ¿se porta 1:1 desde `references/started-games/<carpeta>/game.js`, o se
   construye un motor nuevo desde cero? (si la Fase 0 ya encontró una carpeta que
   calza, proponela como default y pedí confirmación).
2. **Identidad del juego**: `id` (slug, mismo valor en URL/DB/discriminador),
   `title`, `cat` (`ARCADE`|`PUZZLE`|`SHOOTER`|`VERSUS`), `color`
   (`cyan`|`magenta`|`green`|`yellow`).
3. **Descripción**: `short` (una línea) y `long` (párrafo), en el mismo tono que el
   resto del catálogo (ver `app/lib/data.ts` histórico / specs anteriores para tono).
4. **Controles y canvas**: teclas usadas, tamaño de canvas interno (asteroides usa
   800×600; tetris de referencia usa 300×600 + preview 120×120 — puede variar por
   juego). Si el juego de referencia usa doble canvas (ej. tetris con "next piece"),
   anotarlo — el wrapper React deberá montar ambos.
5. **Condición de fin de partida**: qué dispara `state: "gameover"` en el snapshot
   (vidas en 0, como asteroides; o "board lleno", "game over" propio del original,
   etc.), y si hay botón FIN manual o es 100% automático.

No avances a la Fase 2 sin tener respuesta a las 5.

## Fase 2 — Escribir el spec

1. **Leer la skill `/spec` antes de escribir nada.** Buscar y leer
   `~/.claude/skills/spec/SKILL.md` (y su `template.md` en la misma carpeta). Esa
   skill define el método spec-driven de este repo: formato del header
   (`Estado`/`Fecha`/`Dependencias`/`Objetivo` en una sola oración), el orden de
   secciones (Alcance → Modelo de datos → Plan de implementación → Criterios de
   aceptación → Decisiones → Riesgos), la regla de "una sección a la vez con
   confirmación" si estás en modo conversacional con el usuario, y el tono al hacer
   preguntas (directo, numerado, sin rodeos). Si el usuario ya respondió todo en la
   Fase 1, no hace falta repetir la conversación sección por sección — pero la
   **estructura y el formato** del spec resultante deben coincidir con los que define
   `/spec`, no improvisar un formato distinto.
2. Usar `spec-template.md` (misma carpeta que este archivo) como el contenido
   específico a volcar dentro de esa estructura — ya trae las secciones propias de
   este patrón (motor, wrapper, wiring, Supabase, cover CSS) derivadas de los specs 05
   y 06.
3. Determinar el slug de archivo: `specs/NN-<slug-descriptivo>.md` (numeración
   secuencial de la Fase 0, mismo criterio de numeración que usa `/spec`).
4. Completar el spec sección por sección con los datos de la Fase 1 y lo relevado en
   la Fase 0 (si hay `game.js` de referencia, documentar sus clases/funciones/
   constantes a portar, igual que hizo el spec 05 con `references/started-games/02-asteroids/game.js`).
5. Guardar con **Estado: Draft** (o el equivalente que use `/spec` en este repo si
   difiere).
6. Si `/spec` documenta un archivo de configuración tipo `specs/.spec-config.yml` y no
   existe todavía, seguí lo que indique esa skill al respecto (crearlo con sus
   defaults) en vez de improvisar.
7. Mostrar el spec al usuario y **detenerse**. No implementar todavía. Pedile que lo
   revise y lo pase a **Aprobado** cuando esté conforme (mismo flujo que `/spec` +
   `/spec-impl` del repo).

## Fase 3 — Implementar (solo tras aprobación explícita)

No arranques esta fase hasta que el usuario confirme que el spec quedó en estado
`Aprobado` (o equivalente explícito: "dale, implementalo", "aprobado", etc.). Si no
hay confirmación clara, preguntá antes de tocar código.

1. (Opcional, preguntar primero) Crear y cambiar a un branch `spec-NN-<slug>`, salvo
   que `specs/.spec-config.yml` diga `AutoCreateBranch: false` (en ese caso, pedir
   confirmación) o el archivo no exista (default `true`, crear sin preguntar).
2. Seguir `patterns.md` paso a paso, en este orden (cada paso deja el sistema
   funcional, mismo criterio que el plan de implementación del spec):
   - Motor (`app/lib/games/<slug>/engine.ts`).
   - Wrapper React (`app/juego/<slug>/<Name>Game.tsx`).
   - Wiring en `app/juego/[id]/jugar/GamePlayerClient.tsx` (rama `is<Slug>`).
   - CSS de portada `.cover-<slug>` en `app/globals.css`.
   - Migración Supabase: `mcp__supabase__apply_migration` con el `insert into games`
     del nuevo juego (ver plantilla en `patterns.md`). No tocar el esquema de
     `games`/`scores`/trigger — ya existen del spec 06.
3. Verificar: `npm run dev`, jugar el juego nuevo desde la Biblioteca, confirmar HUD en
   vivo, pausa real, fin automático, guardado de puntuación logueado (aparece en
   `/juego/<slug>` y en `/salon`), y estado de invitado sin guardado.
4. Actualizar el spec a **Estado: Implementado** (mismo criterio que el spec 06).
5. Confirmar que el `game.js` original en `references/started-games/` (si lo hubo)
   sigue intacto — no se edita nunca.

## Reglas duras

- **Nunca implementar sin spec aprobado.** Si el usuario pide saltar directo a código,
  recordá el costo de un spec vago y ofrecé escribir uno breve igual.
- **Nunca escribir el archivo de spec sin antes leer la skill `/spec`.** Es la
  referencia de estructura/formato/proceso spec-driven de este repo; `spec-template.md`
  solo aporta el contenido específico del patrón juego+leaderboard.
- **Nunca editar el `game.js` original** de `references/started-games/` — se lee como
  referencia, no se modifica ni se borra.
- **El slug es la única clave** compartida entre `games.id` (DB), la ruta `/juego/[id]`,
  y el discriminador `game.id === "<slug>"` en `GamePlayerClient.tsx`.
- **No tocar** `app/page.tsx`, `app/games/page.tsx`, `app/salon/page.tsx`, ni
  `app/juego/[id]/page.tsx` — todos iteran `getGames()`/`getLeaderboard()` de forma
  genérica y ya soportan cualquier juego nuevo sin cambios.
- **No modificar** el esquema de `games`/`scores`, sus policies RLS, ni el trigger
  `handle_score_upsert` — ya existen del spec 06; esta skill solo agrega una fila.
- Responder siempre en el mismo idioma del pedido del usuario (este repo es en
  español, pero seguí la convención de `/spec`: igualar el idioma del prompt inicial).
