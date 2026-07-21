# 05 — Asteroides jugable

- Estado: Aprobado
- Fecha: 2026-07-18
- Dependencias: [01-mvp-visual](01-mvp-visual.md) (pantalla /juego/[id]/jugar, Nav, catálogo GAMES, persistencia av_scores)
- Objetivo: Portar el juego de referencia Asteroids (references/started-games/02-asteroids/game.js) a un módulo TypeScript real, agregarlo como nuevo juego "ASTEROIDES" al catálogo, y reemplazar la maqueta estática de /juego/asteroides/jugar por el juego jugable de verdad (HUD sincronizado, pausa real, fin de juego automático guardando el puntaje real en av_scores).

## Alcance

### Incluye

- Nueva entrada en `GAMES` (`app/lib/data.ts`): `id: "asteroides"`, `title: "ASTEROIDES"`, `cat: "SHOOTER"`, `cover: "cover-asteroides"`, `color`, `short`/`long` adaptados del README del juego de referencia, `best`/`plays` mock coherentes con el resto del catálogo. El juego aparece en la Biblioteca (`/`), es filtrable por categoría SHOOTER, y tiene su propia página de detalle (`/juego/asteroides`) igual que cualquier otro juego (sin cambios en esa pantalla).
- Clase CSS `.cover-asteroides` en `app/globals.css`, siguiendo el patrón visual de las coberturas existentes (`cover-rocas`, `cover-invaders`).
- Puerto a TypeScript del motor del juego (`references/started-games/02-asteroids/game.js`, clases `Bullet`, `Asteroid`, `Ship`, `Particle`, funciones `update`/`draw`/`initGame`/`nextLevel`) en un módulo nuevo, ej. `app/lib/games/asteroides/engine.ts`, preservando la lógica y balance del juego original (velocidades, puntos, invencibilidad, power-up de disparo triple, partículas de explosión) sin cambios de diseño.
- Componente de juego real (ej. `app/juego/asteroides/AsteroidesGame.tsx`, client component) que monta el `<canvas>` de 800×600 vía `useRef`/`useEffect`, corre el loop con `requestAnimationFrame`, captura teclado (flechas + espacio) con `preventDefault` y limpia listeners/loop al desmontar.
- La página `/juego/[id]/jugar` (`app/juego/[id]/jugar/page.tsx`) detecta `id === "asteroides"` y renderiza `AsteroidesGame` en vez de la arena decorativa estática; el resto de los juegos del catálogo sigue mostrando la maqueta actual sin cambios.
- HUD de React existente (Jugador/Puntuación/Vidas/Nivel) sincronizado en vivo con el estado real del motor (score, lives, level) vía callback/estado expuesto por `AsteroidesGame`; el HUD que el juego original dibuja dentro del canvas (SCORE/NIVEL/vidas) se desactiva para no duplicarlo.
- Botón **PAUSA/REANUDAR** implementado de verdad para asteroides: detiene y reanuda el loop (`requestAnimationFrame`) sin perder el estado de la partida.
- Botón **FIN** oculto/deshabilitado para asteroides (el fin de juego es automático, ver abajo); el resto de juegos mock mantiene su botón FIN actual sin cambios.
- Fin de juego automático: al perder la 3ª vida (estado `gameover` del motor), se abre el modal existente de fin de partida con el puntaje real; el overlay propio del juego ("GAME OVER... ESPACIO PARA REINICIAR") queda desactivado ya que el modal del sitio lo reemplaza.
- Guardar puntuación en el modal escribe en `localStorage` (`av_scores`) el puntaje real obtenido en la partida (no un valor fijo de maqueta), igual formato que hoy (`{ game, score, name, at }`).
- "JUGAR DE NUEVO" en el modal reinicia el motor por completo (`initGame()`): vidas, puntuación, nivel y asteroides vuelven al estado inicial.
- Botón "SALIR" navega a `/juego/asteroides` deteniendo el loop y limpiando listeners (sin fugas de memoria ni inputs fantasma al volver).

### No incluye (fuera de alcance)

