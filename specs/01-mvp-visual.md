# 01 — MVP Visual Arcade Vault

- Estado: Aprobado
- Fecha: 2026-07-13
- Dependencias: ninguna (primer spec del proyecto)
- Objetivo: Implementar la interfaz visual completa de Arcade Vault (biblioteca, detalle de juego, reproductor, login, salón de la fama) migrando los templates de referencia a rutas reales de Next.js 16 con datos mock, sin implementar lógica de ningún juego.

## Alcance

### Incluye
- Migración de `references/resources/templates/styles.css` → ya integrado en `app/globals.css` (verificar completitud, no reescribir).
- Datos mock: `GAMES`, `CATS`, `PLAYERS`, `seededScores()` migrados a un archivo TS (`app/lib/data.ts`).
- Componente `Nav` compartido (desktop + menú móvil hamburguesa), con contador de créditos fijo ("CRÉDITOS · 03").
- Pantalla **Biblioteca** (`/`): hero, buscador, filtro por categoría (chips), grid de `GameCard` con tilt on hover, estado "sin resultados".
- Pantalla **Detalle de juego** (`/juego/[id]`): cover, tags, descripción, estadísticas, botón jugar/volver, leaderboard lateral con `seededScores`.
- Pantalla **Reproductor** (`/juego/[id]/jugar`): HUD (jugador, puntuación, vidas, nivel), pantalla CRT con arena visual estática, botones Pausa/Fin/Salir, modal de fin de juego con input de iniciales y botón guardar puntuación — **todo maqueta, sin lógica de juego ni setInterval de puntuación**.
- Pantalla **Login** (`/login`): tabs iniciar sesión / crear cuenta, formulario, botón invitado, botones sociales decorativos (sin OAuth real).
- Pantalla **Salón de la Fama** (`/salon`): tabs por juego, podio top 3, tabla de ranking, fila "tu mejor marca" si hay sesión.
- Persistencia mock vía `localStorage`: sesión de usuario (`av_user`) y puntuaciones guardadas (`av_scores`), igual que el template.
- Enrutamiento con App Router real (`next/link`, `useRouter`), reemplazando el patrón hash+estado del template.

### No incluye (fuera de alcance)
- Lógica real de cualquier juego (Bloque Buster, Caída, Serpentina, etc.) — la arena del reproductor es decorativa/estática.
- Autenticación real (backend, validación de contraseña, OAuth funcional con Google/GitHub).
- Sistema de créditos funcional (compra, consumo, etc.) — solo texto fijo.
- Persistencia en base de datos o backend — solo `localStorage`.
- Tests automatizados (no se pide en este spec).
- Accesibilidad avanzada / i18n más allá del español ya presente en los templates.

## Modelo de datos

Archivo `app/lib/data.ts` (migrado de `data.jsx`, tipado en TS):

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;          // slug, ej. "bloque-buster"
  title: string;
  short: string;        // descripción corta (card)
  long: string;          // descripción larga (detalle)
  cat: GameCategory;
  cover: string;         // clase CSS de fondo, ej. "cover-bricks"
  color: "cyan" | "magenta" | "green" | "yellow";
  best: number;          // mejor puntuación global (mock)
  plays: string;         // ej. "12.4K"
}

export const GAMES: Game[];               // 8 juegos, igual contenido que el template
export const CATS: string[];              // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export const PLAYERS: string[];           // 18 nombres mock

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/yyyy
}

