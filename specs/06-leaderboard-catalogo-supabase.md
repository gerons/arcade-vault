# 06 — Leaderboard y catálogo de juegos en Supabase

- Estado: Aprobado
- Fecha: 2026-07-22
- Dependencias: [04-auth-supabase](04-auth-supabase.md) (sesión real de Supabase, `AuthUser`), [05-asteroides-jugable](05-asteroides-jugable.md) (único juego con score real hoy)
- Objetivo: Reemplazar el catálogo mock `GAMES` y las puntuaciones simuladas (`seededScores`, `localStorage av_scores`) por dos tablas reales en Supabase (`games` y `scores`) con mejor puntuación/plays actualizados por trigger, consumidas por la Biblioteca, el detalle de juego y el Salón de la Fama, con guardado de puntuación real solo para usuarios con sesión.

## Alcance

### Incluye

- Migración de Supabase que crea la tabla `games` (reemplaza el array mock `GAMES`) y la tabla `scores` (reemplaza `seededScores`/`localStorage av_scores`), con RLS habilitada en ambas.
- Seed de los 9 juegos actuales (`app/lib/data.ts` → `GAMES`) como `INSERT` dentro de la propia migración, con `best_score`/`plays` en `0` salvo que ya existan datos reales que migrar (no aplica: hoy los scores reales son solo locales del navegador de prueba, no se migran).
- Trigger SQL `AFTER INSERT OR UPDATE ON scores` que actualiza `games.best_score` (si el nuevo score es mayor al actual) y `games.plays` (incrementa en cada guardado exitoso).
- `scores` como upsert por `(user_id, game_id)`: guardar una puntuación nueva solo reemplaza la fila existente si supera la marca previa del mismo usuario en ese juego; si no la supera, la fila no cambia pero la UI igual confirma "PUNTUACIÓN GUARDADA" (mismo feedback que hoy).
- `app/lib/data.ts`: se elimina el array mock `GAMES`, `PLAYERS` y `seededScores()`; se agregan funciones de acceso a datos (`getGames()`, `getGame(id)`, `getLeaderboard(gameId)`) que consultan Supabase. El tipo `Game` se ajusta a las columnas reales de la tabla.
- `app/games/page.tsx`, `app/page.tsx` (preview de juegos) y `app/juego/[id]/page.tsx` pasan a consultar `games`/`scores` reales vía Server Components (cliente de servidor de Supabase ya creado en el spec 04), en vez del array `GAMES` en memoria.
- `app/juego/[id]/page.tsx`: el leaderboard lateral ("MEJORES PUNTUACIONES") muestra las filas reales de `scores` para ese juego ordenadas por puntaje; si no hay filas, estado vacío "AÚN NO HAY PUNTUACIONES REGISTRADAS — SÉ EL PRIMERO".
- `app/salon/page.tsx`: se adapta para leer juegos y puntuaciones reales de Supabase por pestaña (Server Component para la carga inicial + fetch cliente al cambiar de pestaña, usando el cliente de browser de Supabase); mismo estado vacío que el detalle cuando un juego no tiene puntuaciones.
- `app/juego/[id]/jugar/page.tsx`: `saveScore()` deja de escribir en `localStorage` y hace upsert real en `scores` (`user_id`, `game_id`, `score`, `player_name` = `user.username`) solo cuando hay sesión activa.
- Estado sin sesión en el modal de fin de partida: el input de nombre y el botón "GUARDAR PUNTUACIÓN" se reemplazan por el mensaje "INICIÁ SESIÓN PARA GUARDAR TU PUNTUACIÓN" con link a `/login`; el resto del modal (puntaje final, "JUGAR DE NUEVO", "VOLVER AL VAULT") sigue igual.
- RLS de `scores`: cualquiera (incluso anónimo) puede `SELECT` (leaderboard público); solo el propio usuario autenticado puede `INSERT`/`UPDATE` su fila (`user_id = auth.uid()`). RLS de `games`: `SELECT` público para todos; sin `INSERT`/`UPDATE`/`DELETE` desde el cliente (solo vía migración/trigger).

### No incluye (fuera de alcance)

- Guardado de score real para juegos que no sean "asteroides" — el resto del catálogo sigue siendo maqueta; su botón FIN (donde exista) no llega a llamar `saveScore()` con datos reales porque no hay motor real detrás. Sus filas en `scores` quedan vacías hasta que un spec futuro los porte (mismo patrón que el spec 05).
- Historial de partidas por usuario — no se guarda cada partida jugada, solo la mejor marca por usuario y juego (upsert, sin tabla de historial).
- Perfil de usuario / edición de `username` post-registro — se sigue usando el `username` fijado en el signup (spec 04), sin pantalla nueva de perfil.
- Guardado de puntuación para invitados (sin sesión) — decisión explícita de este spec: sin sesión no hay escritura en `scores`, ni fallback a `localStorage`.
- Paginación del leaderboard — se listan como máximo las filas que ya se mostraban hoy (10–12), sin scroll infinito ni paginación real.
- Edge Functions o Realtime para el leaderboard (actualización en vivo entre pestañas) — queda como trabajo futuro explícito, mencionado también como pendiente en el spec 04.
- Borrado o edición de una puntuación ya guardada — no hay UI ni política RLS para `DELETE`/editar manualmente una fila de `scores`.

