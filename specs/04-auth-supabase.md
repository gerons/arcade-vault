# 04 — Autenticación real con Supabase

- Estado: Aprobado
- Fecha: 2026-07-18
- Dependencias: [01-mvp-visual](01-mvp-visual.md) (Nav, AuthProvider, rutas /login existentes)
- Objetivo: Reemplazar la sesión mock de localStorage por autenticación real con Supabase Auth (email/password con confirmación por correo, más acceso como invitado sin sesión), dejando catálogo de juegos y puntuaciones para specs futuros que dependerán de este.

## Alcance

### Incluye

- Instalación de `@supabase/ssr` y `@supabase/supabase-js`.
- Clientes Supabase para Next.js 16: cliente de browser (`app/lib/supabase/client.ts`) y cliente de servidor (`app/lib/supabase/server.ts`) usando cookies vía `@supabase/ssr`.
- `middleware.ts` en la raíz del proyecto para refrescar la sesión de Supabase en cada request.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` documentadas en `.env.local.example` (el usuario ya tiene el proyecto Supabase `ptmybevoosgjqvbyuqsv` creado, sin tablas propias todavía).
- **`AuthProvider.tsx` reescrito**: reemplaza la lectura/escritura de `av_user` en `localStorage` por `supabase.auth.getSession()` + `onAuthStateChange()`. Expone `user` (derivado de la sesión de Supabase), `signOut()`.
- **`/login` con signup/login reales**:
  - Tab "Crear cuenta": pide Usuario, Email y Contraseña. Llama a `supabase.auth.signUp()` guardando el username en `user_metadata.username`. Muestra mensaje de "revisá tu correo para confirmar tu cuenta" (Supabase requiere confirmación de email antes de poder loguear).
  - Tab "Iniciar sesión": pide Usuario o Email y Contraseña, llama a `supabase.auth.signInWithPassword()`.
  - Manejo de errores visibles: credenciales inválidas, email ya registrado, email aún no confirmado.
  - "Jugar como invitado" se mantiene exactamente igual que hoy: no crea sesión de Supabase, solo navega a `/games` con `user = null`.
  - Botones sociales (Google/GitHub) siguen decorativos, sin funcionalidad — no se tocan en este spec.
- **Nav actualizado**: muestra el username (`user_metadata.username`) cuando hay sesión de Supabase activa, y el estado "sin sesión" cuando no la hay (igual criterio visual que hoy). El botón de logout llama a `supabase.auth.signOut()`.
- Confirmación de email usa el servicio de correo por defecto de Supabase (sin SMTP custom, sin plantillas propias en este spec).

### No incluye (fuera de alcance)

- Recuperación de contraseña ("olvidé mi contraseña") — spec futuro.
- OAuth real con Google/GitHub — los botones siguen decorativos.
- Rutas protegidas por sesión — todas las rutas (`/games`, `/juego/[id]`, `/salon`, etc.) siguen siendo públicas.
- Catálogo de juegos en Supabase (`GAMES`) — spec futuro dependiente de este.
- Puntuaciones y Salón de la Fama reales en Supabase — spec futuro dependiente de este y del catálogo.
- Supabase Realtime y Edge Functions — mencionados por el usuario como uso futuro, no se preparan estructuras para ellos en este spec.
- SMTP custom (Resend) para los correos de Auth — se usa el servicio por defecto de Supabase.
- Tablas propias / RLS — este spec no crea tablas en `public`, solo usa `auth.users` de Supabase.

## Modelo de datos

No se introducen tablas nuevas en Supabase — este spec solo usa el esquema `auth` interno que Supabase gestiona automáticamente (no requiere migraciones ni RLS propias).

Cambia el contrato de sesión en el cliente, en `app/lib/data.ts` (reemplaza el `AuthUser` actual):

```ts
export interface AuthUser {
  id: string; // supabase auth user id
  email: string;
  username: string; // de user_metadata.username
}
```

`AuthProvider` deja de leer/escribir `localStorage` y expone `user: AuthUser | null` derivado de `supabase.auth.getSession()` / `onAuthStateChange()`. El estado de invitado (`user = null`, sin sesión de Supabase) se mantiene sin cambios respecto al comportamiento actual.

Variables de entorno nuevas en `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Plan de implementación

