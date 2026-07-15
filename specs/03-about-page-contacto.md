# 03 — About Page y Formulario de Contacto

- Estado: Aprobado
- Fecha: 2026-07-14
- Dependencias: [01-mvp-visual](01-mvp-visual.md) (Nav, layout), [02-home-page](02-home-page.md) (Nav con rutas actuales, `useReveal`)
- Objetivo: Migrar la página "Acerca de" del template a `/about`, con un formulario de contacto que envía correos reales vía Resend (API de prueba `onboarding@resend.dev`) a gerons69@gmail.com.

## Alcance

### Incluye
- Nueva página **About** en `/about` (`app/about/page.tsx`), migrada de `about.jsx`: hero "ACERCA DE ARCADE VAULT" con misión, fila de 3 highlights (HEART/BROWSER/PLANT con sus SVG), divisor animado de píxeles, sección de contacto con intro + tips y formulario.
- Reutiliza el hook `useReveal` ya existente (`app/lib/useReveal.ts`) para las animaciones de scroll-reveal — no se duplica el `IntersectionObserver` del template.
- **Formulario de contacto real**: envía nombre, email y mensaje a un endpoint propio (`app/api/contact/route.ts`) que usa el SDK de `resend` para enviar el correo desde `onboarding@resend.dev` hacia `gerons69@gmail.com`, con el nombre/email del remitente incluidos en el cuerpo del mensaje.
- Validación de campos no vacíos en cliente (igual que el template: si falta algún campo, animación de "shake" y no se envía). Sin validación de formato de email en servidor (según lo acordado).
- Tres estados visuales del formulario tras enviar: **enviando** (botón deshabilitado + spinner), **éxito** (pantalla de "terminal" ya diseñada en el template, con el nombre del remitente), **error** (mensaje visible de que no se pudo enviar, con opción de reintentar).
- **Nav actualizado**: se agrega el link "Acerca de" (→ `/about`) después de "Salón de la Fama", tanto en desktop como en el panel móvil, con su lógica de estado activo.
- Migración de los estilos faltantes de `home-about/styles.css` a `app/globals.css`: `.about-*`, `.highlight-*`, `.div-pixels`/`.div-bar`, `.contact-*`, `.term-*`, evitando duplicar `.reveal`/`.in` que ya existen.
- Nueva dependencia `resend` en `package.json`, y variable de entorno `RESEND_API_KEY` documentada en `.env.local.example` (el usuario la completa manualmente en `.env.local`, no versionado).

### No incluye (fuera de alcance)
- Dominio propio verificado en Resend — se usa `onboarding@resend.dev`, lo que limita la entrega solo a `gerons69@gmail.com` (email verificado en la cuenta de Resend). Migrar a dominio propio queda para un spec futuro.
- Validación de formato de email en servidor, rate limiting, honeypot o protección anti-spam del formulario.
- Persistencia de los mensajes enviados (ej. guardar en base de datos o `localStorage`) — el correo es el único registro.
- Autenticación o restricción de quién puede usar el formulario (queda público, igual que el template).
- Reenvío automático o cola de reintentos ante fallos de Resend — el usuario debe reenviar manualmente si falla.

## Modelo de datos

No se introduce persistencia ni entidades nuevas (no hay base de datos ni `localStorage` para este feature). Solo se define el contrato del endpoint interno:

`app/api/contact/route.ts` — `POST /api/contact`

**Request body:**
```ts
interface ContactRequest {
  name: string;
  email: string;
  msg: string;
}
```

**Response:**
```ts
// 200 OK
interface ContactSuccessResponse {
  ok: true;
}

// 400/500
interface ContactErrorResponse {
  ok: false;
  error: string;
}
```

El endpoint valida solo que los tres campos no vengan vacíos (mismo criterio que el cliente) y usa el SDK `resend` con `RESEND_API_KEY` (variable de entorno server-only, nunca expuesta al cliente) para enviar el correo desde `onboarding@resend.dev` a `gerons69@gmail.com`, incluyendo `name`, `email` y `msg` en el cuerpo.

## Plan de implementación

1. **Instalar dependencia y documentar env var**: agregar `resend` a `package.json` (`npm install resend`). Crear `.env.local.example` con `RESEND_API_KEY=` y un comentario indicando que se obtiene en resend.com. Sistema sigue funcionando igual, solo se agrega la dependencia sin uso aún.

2. **Migrar estilos del About**: agregar a `app/globals.css` las reglas faltantes de `references/resources/templates/home-about/styles.css` (`.about-*`, `.highlight-*`, `.div-pixels`/`.div-bar`, `.contact-*`, `.term-*`), verificando que no dupliquen `.reveal`/`.in` (ya existen desde spec 02). Sistema sigue funcionando igual, solo se agrega CSS sin uso aún.

3. **Crear endpoint `/api/contact`**: crear `app/api/contact/route.ts` con handler `POST` que valida campos no vacíos, instancia el cliente `Resend` con `process.env.RESEND_API_KEY`, envía el correo desde `onboarding@resend.dev` a `gerons69@gmail.com` con `name`/`email`/`msg` en el cuerpo, y responde `{ ok: true }` o `{ ok: false, error }` según el resultado. Sistema queda funcional: endpoint probable vía curl/Postman aunque el formulario aún no lo consuma.