## Modelo de datos

### Tabla `games` (Supabase, `public.games`)

```sql
create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'green', 'yellow')),
  best_score integer not null default 0,
  plays integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games are publicly readable"
  on public.games for select
  using (true);
-- sin policies de insert/update/delete: solo se modifican vía migración o el trigger (security definer)
```

### Tabla `scores` (Supabase, `public.scores`)

```sql
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  player_name text not null,
  score integer not null check (score >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, game_id)
);

alter table public.scores enable row level security;

create policy "scores are publicly readable"
  on public.scores for select
  using (true);

create policy "users can upsert their own score"
  on public.scores for insert
  with check (auth.uid() = user_id);

create policy "users can update their own score"
  on public.scores for update
  using (auth.uid() = user_id);
```

### Trigger: actualizar `best_score` y `plays` en `games`

```sql
create function public.handle_score_upsert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.games
  set
    best_score = greatest(best_score, new.score),
    plays = plays + 1
  where id = new.game_id;
  return new;
end;
$$;

create trigger on_score_upsert
  after insert or update on public.scores
  for each row
  execute function public.handle_score_upsert();
```

`security definer` es necesario porque el usuario autenticado no tiene policy de `UPDATE` sobre `games` (solo lectura pública); el trigger corre con privilegios del dueño de la función para poder actualizar `best_score`/`plays` igualmente.

### Cambios en TypeScript (`app/lib/data.ts`)

Se elimina el array `GAMES`, `PLAYERS` y `seededScores()`. El tipo `Game` pasa a reflejar las columnas reales:

```ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "green" | "yellow";
  best_score: number;
  plays: number;
}

export interface ScoreRow {
  player_name: string;
  score: number;
  updated_at: string; // ISO
}
```

Nuevas funciones de acceso a datos (Server Components, cliente de servidor de Supabase del spec 04):

```ts
export async function getGames(): Promise<Game[]>;
export async function getGame(id: string): Promise<Game | null>;
export async function getLeaderboard(
  gameId: string,
  limit?: number,
): Promise<ScoreRow[]>;
```

No se introduce ninguna tabla nueva de perfiles: `player_name` se guarda denormalizado en `scores` a partir de `user.username` (`AuthUser`, spec 04) en el momento del guardado, para evitar tener que exponer/joinear `auth.users` desde el cliente.

## Plan de implementación

1. **Migración de base de datos**: crear la migración de Supabase con las tablas `games` y `scores`, sus policies RLS, la función `handle_score_upsert()` y el trigger `on_score_upsert`, más los 9 `INSERT` de seed con los datos actuales de `GAMES` (`best_score: 0`, `plays: 0`). Aplicar con `apply_migration`. Sistema sigue igual visualmente — la app todavía usa el array mock, la tabla ya existe pero no se consume.

2. **Actualizar `app/lib/data.ts`**: eliminar `GAMES`, `PLAYERS`, `seededScores()`; ajustar el tipo `Game` a `best_score`/`plays`; agregar `getGames()`, `getGame(id)`, `getLeaderboard(gameId, limit)` usando el cliente de servidor de Supabase (`app/lib/supabase/server.ts`, spec 04). Sistema queda roto temporalmente para las páginas que aún importan `GAMES` — se resuelve en los pasos siguientes del mismo commit lógico.

3. **Biblioteca y home** (`app/games/page.tsx`, `app/page.tsx`): reemplazar el uso de `GAMES` por `await getGames()` (Server Components). Sistema queda funcional: Biblioteca y home muestran el catálogo real desde Supabase, filtrable por categoría igual que antes.

4. **Detalle de juego** (`app/juego/[id]/page.tsx`): reemplazar `GAMES.find` por `await getGame(id)` y `seededScores(...)` por `await getLeaderboard(id, 10)`; agregar estado vacío "AÚN NO HAY PUNTUACIONES REGISTRADAS — SÉ EL PRIMERO" cuando el arreglo devuelto está vacío. Sistema queda funcional: cada juego muestra su leaderboard real (vacío salvo asteroides tras el paso 6).

