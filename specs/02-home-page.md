# 02 — Home Page

- Estado: Implementado
- Fecha: 2026-07-13
- Dependencias: [01-mvp-visual](01-mvp-visual.md) (requiere Nav, AuthProvider, `GAMES` y rutas ya implementadas)
- Objetivo: Migrar el template `home-about/home.jsx` a la ruta raíz `/` como landing page de Arcade Vault, moviendo la actual Biblioteca a `/games` y actualizando el Nav para reflejar ambas rutas, dejando la página "Acerca de" fuera de este spec.

## Alcance

### Incluye
- Nueva página **Home** en `/` (`app/page.tsx`), migrada de `home.jsx`: hero con `FloatingSilhouettes`, sección "¿Por qué Arcade Vault?" (feature-grid), riel de juegos (`MiniCard` con `GAMES.slice(0,6)`), sección de stats (ajustando "12+" al conteo real de `GAMES.length`), sección "Actividad en vivo" (datos hardcodeados tal cual el template), sección "Precios" (plan único gratuito + FAQ), CTA final.
- Efecto `useReveal` (IntersectionObserver que agrega clase `.in` a elementos `.reveal`) migrado como hook reutilizable.
- **Biblioteca movida de `/` a `/games`**: se renombra la carpeta/ruta; el contenido de `app/page.tsx` actual (grid, buscador, chips) pasa a `app/games/page.tsx` sin cambios funcionales.
- Actualización de todos los `next/link`/`router.push` internos que apuntaban a `/` como Biblioteca, para que apunten a `/games` (ej. botón "VOLVER AL VAULT" en detalle, CTAs "EXPLORAR JUEGOS"/"VER TODOS LOS JUEGOS" en Home).
- **Nav actualizado**: se agrega el link "Inicio" (apunta a `/`) antes de "Biblioteca" (apunta a `/games`), tanto en el nav desktop como en el panel móvil. Lógica de "activo" se actualiza: "Inicio" activo solo en `/`, "Biblioteca" activo en `/games` y en `/juego/*`.
- CTAs "CREAR CUENTA" / "EMPEZAR GRATIS" del Home navegan a `/login`.
- Link "VER SALÓN →" en la sección de actividad navega a `/salon`.
- Migración de los estilos faltantes de `references/templates/home-about/styles.css` a `app/globals.css` (reglas nuevas: `.home-*`, `.mini-*`, `.feature-*`, `.stat-block`/`.home-stats`, `.activity-*`, `.tick-*`, `.top-*`, `.pricing-*`, `.price-*`, `.pc-*`, `.faq-*`, `.reveal`/`.in`, `.silo`/`.home-silos`, etc.), evitando duplicar reglas ya existentes.
- Iconos SVG decorativos (`FeatureIcon`, silhouettes) migrados tal cual, como componentes internos del archivo de Home.

### No incluye (fuera de alcance)
- Página "Acerca de" (`about.jsx`) y su formulario de contacto — se implementará en un spec futuro. El link "Acerca de" **no** se agrega al Nav en este spec.
- Cambios a la lógica de `GAMES`, `CATS`, `PLAYERS` o `seededScores` en `app/lib/data.ts`.
- Sistema de créditos, ranking o actividad en vivo reales — las secciones "Actividad en Vivo" y "Top Jugadores" del Home quedan con datos estáticos del template.
- Mover `/juego/[id]` o `/juego/[id]/jugar` bajo `/games/[id]` — quedan como rutas independientes sin cambios.
- Rediseño visual del Home respecto al template (paridad 1:1 salvo el ajuste del conteo de juegos).

## Modelo de datos

No aplica — esta feature no introduce estructuras nuevas. El Home solo lee `GAMES` (ya existente en `app/lib/data.ts`) para el riel de juegos; el resto de los datos de las secciones (stats, actividad, top jugadores) son literales estáticos dentro del componente, igual que en el template.

## Plan de implementación

1. **Mover Biblioteca a `/games`**: crear `app/games/page.tsx` con el contenido actual de `app/page.tsx` (sin cambios funcionales). Sistema queda funcional con Biblioteca accesible en `/games` (aunque `/` aún no tenga Home).

2. **Migrar estilos del Home**: agregar a `app/globals.css` las reglas faltantes de `references/templates/home-about/styles.css` (`.home-*`, `.mini-*`, `.feature-*`, `.home-stats`/`.stat-block`, `.activity-*`, `.tick-*`, `.top-*`, `.pricing-*`, `.price-*`, `.pc-*`, `.faq-*`, `.reveal`/`.in`, `.home-silos`/`.silo`), verificando que no dupliquen reglas ya existentes en `globals.css`. Sistema sigue funcionando igual, solo se agrega CSS sin uso aún.

3. **Crear Home en `/`**: reemplazar `app/page.tsx` con la migración de `home.jsx` (hero, `FloatingSilhouettes`, `useReveal`, feature-grid, riel de `MiniCard` con `GAMES.slice(0,6)`, stats con conteo real de `GAMES.length`, actividad en vivo, precios, CTA final). Los `onClick`/`navigate` se traducen a `next/link`/`useRouter` apuntando a `/games`, `/login`, `/salon` y `/juego/[id]` según corresponda.

4. **Actualizar Nav**: en `app/components/Nav.tsx`, agregar el link "Inicio" (→ `/`) antes de "Biblioteca" (→ `/games`) en el nav desktop y en el panel móvil. Ajustar `isActive` para que "Inicio" solo esté activo en `/` y "Biblioteca" en `/games` + `/juego/*`.