4. **Crear página `/about`**: crear `app/about/page.tsx` migrando `about.jsx` — hero, highlights con `HighlightIcon`, divisor animado, sección de contacto con `useReveal` (hook existente, no duplicar `IntersectionObserver`). El formulario mantiene la validación de campos vacíos + shake del template, pero al enviar hace `fetch("/api/contact", { method: "POST", body: JSON.stringify(form) })` en vez de simular. Maneja tres estados: `idle/sending/success/error`, mostrando spinner+botón deshabilitado durante `sending`, la pantalla de "terminal" de éxito ya diseñada en el template si `ok: true`, y un mensaje de error con botón de reintento si falla.

5. **Actualizar Nav**: en `app/components/Nav.tsx`, agregar el link "Acerca de" (→ `/about`) después de "Salón de la Fama" en el nav desktop y en el panel móvil, con su `isActive` correspondiente (`pathname === "/about"`).

6. **Verificación funcional final**: correr `npm run dev`, navegar a `/about` desde el Nav (desktop y móvil), confirmar paridad visual con `arcade-vault-standalone.html`, completar el formulario con datos válidos y confirmar que llega el correo real a gerons69@gmail.com, probar el caso de campos vacíos (shake, sin envío), y forzar un caso de error (ej. `RESEND_API_KEY` inválida temporalmente) para confirmar que el estado de error se muestra correctamente.

## Criterios de aceptación

- [ ] `npm run dev` levanta la app sin errores de build/tipo.
- [ ] `/about` muestra el hero "ACERCA DE ARCADE VAULT" con el texto de misión y los 3 highlights (HEART/BROWSER/PLANT) con sus íconos.
- [ ] Las animaciones de scroll-reveal (`.reveal`/`.in`) se activan al hacer scroll en `/about`, usando el hook `useReveal` existente.
- [ ] El Nav (desktop y móvil) muestra el link "Acerca de" después de "Salón de la Fama", y navega a `/about`.
- [ ] En `/about`, el link "Acerca de" del Nav aparece activo.
- [ ] Enviar el formulario con algún campo vacío dispara la animación de "shake" y no hace ninguna petición de red.
- [ ] Enviar el formulario con los 3 campos completos deshabilita el botón y muestra un spinner mientras se procesa.
- [ ] Un envío exitoso muestra la pantalla de "terminal" de éxito con el nombre ingresado, y llega un correo real a gerons69@gmail.com con nombre, email y mensaje enviados.
- [ ] Un envío fallido (ej. API key inválida o Resend caído) muestra un mensaje de error visible con opción de reintentar, sin dejar el botón deshabilitado indefinidamente.
- [ ] El botón "ENVIAR OTRO MENSAJE" tras un éxito limpia el formulario y vuelve al estado inicial.
- [ ] `RESEND_API_KEY` no aparece expuesta en el bundle de cliente (se usa solo dentro de `app/api/contact/route.ts`).
- [ ] Paridad visual de `/about` contra `references/resources/templates/home-about/arcade-vault-standalone.html` (sección about+contact).

## Decisiones tomadas y descartadas

- **Resend con dominio de prueba `onboarding@resend.dev`**: se descarta esperar a tener un dominio verificado; el usuario decidió avanzar ya y migrar a dominio propio en un spec futuro. Implica que solo se puede entregar a `gerons69@gmail.com` (limitación conocida de Resend en modo prueba).
- **Envío vía API route propia (`app/api/contact/route.ts`) en vez de llamar a Resend desde el cliente**: se descarta exponer `RESEND_API_KEY` en el navegador; el SDK de Resend requiere la key en servidor, consistente con las variables server-only de Next.js.
- **Sin validación de formato de email en servidor**: se descarta duplicar validación; el usuario decidió que la validación de campos no vacíos en cliente es suficiente para este spec.
- **Sin persistencia de mensajes ni protección anti-spam**: se descarta guardar los mensajes en BD/localStorage o agregar rate limiting/honeypot; el correo enviado es el único registro, consistente con el resto del proyecto que usa mocks y mantiene el alcance acotado.
- **Reutilizar `useReveal` existente en vez de duplicar el `IntersectionObserver` del template**: se descarta copiar el efecto tal cual desde `about.jsx`, ya que el hook compartido creado en spec 02 cubre el mismo comportamiento.
- **Tres estados explícitos (enviando/éxito/error) en vez de solo éxito simulado**: se descarta el comportamiento del template (que asumía éxito instantáneo); con un envío de red real se necesita reflejar latencia y posibles fallos.
- **Sin reintentos automáticos ante fallo**: se descarta una cola o reintento automático; el usuario reenvía manualmente vía el botón, manteniendo la implementación simple.

## Riesgos identificados

- **Límite de entrega de Resend en modo prueba**: con `onboarding@resend.dev`, cualquier intento de enviar a un destinatario distinto de `gerons69@gmail.com` fallará o será rechazado por Resend. Mitigación: el endpoint tiene el destinatario hardcodeado a `gerons69@gmail.com`, así que no depende de input del usuario para el "to".
- **`RESEND_API_KEY` ausente o inválida**: si el usuario no configura `.env.local` antes de probar, el endpoint fallará en cada intento. Mitigación: el estado de error del formulario cubre este caso visualmente, y `.env.local.example` documenta el paso.
- **Falta de protección anti-spam**: al no haber rate limiting ni honeypot, el endpoint podría ser usado para enviar correos arbitrarios de forma repetida. Mitigación: riesgo aceptado explícitamente por el usuario para este spec (fuera de alcance); se recomienda revisarlo antes de un lanzamiento público real.