5. **Salón de la Fama** (`app/salon/page.tsx`): dividir en un Server Component que hace `await getGames()` para las pestañas y un subcomponente cliente (`HallOfFameTabs`, mismo archivo o uno nuevo) que, al cambiar de pestaña, consulta `getLeaderboard` vía el cliente de browser de Supabase (`app/lib/supabase/client.ts`, spec 04); mismo estado vacío del paso 4 cuando el juego seleccionado no tiene puntuaciones. El bloque "TU MEJOR MARCA" se calcula filtrando el leaderboard por `user.id` en vez de la fórmula mock actual. Sistema queda funcional: Salón muestra rankings reales.

6. **Guardado real de puntuación** (`app/juego/[id]/jugar/page.tsx`): `saveScore()` deja de escribir en `localStorage` y llama a un upsert real (`supabase.from("scores").upsert({ user_id: user.id, game_id: game.id, player_name: user.username, score })` con `onConflict: "user_id,game_id"`) usando el cliente de browser; el input de nombre se elimina (el nombre siempre es `user.username`). Cuando `user` es `null`, el modal muestra el mensaje "INICIÁ SESIÓN PARA GUARDAR TU PUNTUACIÓN" con link a `/login` en vez del input/botón de guardado. Sistema queda funcional de punta a punta: jugar asteroides con sesión activa guarda la puntuación real, que aparece en el detalle del juego y en el Salón de la Fama.

7. **Verificación funcional final**: `npm run dev`; confirmar que la Biblioteca y el home listan los 9 juegos reales desde Supabase; jugar "ASTEROIDES" logueado, guardar puntuación, y verificar que aparece en `/juego/asteroides` y en `/salon` (pestaña ASTEROIDES); jugar de nuevo con un puntaje menor y confirmar que `best_score`/leaderboard no bajan (upsert respeta el máximo); repetir con un puntaje mayor y confirmar que sí se actualiza; verificar que `plays` se incrementó tras cada guardado (consultando la tabla); jugar como invitado y confirmar que el modal no permite guardar y muestra el link a `/login`; revisar que un juego mock (ej. `bloque-buster`) muestra el estado vacío tanto en su detalle como en el Salón.

## Criterios de aceptación

- [ ] `npm run dev` levanta la app sin errores de build/tipo.
- [ ] Las tablas `games` y `scores` existen en Supabase con RLS habilitada y las policies descritas.
- [ ] La migración pobló `games` con los 9 juegos actuales (mismos `id`, `title`, `short`, `long`, `cat`, `cover`, `color`), `best_score: 0` y `plays: 0`.
- [ ] `/` (home) y `/games` (Biblioteca) listan los juegos leídos desde Supabase, filtrables por categoría igual que antes.
- [ ] `app/lib/data.ts` ya no exporta `GAMES`, `PLAYERS` ni `seededScores`.
- [ ] `/juego/[id]` muestra el leaderboard real del juego (filas de `scores`, ordenadas por puntaje); si no hay filas, muestra "AÚN NO HAY PUNTUACIONES REGISTRADAS — SÉ EL PRIMERO".
- [ ] `/salon` muestra las mismas pestañas de juegos reales, y el ranking de cada pestaña refleja `scores` reales (o el estado vacío si no hay datos).
- [ ] Jugar "ASTEROIDES" logueado, perder la partida y presionar "GUARDAR PUNTUACIÓN" inserta/actualiza una fila real en `scores` con `player_name = user.username`, sin usar `localStorage`.
- [ ] Tras guardar, `games.best_score` para "asteroides" refleja el máximo entre el valor anterior y el nuevo puntaje (no baja si el nuevo puntaje es menor).
- [ ] Tras guardar, `games.plays` para "asteroides" se incrementó en 1 respecto al valor previo.
- [ ] El puntaje guardado aparece reflejado en `/juego/asteroides` (leaderboard) y en `/salon` (pestaña ASTEROIDES) sin recargar manualmente datos hardcodeados.
- [ ] Guardar dos veces con el mismo usuario en el mismo juego no crea una segunda fila (upsert por `user_id + game_id`; se verifica contando filas en `scores`).
- [ ] Jugar "ASTEROIDES" sin sesión (invitado) y llegar al modal de fin de partida: no aparece input de nombre ni botón "GUARDAR PUNTUACIÓN"; aparece el mensaje con link a `/login`.
- [ ] Un juego mock (ej. `bloque-buster`) sin puntuaciones reales muestra el estado vacío tanto en su detalle como en `/salon`.
- [ ] Un usuario sin sesión puede leer `/juego/[id]` y `/salon` con normalidad (RLS de `SELECT` pública, sin necesidad de estar logueado para ver rankings).
- [ ] Intentar insertar una fila en `scores` con un `user_id` distinto al del usuario autenticado falla por RLS (verificable con una query manual o revisión de policies).

## Decisiones tomadas y descartadas