- Cualquier cambio al juego mock "ROCAS" ya existente en el catálogo — queda intacto, sin relación con esta implementación.
- Arquitectura genérica de registro de motores de juego para futuros juegos reales — se especializa únicamente para `id === "asteroides"`; el patrón para adaptarlo a otros juegos queda para specs futuros.
- Controles táctiles/móviles — el juego solo es jugable con teclado (flechas + espacio), igual que el original; en móvil queda como limitación conocida, sin resolver en este spec.
- Tabla de puntuaciones del Salón de la Fama (`/salon`) — no se agrega "ASTEROIDES" a ninguna lógica especial ahí; el juego participa igual que cualquier otro vía `av_scores`/`seededScores` existentes, sin cambios en esa pantalla.
- Modificar el archivo original `references/started-games/02-asteroids/game.js` — se lee como referencia para portar la lógica, no se edita ni se borra.
- Balance/features nuevas (nuevos power-ups, dificultad, sonidos) — se porta el juego tal cual es, sin agregar ni quitar mecánicas.
- Sonido — el original no tiene audio; este spec tampoco lo agrega.

## Modelo de datos

### Catálogo (`app/lib/data.ts`)

Nueva entrada agregada al array `GAMES` existente (mismo tipo `Game`, sin cambios de interfaz):

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Pulveriza rocas espaciales en gravedad cero.",
  long: "Nave triangular a la deriva en un campo de asteroides toroidal. Dispara y rota para partir rocas grandes en fragmentos cada vez más pequeños, esquiva restos y sobrevive con solo 3 vidas.",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "cyan",
  best: 38200,
  plays: "3.1K",
}
```

### Motor del juego (`app/lib/games/asteroides/engine.ts`)

Puerto en TypeScript de las clases y funciones de `game.js`, sin cambios de comportamiento. Expone una API mínima para que el componente React la consuma:

```ts
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
  reset(): void; // initGame() — reinicia partida completa
  getSnapshot(): EngineSnapshot; // valores actuales para el HUD de React
  onSnapshotChange(cb: (s: EngineSnapshot) => void): () => void; // suscripción; retorna unsubscribe
  destroy(): void; // limpia listeners de teclado y cancela loop
}