1. **Instalar dependencias y documentar env vars**: `npm install @supabase/ssr @supabase/supabase-js`. Agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` a `.env.local.example` con comentario de dónde obtenerlas (Supabase Dashboard > Project Settings > API). Sistema sigue funcionando igual, solo se agregan dependencias sin uso aún.

2. **Crear clientes Supabase**: `app/lib/supabase/client.ts` (cliente de browser con `createBrowserClient`) y `app/lib/supabase/server.ts` (cliente de servidor con `createServerClient` + cookies de `next/headers`), siguiendo el patrón recomendado de `@supabase/ssr` para Next.js App Router. Sistema sigue igual, sin uso aún.

3. **Middleware de sesión**: crear `middleware.ts` en la raíz que refresca el token de sesión de Supabase en cada request usando el cliente de servidor. Sistema sigue igual visualmente, pero ya queda la infraestructura de sesión lista.

4. **Reescribir `AuthProvider.tsx`**: reemplazar la lectura/escritura de `av_user` en `localStorage` por `supabase.auth.getSession()` al montar y `supabase.auth.onAuthStateChange()` para mantener `user` sincronizado. `signOut()` llama a `supabase.auth.signOut()`. Actualizar el tipo `AuthUser` en `app/lib/data.ts` según el modelo de datos definido. Sistema queda funcional: cualquier pantalla que use `useAuth()` sigue andando (sin sesión hasta que se implemente el paso 6).

5. **Actualizar `/login`**: tab "Crear cuenta" llama a `supabase.auth.signUp()` con `email`, `password` y `options.data.username`; tras éxito muestra mensaje "revisá tu correo para confirmar tu cuenta" en vez de redirigir. Tab "Iniciar sesión" llama a `supabase.auth.signInWithPassword()` y redirige a `/games` en éxito. Ambos tabs muestran errores visibles (credenciales inválidas, email ya registrado, email no confirmado) usando el mensaje de error que devuelve Supabase. "Jugar como invitado" no cambia. Sistema queda funcional: signup/login reales funcionando de punta a punta.

6. **Actualizar `Nav.tsx`**: mostrar `user.username` cuando hay sesión activa (en vez del mock actual), mantener el estado "sin sesión" igual que hoy cuando `user === null`. El botón de logout usa el `signOut()` actualizado del paso 4.

7. **Verificar configuración de Supabase Auth**: confirmar en el dashboard (vía `list_tables`/`get_project_url` o revisión manual) que "Confirm email" está habilitado en Authentication > Providers > Email (comportamiento por defecto de Supabase), y que la URL de redirect de confirmación apunta a la app en desarrollo (`http://localhost:3000`).

8. **Verificación funcional final**: `npm run dev`, crear una cuenta nueva con email real, confirmar que llega el correo de confirmación de Supabase, confirmar el email, loguearse, verificar que el Nav muestra el username, cerrar sesión, probar login con credenciales inválidas (error visible), probar signup con email ya registrado (error visible), y confirmar que "jugar como invitado" sigue funcionando sin crear sesión.

## Criterios de aceptación

- [ ] `npm run dev` levanta la app sin errores de build/tipo.
- [ ] Crear una cuenta nueva en `/login` (tab "Crear cuenta") con usuario, email y contraseña dispara `supabase.auth.signUp()` y muestra el mensaje de "revisá tu correo para confirmar tu cuenta".
- [ ] Llega un correo real de confirmación (servicio por defecto de Supabase) a la casilla usada en el signup.
- [ ] Intentar iniciar sesión antes de confirmar el email muestra un error visible ("email no confirmado").
- [ ] Tras confirmar el email, iniciar sesión con email/usuario y contraseña correctos redirige a `/games`.
- [ ] Iniciar sesión con contraseña incorrecta muestra un error visible, sin redirigir.
- [ ] Intentar crear una cuenta con un email ya registrado muestra un error visible.
- [ ] Con sesión activa, el Nav muestra el username (`user_metadata.username`) en vez de "Iniciar Sesión".
- [ ] Cerrar sesión desde el Nav vuelve al estado sin usuario y redirige/permanece en una pantalla pública.
- [ ] "Jugar como invitado" sigue navegando a `/games` sin crear sesión de Supabase ni mostrar username en el Nav.
- [ ] Recargar la página (F5) con sesión activa conserva la sesión (gestionada por cookies vía `@supabase/ssr`, no por `localStorage`).
- [ ] `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` están documentadas en `.env.local.example` y no hay claves hardcodeadas en el código.
- [ ] Ninguna ruta existente (`/games`, `/juego/[id]`, `/salon`, `/about`) requiere sesión para acceder.