export function seededScores(seed: number, count?: number): ScoreRow[];
```

Estructuras en `localStorage` (sin cambios respecto al template):

- `av_user`: `{ name: string } | null`
- `av_scores`: `Array<{ game: string; score: number; name: string; at: number }>`

Tipo de sesión compartido (ej. en `app/lib/types.ts` o junto a `data.ts`):

```ts
export interface AuthUser { name: string }
```

## Plan de implementación

1. **Datos y tipos**: crear `app/lib/data.ts` con `GAMES`, `CATS`, `PLAYERS`, `seededScores()` y tipos (`Game`, `GameCategory`, `ScoreRow`, `AuthUser`) migrados de `data.jsx`. Sistema queda igual, solo se agregan datos sin uso aún.

2. **Sesión mock compartida**: crear un hook/contexto cliente (ej. `app/lib/useAuth.ts` o `AuthProvider` en `app/providers.tsx`) que lea/escriba `av_user` en `localStorage` y exponga `user`, `login(user)`, `signOut()`. Se monta en `app/layout.tsx`.

3. **Nav compartido**: crear `app/components/Nav.tsx` (client component) migrado de `nav.jsx`, usando `usePathname`/`next/link` en vez de `route`/`navigate` por props, consumiendo la sesión del paso 2. Incluye menú móvil hamburguesa y contador de créditos fijo. Se integra en `app/layout.tsx` junto con el footer (migrado de `app.jsx`). Sistema queda funcional: nav visible en todas las páginas, sin pantallas propias todavía.

4. **Biblioteca (`/`)**: reemplazar `app/page.tsx` con la migración de `biblioteca.jsx` (hero, búsqueda, chips de categoría, grid de `GameCard` con tilt, estado vacío). Navegación a detalle vía `next/link` a `/juego/[id]`.

5. **Detalle de juego (`/juego/[id]`)**: crear `app/juego/[id]/page.tsx` migrado de `detalle.jsx`. Usa `GAMES.find` y `seededScores` para el leaderboard lateral. Link a jugar (`/juego/[id]/jugar`) y volver (`/`). Manejar `id` inexistente con `notFound()`.

6. **Reproductor (`/juego/[id]/jugar`)**: crear `app/juego/[id]/jugar/page.tsx` migrado de `reproductor.jsx` como maqueta estática: HUD con valores fijos/demo, arena CRT decorativa sin animación de puntuación, botones Pausa/Fin que solo alternan estado visual (abren modal de fin), modal con input de iniciales que al "guardar" escribe en `av_scores` vía `localStorage` (sin lógica de juego real).

7. **Login (`/login`)**: crear `app/login/page.tsx` migrado de `auth.jsx`, con tabs iniciar sesión/crear cuenta, botón invitado y botones sociales decorativos. Al enviar, llama al hook de sesión (paso 2) y redirige a `/`.

8. **Salón de la Fama (`/salon`)**: crear `app/salon/page.tsx` migrado de `salon.jsx`, con tabs por juego, podio y tabla usando `seededScores`, más fila "tu mejor marca" si hay sesión activa.

9. **Verificación visual final**: recorrer las 5 pantallas en `npm run dev`, confirmar navegación entre todas, persistencia de sesión/puntuación tras recargar, y paridad visual con los templates (`Arcade Vault.html` como referencia).

## Criterios de aceptación

- [ ] `npm run dev` levanta la app sin errores de build/tipo.
- [ ] `/` muestra la Biblioteca: hero, buscador funcional (filtra por texto), chips de categoría funcionales, grid de juegos con los 8 `GAMES`.
- [ ] Buscar un término sin resultados muestra el estado "NO HAY RESULTADOS".
- [ ] Click en una `GameCard` o su botón "JUGAR" navega a `/juego/[id]` con el juego correcto.
- [ ] `/juego/[id]` muestra cover, descripción larga, estadísticas y leaderboard con 10 filas generadas por `seededScores`.
- [ ] Botón "JUGAR AHORA" navega a `/juego/[id]/jugar`; botón "VOLVER AL VAULT" navega a `/`.
- [ ] `/juego/[id]/jugar` muestra HUD, arena CRT y botones Pausa/Fin/Salir sin lanzar ninguna lógica de juego (sin incremento automático de puntuación).
- [ ] Botón "FIN" abre el modal de fin de juego con input de iniciales.
- [ ] Guardar puntuación en el modal escribe una entrada en `localStorage` bajo `av_scores` y muestra el toast "PUNTUACIÓN GUARDADA".
- [ ] Botón "SALIR" en el reproductor navega de vuelta a `/juego/[id]`.
- [ ] `/login` permite alternar entre tabs "Iniciar sesión"/"Crear cuenta", enviar el formulario guarda `av_user` en `localStorage` y redirige a `/`.
- [ ] Botón "JUGAR COMO INVITADO" en `/login` inicia sesión con usuario nulo y redirige a `/`.
- [ ] Con sesión activa, el Nav muestra el nombre de usuario en vez de "Iniciar Sesión"; al cerrar sesión vuelve al estado sin usuario.
- [ ] `/salon` muestra tabs por juego, podio top 3 y tabla de ranking que cambian al seleccionar otro juego.
- [ ] Con sesión activa, `/salon` muestra la fila "tu mejor marca" para el juego seleccionado; sin sesión, no aparece.
- [ ] Recargar la página (F5) conserva la sesión y las puntuaciones guardadas (persistencia real en `localStorage`).
- [ ] El menú hamburguesa móvil abre/cierra el panel lateral y navega correctamente en viewport angosto.
- [ ] Ningún juego tiene lógica jugable real (todo lo dentro de `/jugar` es estático/decorativo).

## Decisiones tomadas y descartadas

- **Rutas reales de Next.js en vez de hash+estado**: se descarta el patrón SPA de `app.jsx` (un solo `App` con `route` en `useState` y `location.hash`) porque el proyecto real es Next.js App Router; usar rutas reales aprovecha SSR/enrutamiento nativo y es más mantenible.
- **Reproductor 100% maqueta**: se descarta la simulación de partida (`setInterval` subiendo puntuación, vidas, niveles) del template porque el pedido explícito es "solamente parte visual... no hay que implementar ningún juego". El HUD y CRT quedan como diseño estático/demo.
- **Persistencia mock con `localStorage`**: se descarta backend real para este MVP; mantiene paridad con el template y es suficiente para validar la interfaz. Se documenta como decisión temporal, no definitiva.
- **Datos migrados tal cual desde `data.jsx`**: se descarta generar un dataset nuevo; los 8 juegos y jugadores mock del template ya cubren todas las categorías y estados de UI necesarios (grid lleno, filtros, categorías variadas).
- **Nav con menú móvil completo**: se descarta un nav "solo desktop" simplificado; se mantiene el patrón responsive del template porque es parte visible del MVP.
- **Contador de créditos fijo (sin lógica)**: se descarta cualquier sistema de créditos funcional; queda como elemento decorativo consistente con "solamente es la parte visual".
- **`seededScores` con generación pseudoaleatoria determinista**: se descarta hardcodear tablas fijas por juego; se mantiene la función generadora porque ya produce datos consistentes y variados sin mantenimiento manual.

## Riesgos identificados

- **Hidratación SSR/CSR con `localStorage`**: leer `av_user`/`av_scores` durante el render de servidor causa mismatch de hidratación. Mitigación: leer `localStorage` solo dentro de `useEffect`/client components, nunca en el render inicial de servidor.
- **Desincronización entre `app/globals.css` y `styles.css`**: el CSS ya migrado podría no cubrir el 100% del template (950 vs 957 líneas, no verificado línea por línea). Mitigación: revisar visualmente cada pantalla contra `Arcade Vault.html` durante el paso 9 del plan.
- **Rutas dinámicas con `id` inexistente**: acceder a `/juego/id-invalido` sin manejo puede romper la pantalla. Mitigación: usar `notFound()` de Next.js cuando `GAMES.find` no encuentra el juego.