export function createEngine(canvas: HTMLCanvasElement): AsteroidesEngine;
```

Las clases internas (`Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`) y constantes (`RADII`, `SPEEDS`, `POINTS`, etc.) se portan tal cual desde `game.js`, encapsuladas dentro del módulo — no se exportan fuera de `engine.ts`.

No se agregan tablas nuevas en Supabase ni cambios al esquema de `av_scores` en `localStorage` (mismo formato ya definido en el spec 01).

## Plan de implementación

1. **Catálogo**: agregar la entrada `asteroides` a `GAMES` en `app/lib/data.ts` y la clase `.cover-asteroides` en `app/globals.css` (siguiendo el patrón visual de `.cover-rocas`). Sistema queda funcional: el juego aparece en la Biblioteca, es filtrable, y `/juego/asteroides` muestra su detalle con leaderboard mock — todavía usa la maqueta estática al jugar.

2. **Puerto del motor**: crear `app/lib/games/asteroides/engine.ts` portando 1:1 la lógica de `game.js` (clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, constantes, `update`/`draw`/`initGame`/`nextLevel`/`spawnAsteroids`/`explode`/`killShip`) dentro de la función `createEngine(canvas)`, reemplazando el `ctx`/`keys`/`justPressed`/estado globales por variables encapsuladas en el closure. Expone `start/stop/reset/getSnapshot/onSnapshotChange/destroy` según el modelo de datos. Sistema sigue igual visualmente — módulo sin uso todavía.

3. **Componente de juego**: crear `app/juego/asteroides/AsteroidesGame.tsx` (client component) que monta un `<canvas width={800} height={600}>` vía `useRef`, instancia `createEngine` en `useEffect`, se suscribe a `onSnapshotChange` para exponer `{score, lives, level, state}` a su padre (via prop `onSnapshot` o hook), escala el canvas con CSS (`max-width:100%; aspect-ratio:4/3`) dentro del `crt-screen`, agrega `preventDefault()` en `keydown` de flechas/espacio, y llama `destroy()` en el cleanup del efecto. Sistema sigue igual — componente sin integrar a la página `/jugar` todavía.

4. **Integrar en `/jugar`**: modificar `app/juego/[id]/jugar/page.tsx` para que, cuando `id === "asteroides"`, renderice `AsteroidesGame` dentro del `crt-screen` en vez de `.game-arena` decorativa, y sincronice el HUD de React (Jugador/Puntuación/Vidas/Nivel) con el snapshot del motor en lugar de los valores `DEMO_*`. El resto de juegos (`GAMES` mock) sigue usando la arena estática existente sin cambios. Sistema queda funcional: asteroides es jugable con teclado, con HUD real.

5. **Pausa real**: conectar el botón PAUSA/REANUDAR existente a `engine.stop()`/`engine.start()` para asteroides (sin afectar el comportamiento del resto de juegos, que solo alternan un estado visual). Sistema queda funcional: pausar/reanudar congela y continúa la partida real.

6. **Fin de juego automático**: cuando el snapshot reporta `state === "gameover"`, la página `/jugar` abre el modal de fin de partida existente (mismo modal del spec 01) con el `score` real del snapshot, oculta el botón FIN para asteroides (ya no aplica) y desactiva el overlay interno de "GAME OVER" del motor (no se dibuja dentro del canvas). "JUGAR DE NUEVO" llama a `engine.reset()` y cierra el modal; "GUARDAR PUNTUACIÓN" escribe el score real en `av_scores`. Sistema queda funcional de punta a punta.

7. **Verificación funcional final**: `npm run dev`, jugar una partida completa de "ASTEROIDES" desde la Biblioteca: rotar/propulsar/disparar, romper asteroides grandes en medianos/pequeños, recoger el power-up de disparo triple, perder las 3 vidas, confirmar que se abre el modal con el puntaje real, guardar la puntuación y verificar que aparece en `localStorage` (`av_scores`), reiniciar con "JUGAR DE NUEVO", pausar/reanudar a mitad de partida, y salir a mitad de partida confirmando que el loop se detiene (sin consumo de CPU en background, revisable en DevTools Performance/Task Manager).

## Criterios de aceptación

- [ ] `npm run dev` levanta la app sin errores de build/tipo.
- [ ] "ASTEROIDES" aparece en la Biblioteca (`/`), filtrable por categoría SHOOTER, con su cover `.cover-asteroides`.
- [ ] `/juego/asteroides` muestra el detalle (descripción, stats, leaderboard mock) igual que cualquier otro juego, sin cambios respecto al resto del catálogo.
- [ ] `/juego/asteroides/jugar` renderiza el canvas jugable real (no la arena decorativa) con la nave, control por flechas (rotar/propulsar) y espacio (disparar).
- [ ] Los asteroides se envuelven en los bordes (toroidal), se dividen en fragmentos más pequeños al ser destruidos, y desaparecen los de tamaño 1 al ser destruidos (sin fragmentos nuevos).
- [ ] El HUD de React (Jugador/Puntuación/Vidas/Nivel) refleja en vivo el score, vidas y nivel reales de la partida — no valores fijos de maqueta.
- [ ] Dentro del canvas no se dibuja un HUD duplicado (SCORE/NIVEL/vidas internos del motor quedan desactivados).
- [ ] El botón PAUSA detiene el movimiento del juego; REANUDAR lo continúa desde el mismo estado (sin reiniciar posiciones).
- [ ] Perder la 3ª vida abre automáticamente el modal de fin de partida con el puntaje real alcanzado, sin necesidad de apretar ningún botón FIN.
- [ ] El botón FIN no aparece (o está deshabilitado) para asteroides.
- [ ] Guardar puntuación en el modal escribe una entrada real en `localStorage` bajo `av_scores` con `game: "asteroides"` y el `score` real de la partida, mostrando el toast "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" reinicia la partida completa: score en 0, 3 vidas, nivel 1, nuevo campo de asteroides.
- [ ] El botón "SALIR" navega a `/juego/asteroides` y detiene el loop del juego (no sigue corriendo en background tras salir).
- [ ] Presionar flechas o espacio mientras se juega no scrollea la página.
- [ ] El resto de los juegos del catálogo (`bloque-buster`, `rocas`, etc.) sigue mostrando la maqueta estática sin cambios de comportamiento.
- [ ] `references/started-games/02-asteroids/game.js` permanece sin modificar.

## Decisiones tomadas y descartadas

- **Nuevo juego "asteroides" en vez de reutilizar/reemplazar "rocas"**: se descarta tocar la entrada mock "ROCAS" ya existente en el catálogo (pedido explícito del usuario); asteroides es una entrada nueva e independiente.
- **Puerto a TypeScript como módulo en vez de cargar `game.js` tal cual**: se descarta un `<script>` con variables globales por no ser idiomático en un proyecto React/TS y complicar el ciclo de vida (montar/desmontar) dentro de una SPA; portar a un módulo encapsulado (`createEngine`) da tipado y limpieza de listeners más segura.
- **Especializar solo `/jugar` para `id === "asteroides"` en vez de una arquitectura genérica de motores**: se descarta diseñar un registro de juegos ahora porque solo hay un juego real que integrar; generalizar prematuramente sin ver un segundo caso real de uso agregaría complejidad sin beneficio inmediato. Queda documentado como patrón a revisar cuando se adapte un segundo juego de referencia.
- **HUD de React sincronizado en vivo, ocultando el HUD interno del canvas**: se descarta mantener ambos HUD visibles porque duplicaría la información (score/vidas/nivel en dos lugares); el HUD del sitio ya tiene el diseño visual del reproductor definido en el spec 01.
- **Pausa real implementada ahora**: se descarta dejar el botón PAUSA sin funcionalidad para asteroides pese a que el juego original no la soporta, porque el botón ya es parte visible de la UI del reproductor (spec 01) y dejarlo decorativo sería inconsistente con que el juego sí es real.
- **Fin de juego automático (sin botón FIN) en vez de manual**: se descarta que el jugador decida cuándo terminar, porque el juego original ya tiene una condición de derrota clara (0 vidas) y usarla evita puntajes "a mitad de partida" guardados arbitrariamente.
- **Sin controles táctiles/móviles**: se descarta adaptar controles para móvil en este spec para mantenerlo enfocado en portar el juego original; queda como limitación conocida y trabajo futuro explícito si se decide dar soporte mobile al reproductor.
- **Categoría SHOOTER y cover placeholder con gradiente (no arte real)**: se descarta encargar arte gráfico nuevo; se sigue el mismo patrón de las demás coberturas (`cover-rocas`, `cover-invaders`), consistente con que el catálogo entero usa gradientes CSS en vez de imágenes.

## Riesgos identificados

- **Fuga de memoria / loop en background**: si el `useEffect` de `AsteroidesGame` no cancela correctamente `requestAnimationFrame` y remueve los listeners de teclado al desmontar (navegar a "SALIR" o cambiar de ruta), el loop seguiría corriendo invisible, consumiendo CPU y disparando updates sobre un canvas ya desmontado. Mitigación: `destroy()` del motor centraliza la limpieza; criterio de aceptación específico verifica que el loop se detiene al salir.
- **Listeners de teclado globales interfiriendo con el resto del sitio**: como el original engancha `keydown`/`keyup` en `window`, si no se remueven bien podrían seguir capturando flechas/espacio en otras pantallas del sitio (ej. scroll en `/salon`) después de salir del juego. Mitigación: mismo mecanismo de limpieza de `destroy()`, y que el listener solo se registre mientras el componente `AsteroidesGame` está montado.
- **Escalado del canvas 800×600 en viewports angostos**: al escalar con CSS para caber en el `crt-screen` responsive, el juego podría verse borroso o con proporción incorrecta en pantallas muy chicas. Mitigación: mantener `aspect-ratio: 4/3` y `max-width: 100%` en el contenedor; no es un requisito de pixel-perfect, es un juego de referencia adaptado.
- **Divergencia de balance al portar `game.js` a TypeScript**: un error de transcripción manual (ej. una constante mal copiada) cambiaría sutilmente la dificultad/puntaje respecto al original. Mitigación: portar clase por clase comparando contra el archivo de referencia; el criterio de aceptación de partición de asteroides y puntos ayuda a detectar desvíos groseros.
- **`requestAnimationFrame` no pausable de forma limpia**: cancelar y reanudar el loop en pausa podría introducir un salto de `dt` grande al reanudar (el `dt` se calcula por diferencia de timestamps). Mitigación: el motor debe resetear su `lastTime` a `null` al reanudar (mismo patrón que al iniciar), para que el primer frame post-pausa use `dt = 0` como en el arranque original.