5. **Corregir enlaces internos rotos por el movimiento de Biblioteca**: revisar `app/juego/[id]/page.tsx` y `app/juego/[id]/jugar/page.tsx` (botón "VOLVER AL VAULT"/"SALIR") y cualquier otro lugar que enlazara a `/` como Biblioteca, actualizándolos a `/games`.

6. **Verificación visual final**: recorrer `npm run dev` en `/`, `/games`, `/juego/[id]`, `/salon`, `/login`, confirmar: hero y secciones del Home se ven igual que `home-about/arcade-vault-standalone.html`, animaciones `reveal` disparan al hacer scroll, riel de juegos navega a detalle, CTAs navegan a las rutas correctas, Nav marca "Inicio"/"Biblioteca" activo correctamente en cada ruta, y que `/games` conserva toda la funcionalidad de búsqueda/filtros que tenía en `/`.

## Criterios de aceptación

- [x] `npm run dev` levanta la app sin errores de build/tipo.
- [x] `/` muestra el Home: hero con silhouettes flotantes, título "EL ARCADE CLÁSICO ESTÁ DE VUELTA", CTAs "EXPLORAR JUEGOS" y "CREAR CUENTA".
- [x] Sección "¿Por qué Arcade Vault?" muestra las 4 feature-cards con sus íconos.
- [x] Sección "Juegos disponibles ahora" muestra 6 `MiniCard` (de los 8 `GAMES`); click en una navega a `/juego/[id]` correcto.
- [x] Botón "VER TODOS LOS JUEGOS →" navega a `/games`.
- [x] Sección de stats muestra el conteo real de juegos (ej. "8+") en vez de "12+".
- [x] Secciones "Actividad en Vivo" y "Top Jugadores · Hoy" se renderizan con los datos estáticos del template.
- [x] Botón "VER SALÓN →" navega a `/salon`.
- [x] Sección "Precios" muestra el plan único gratuito y el FAQ; botón "EMPEZAR GRATIS →" navega a `/login`.
- [x] CTA final "INSERTAR MONEDA →" navega a `/games`.
- [x] Las animaciones de scroll-reveal (clase `.reveal`/`.in`) se activan al hacer scroll por el Home.
- [x] `/games` reproduce exactamente la funcionalidad que antes tenía `/` (hero, buscador, chips de categoría, grid de `GameCard`, estado "sin resultados").
- [x] El Nav muestra "Inicio" y "Biblioteca" en ese orden, tanto en desktop como en el menú móvil.
- [x] En `/`, el link "Inicio" del Nav aparece activo; en `/games` y `/juego/[id]`, el link "Biblioteca" aparece activo.
- [x] En `/juego/[id]`, el botón "VOLVER AL VAULT" navega a `/games` (no a `/`).
- [x] No aparece ningún link "Acerca de" en el Nav.
- [x] Paridad visual del Home contra `references/templates/home-about/arcade-vault-standalone.html`.

## Decisiones tomadas y descartadas

- **Home en `/`, Biblioteca movida a `/games`**: se descarta mantener Biblioteca en `/` porque el template original navega a "home" y "biblioteca" como rutas separadas; el patrón esperado de un landing real es tener el hero en la raíz. El nombre `/games` (en inglés) fue elegido explícitamente por el usuario en vez de `/biblioteca`.
- **About fuera de alcance**: se descarta migrar `about.jsx` en este spec — el usuario decidió dejarlo para un spec futuro, incluyendo el link "Acerca de" del Nav (que no se agrega hasta que exista la página, para evitar un link roto).
- **Rutas `/juego/[id]` y `/juego/[id]/jugar` sin anidar bajo `/games`**: se descarta reestructurarlas jerárquicamente; se mantienen como rutas independientes para minimizar el riesgo de romper enlaces internos ya existentes.
- **Datos de stats/actividad/top jugadores migrados literales, con solo el conteo de juegos corregido**: se descarta generar lógica dinámica nueva (ej. calcular actividad real); se ajusta únicamente "12+" a `GAMES.length` porque mentir sobre el catálogo real sería inconsistente con la Biblioteca visible en el mismo sitio.
- **Home 100% maqueta visual**: se descarta cualquier conexión a datos reales más allá de leer `GAMES` para el riel — consistente con la decisión de spec 01 de que todo el MVP es visual/mock.
- **CTAs "crear cuenta"/"empezar gratis" apuntan a `/login`**: se descarta crear una ruta de registro separada; `/login` ya cubre tabs de iniciar sesión/crear cuenta según spec 01.

## Riesgos identificados

- **Enlaces rotos por el movimiento de `/` a `/games`**: cualquier `next/link`/`router.push` que aún apunte a `/` esperando la Biblioteca dejará de funcionar como antes. Mitigación: búsqueda exhaustiva de referencias a `/` en el código (paso 5 del plan) antes de dar por cerrado el spec.
- **Duplicación de reglas CSS**: migrar `styles.css` completo sin revisar podría duplicar selectores ya presentes en `globals.css` (variables, `.btn`, `.card`, etc.) y generar conflictos de cascada. Mitigación: agregar solo las reglas nuevas específicas del Home/mini-card/etc., no el archivo completo.
- **Hidratación del `IntersectionObserver`**: `useReveal` accede a `document.querySelectorAll` — debe ejecutarse solo en cliente (`useEffect`), igual que los patrones ya usados en `AuthProvider`/`Nav`, para no romper el render SSR de Next.js.