## Decisiones tomadas y descartadas

- **Dividir en 3 specs (Auth / Catálogo / Puntuaciones+Salón) en vez de uno solo**: se descarta implementar todo Supabase de una vez porque tocaba 4 áreas distintas (auth, catálogo, puntuaciones, leaderboard); dividir reduce el riesgo de un plan de implementación largo y difícil de revisar. Este spec es el primero (Auth), del que dependerán los siguientes.
- **`@supabase/ssr` con cookies en vez de cliente solo-browser**: se descarta manejar la sesión únicamente en el cliente porque Next.js App Router con Server Components necesita poder leer la sesión en servidor; el paquete oficial `@supabase/ssr` es el patrón recomendado por Supabase para este caso.
- **Confirmación de email obligatoria**: se descarta dejar el signup sin verificación (más simple para probar) porque el usuario prefirió el comportamiento más cercano a producción desde el principio.
- **Servicio de email por defecto de Supabase en vez de SMTP custom con Resend**: se descarta reutilizar `RESEND_API_KEY` ya presente en el proyecto; el usuario eligió no configurar SMTP custom en este spec para no sumar otra dependencia externa a la implementación de Auth. Puede revisarse en un spec futuro si el límite del servicio por defecto resulta insuficiente.
- **Username como campo propio en el signup (`user_metadata.username`) en vez de derivarlo del email**: se descarta derivar el nombre del email porque el mock actual ya pedía un campo "Usuario" separado; mantiene la experiencia de UI existente.
- **"Jugar como invitado" sin sesión de Supabase**: se descarta usar `signInAnonymously()` de Supabase en este spec; el invitado sigue exactamente igual que hoy (sin sesión), evitando acoplar esta decisión a los specs futuros de puntuaciones que aún no están definidos.
- **Sin recuperación de contraseña ni OAuth real en este spec**: se descartan ambos para mantener el spec enfocado en signup/login/logout/invitado; quedan como trabajo futuro explícito.
- **Sin rutas protegidas**: se descarta agregar cualquier redirect a `/login` por falta de sesión; todas las rutas siguen siendo públicas, consistente con el comportamiento actual del MVP visual.
- **Sin preparar estructuras para Realtime o Edge Functions**: el usuario mencionó que se usarán a futuro, pero se descarta anticipar esquema o infraestructura para ellos en este spec — se abordarán cuando exista un spec concreto que los necesite.

## Riesgos identificados

- **Límite de envío del servicio de email por defecto de Supabase**: es una capacidad reducida pensada para desarrollo/pruebas (pocos correos por hora). Mitigación: aceptado explícitamente por el usuario para este spec; si se vuelve insuficiente, migrar a SMTP custom (ej. Resend) queda documentado como opción para un spec futuro.
- **Redirect URL de confirmación mal configurada**: si la URL de redirect en Supabase Dashboard no apunta a `http://localhost:3000` (o al dominio real en producción), el link del correo de confirmación puede fallar o redirigir a un lugar incorrecto. Mitigación: paso 7 del plan verifica esta configuración antes de dar por cerrado el spec.
- **Desajuste entre `user_metadata.username` y el Nav**: si `signUp()` no incluye correctamente `options.data.username`, el Nav mostraría `undefined` en vez del nombre. Mitigación: criterio de aceptación específico que verifica el username visible tras confirmar y loguear.
- **Sesión de cookies vs. código existente que asumía `localStorage`**: cualquier lugar del código que todavía lea `av_user` de `localStorage` directamente (fuera de `AuthProvider`) quedaría desincronizado. Mitigación: `AuthProvider` sigue siendo el único punto de acceso a la sesión (`useAuth()`), no se detectaron otros usos directos de `av_user` en el código revisado.
- **Acoplamiento con specs futuros (Catálogo, Puntuaciones)**: al no implementar `signInAnonymously()`, los specs futuros de puntuaciones deberán definir explícitamente cómo (o si) los invitados guardan puntuaciones. Mitigación: se documenta como decisión abierta a resolver en el spec de Puntuaciones, no en este.