- **Un solo spec para catálogo (`games`) y puntuaciones (`scores`) en vez de dos specs separados**: se descarta dividir porque el usuario prefirió avanzar con ambas tablas juntas; quedan documentadas como dos tablas independientes dentro del mismo plan de implementación incremental (paso a paso, sistema funcional en cada uno).
- **`best_score`/`plays` actualizados por trigger SQL (`security definer`) en vez de cálculo en el cliente**: se descarta hacer un segundo `update` desde Next.js tras guardar el score, para evitar condiciones de carrera entre usuarios concurrentes guardando al mismo tiempo; el trigger centraliza la lógica en la base de datos.
- **`scores` como upsert por `(user_id, game_id)` en vez de historial completo**: se descarta guardar cada partida jugada; solo interesa la mejor marca de cada usuario por juego, igual que el leaderboard mock actual (un jugador, una entrada). Simplifica la query del leaderboard (sin `GROUP BY`/`MAX`).
- **Solo usuarios con sesión pueden guardar puntuación, sin fallback a `localStorage` para invitados**: se descarta mantener un sistema paralelo de puntuaciones locales; simplifica el modelo (una sola fuente de verdad) a costa de que los invitados no puedan competir en el leaderboard real, mismo trade-off que el spec 04 dejó abierto para resolver acá.
- **`player_name` denormalizado en `scores` en vez de join contra `auth.users`**: se descarta exponer `auth.users` (o crear una tabla `profiles` nueva) porque el `username` ya vive en `user_metadata` (spec 04) y solo se necesita en el momento de guardar; evita una tabla adicional para este spec.
- **Server Components para lectura, cliente de browser solo para el guardado y el cambio de pestaña en `/salon`**: se descarta hacer todo client-side por rendimiento (menos JS enviado, datos ya resueltos en el HTML inicial) y todo server-side porque `/salon` necesita interactividad (cambio de pestaña) y el guardado ocurre tras una acción del usuario en el cliente.
- **Estado vacío real para juegos sin puntuaciones en vez de seed de datos ficticios**: se descarta insertar filas de ejemplo con nombres falsos (como hacía `seededScores`) porque mezclaría datos reales y falsos de forma indistinguible para el usuario; el estado vacío dice explícitamente que un juego mock/todavía-no-jugable no tiene datos.
- **Sin paginación ni historial de partidas**: se descartan ambos para mantener el spec enfocado en reemplazar el mock por datos reales equivalentes; quedan como trabajo futuro si el volumen de puntuaciones lo justifica.

## Riesgos identificados

- **Trigger `security definer` con permisos amplios**: al correr con privilegios elevados, un bug en `handle_score_upsert()` (ej. un `where` mal escrito) podría modificar filas de `games` de forma incorrecta y silenciosa. Mitigación: función acotada a un solo `update` con `where id = new.game_id`, cubierta por los criterios de aceptación que verifican `best_score`/`plays` tras guardar.
- **Upsert sin transacción explícita entre `scores` y el trigger**: si el trigger fallara a mitad de camino, Postgres revierte el `insert`/`update` completo (transacción implícita), pero un error de sintaxis en el trigger dejaría el guardado de puntuación totalmente roto para todos los usuarios. Mitigación: probar el trigger manualmente en el paso 1 del plan antes de conectar la UI (paso 6).
- **`player_name` desincronizado si el usuario cambia su `username` a futuro**: como se denormaliza en `scores` al momento de guardar, un cambio posterior de `username` (fuera de alcance de este spec) no se reflejaría retroactivamente en puntuaciones ya guardadas. Mitigación: aceptado explícitamente; no hay pantalla de edición de perfil todavía, así que el caso no es alcanzable hoy.
- **RLS mal configurada permitiendo a un usuario pisar la puntuación de otro**: si la policy de `update` no filtrara correctamente por `auth.uid() = user_id`, cualquier usuario logueado podría sobrescribir la fila de otro. Mitigación: criterio de aceptación específico que verifica el rechazo por RLS con un `user_id` ajeno.
- **`/salon` mezclando Server Component (carga inicial) y cliente (cambio de pestaña) puede generar un parpadeo o desajuste de datos** si el fetch inicial del servidor no coincide en forma con el fetch del cliente. Mitigación: ambos usan la misma función `getLeaderboard()` (o su equivalente en el cliente de browser) con el mismo shape de retorno, minimizando divergencia.
- **Migración de catálogo con `id` como texto libre en vez de `uuid`**: mantener `id` como `text` (mismo valor que hoy, ej. `"asteroides"`) es intencional para no romper rutas existentes (`/juego/asteroides`), pero deja la clave primaria sin validación de formato. Mitigación: aceptado, es el mismo esquema de IDs que ya usa toda la app (rutas, `localStorage` histórico); no se detectaron colisiones posibles ya que los 9 IDs son fijos y conocidos.
