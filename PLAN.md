# TonyRadioAtlante — Plan del proyecto

## Objetivo
Web app self-hosted que sirve de base para una radio online 24h:
- Emisión en directo continua (Auto-DJ 24h) generada a partir de MP3 subidos.
- Frontend estilo Spotify: reproductor persistente, catálogo de programas, elegir "Directo" o programa concreto.
- Panel de administración para subir/gestionar programas y programar la parrilla.
- **Restricción dura: nada de servicios externos para audio/datos.** Todo corre en infraestructura propia (VPS/servidor local). Nada de S3, SaaS de streaming, CDNs de terceros para el audio.

## Arquitectura general

```
[Admin sube MP3] → [Backend API + almacenamiento local en disco]
                              │
                              ▼
                    [Motor Auto-DJ: Liquidsoap]
                              │
                              ▼
                    [Servidor de streaming: Icecast2]
                    (mismo servidor, mismo proceso persistente)
                              │
              ┌───────────────┴────────────────┐
              ▼                                 ▼
   [Frontend: reproductor "Directo"]   [Frontend: reproductor on-demand
    consume el stream Icecast en vivo]  sirve MP3 directamente del disco
                                          vía el backend]
```

### Por qué Icecast + Liquidsoap (self-hosted, sin terceros)
- **Icecast2**: servidor de streaming de audio open-source, se instala en tu propio servidor, sirve el stream por HTTP directamente a los navegadores (compatible con `<audio>` HTML5). No depende de ningún servicio externo.
- **Liquidsoap**: motor Auto-DJ open-source que arma la programación (reproduce en bucle los MP3 subidos, aplica crossfade, permite programar franjas horarias, mete relleno automático) y alimenta el Icecast. Corre como proceso persistente en el mismo servidor.
- Ambos se instalan con `apt`/Docker en tu propia VPS o máquina — cero llamadas a servidores de terceros para el audio.

### Alternativa más simple (si no quieres Liquidsoap)
Un proceso Node propio con `ffmpeg` concatenando/streameando los MP3 en bucle hacia Icecast (via `ffmpeg -re -i playlist.txt -f mp3 icecast://...`). Menos flexible que Liquidsoap (sin programación horaria fina, crossfade manual) pero más simple de mantener si el equipo no quiere aprender el lenguaje de Liquidsoap.

## Stack técnico propuesto

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS | SSR rápido, fácil de dar estética Spotify (dark mode, sidebar, player fijo abajo) |
| Backend/API | Node.js + Express (o Next API routes) | Simplicidad, mismo lenguaje que frontend |
| Base de datos | PostgreSQL (o SQLite si el volumen es bajo) | Metadata de programas, usuarios admin, parrilla horaria |
| Almacenamiento de audio | Disco local del servidor (carpeta `/media`) | Nada de S3; el backend sirve los MP3 directamente con streaming por rangos (HTTP Range) |
| Streaming en directo | Icecast2 + Liquidsoap | Self-hosted, estándar de la industria para radios online |
| Autenticación admin | JWT / sesión simple, solo para el panel | No hace falta cuentas de oyentes en la v1 (según lo acordado: básico + admin) |
| Hosting | VPS propio (Hetzner/tu propio server) con Docker Compose | Todo en un único servidor bajo tu control, sin dependencias externas |

Todo se empaqueta con **Docker Compose**: un contenedor para Next.js, uno para el backend, uno para Postgres, uno para Icecast, uno para Liquidsoap. Un solo `docker compose up` levanta la radio entera en cualquier servidor tuyo.

## Módulos funcionales

### 1. Panel de administración (`/admin`)
- Login simple (usuario/contraseña, sin proveedores externos de auth).
- Subida de MP3 (drag & drop), con metadata: título, categoría/programa, duración (autodetectada), portada (imagen local).
- Gestión de la parrilla: asignar franjas horarias a programas para que Liquidsoap los reproduzca en su turno, o dejarlo en modo "rotación libre" (todo en cola aleatoria/secuencial).
- Reordenar/eliminar programas.
- (Futuro) estadísticas básicas de oyentes conectados al Icecast (Icecast expone esto de serie vía su `/status-json.xsl`).

### 2. Frontend público (`/`)
- Estética Spotify: sidebar con categorías, grid de tarjetas de programas con portada, reproductor fijo abajo (play/pause, volumen, título actual).
- Botón destacado "🔴 En directo" que conecta al stream Icecast (`<audio src="https://tu-servidor/stream">`).
- Lista/catálogo de programas → al seleccionar uno, lo reproduce on-demand (no interrumpe el directo real, es un modo aparte del reproductor).
- Buscador simple por nombre/categoría.

### 3. Backend/API
- `POST /api/admin/programs` — subir programa (multipart, guarda en disco + fila en BD).
- `GET /api/programs` — listar catálogo.
- `GET /api/programs/:id/stream` — servir el MP3 con soporte HTTP Range (para seek).
- `GET /api/live/status` — proxy al status de Icecast (oyentes actuales, título en emisión).
- Tras subir un MP3, el backend actualiza el playlist que lee Liquidsoap (o la carpeta que vigila) para que entre en rotación automáticamente.

## Fases de implementación sugeridas

1. **Fase 0 — Infra base**: Docker Compose con Icecast + Liquidsoap sirviendo un stream de prueba con un par de MP3 fijos. Verificar que el `<audio>` del navegador lo reproduce.
2. **Fase 1 — Backend + BD**: modelo de datos (programas, categorías), subida de archivos, endpoint de listado y streaming on-demand.
3. **Fase 2 — Frontend público**: UI estilo Spotify, reproductor persistente, catálogo, conexión al directo.
4. **Fase 3 — Panel admin**: login, subida, gestión de parrilla horaria.
5. **Fase 4 — Pulido**: crossfade en Liquidsoap, estadísticas de oyentes, portadas, responsive/móvil.

## Decisiones confirmadas

1. **Volumen**: pequeño (decenas de programas, pocos GB) → usamos **SQLite** en vez de Postgres. Más simple de mantener, cero servicio de BD adicional que administrar; migrar a Postgres en el futuro es sencillo si el volumen crece.
2. **Servidor**: pendiente de recibir los datos del VPS/servidor. El Docker Compose se deja listo para desplegar en cualquier máquina Linux en cuanto se confirme el destino; desarrollo mientras tanto en local.
3. **Parrilla horaria**: **rotación simple** al principio (cola/aleatoria de los programas subidos). La programación por franjas horarias se añade como fase posterior, sin rediseñar la base.
4. **Admin y dominio**: **un solo usuario admin fijo** (sin gestión de roles en v1), y **ya hay dominio disponible** → se configura HTTPS desde el principio (necesario para audio/autoplay en producción, evita problemas de mixed content).

## Stack actualizado tras las decisiones

| Capa | Decisión final |
|---|---|
| Base de datos | **SQLite** (archivo local, sin contenedor de BD aparte) |
| Auth admin | Un único usuario admin, credenciales en variable de entorno o tabla simple, JWT/sesión |
| Streaming en directo | Icecast2 + Liquidsoap, rotación simple de los MP3 subidos (sin parrilla horaria en v1) |
| HTTPS | Reverse proxy (Caddy o Nginx + Certbot) delante de Next.js e Icecast, usando el dominio que facilitéis — Caddy es la opción más simple porque gestiona el certificado Let's Encrypt automáticamente |
| Hosting | Docker Compose genérico, listo para el VPS en cuanto se confirmen los datos de acceso |

## ⚠️ Actualización tras inspeccionar el servidor real

Servidor: Oracle Cloud ARM, Ubuntu 24.04, IP `129.151.249.242`, dominio `myappsserver.duckdns.org` (HTTPS ya activo vía Let's Encrypt, gestionado por **Apache**, no Caddy/nginx).

Inspección revela que **no hay Docker ni Node instalados**, y que todas las apps existentes (`Tony_Bucodental`, `Tony_Calendario`, `Tony_Integracion`, `Tony_Restauracion`, etc.) siguen un patrón común:

- Carpeta propia en `/var/www/html/<Nombre_App>/`, accesible como `https://myappsserver.duckdns.org/<Nombre_App>/`
- `.htaccess` propio por app
- `api/` con endpoints en **PHP 8.3**
- `db/` con base de datos **SQLite**
- Frontend estático (HTML/CSS/JS vanilla, sin build step de Node)

**Decisión: seguir esta misma convención** en vez de introducir Docker/Next.js/Node, para no romper la coherencia del servidor compartido ni añadir dependencias nuevas (PHP+SQLite ya están operativos y probados ahí).

### Stack final revisado

| Capa | Decisión final |
|---|---|
| Carpeta del proyecto | `/var/www/html/Tony_RadioAtlante/` |
| Frontend | HTML/CSS/JS vanilla (estética Spotify: sidebar, grid de programas, reproductor fijo), sin framework — mismo patrón que el resto de apps |
| Backend | **PHP 8.3** puro en `Tony_RadioAtlante/api/` (subida de MP3, listado de programas, servir audio on-demand con soporte Range) |
| Base de datos | **SQLite** en `Tony_RadioAtlante/db/` |
| Almacenamiento MP3 | Disco local del servidor, carpeta `Tony_RadioAtlante/media/` (fuera de `api`/`db`, con `.htaccess` para bloquear listado directo) |
| Streaming 24h en directo | **Icecast2 + Liquidsoap instalados vía `apt`** (no Docker) como servicios systemd, alimentados por los MP3 de `media/`, expuestos en un puerto interno (ej. 8000) y **proxeados por Apache** (`mod_proxy`) bajo `https://myappsserver.duckdns.org/Tony_RadioAtlante/stream` para que quede bajo HTTPS y el mismo dominio |
| Admin | Login único (PHP + sesión), panel de subida/gestión en `Tony_RadioAtlante/admin/` |
| HTTPS | Ya resuelto: se reutiliza el vhost y certificado existentes de `myappsserver.duckdns.org` |

### Ruta final de la app
`https://myappsserver.duckdns.org/Tony_RadioAtlante/`

### Fase 0 revisada (siguiente paso a ejecutar)
1. Crear `/var/www/html/Tony_RadioAtlante/` con la estructura (`api/`, `db/`, `media/`, `admin/`, assets frontend).
2. Instalar `icecast2` y `liquidsoap` vía `apt` en el servidor, configurarlos como servicios systemd con una playlist de prueba.
3. Habilitar `mod_proxy`/`mod_proxy_wstunnel` en Apache y añadir el bloque de proxy inverso hacia Icecast dentro del vhost existente (sin tocar las demás apps).
4. Verificar que `https://myappsserver.duckdns.org/Tony_RadioAtlante/stream` reproduce audio de prueba en el navegador.
5. A partir de ahí: backend PHP (subida/listado/on-demand) → frontend estilo Spotify → panel admin.

## ✅ Estado: IMPLANTADO Y FUNCIONANDO (23 sept 2026)

**URL pública**: https://myappsserver.duckdns.org/Tony_RadioAtlante/
**Panel admin**: https://myappsserver.duckdns.org/Tony_RadioAtlante/admin/ (acceso solo con contraseña; no se versiona aquí)

### Lo que se hizo
1. Conexión SSH verificada al servidor Oracle Cloud, baseline de apps existentes confirmado OK antes de tocar nada.
2. Creada `/var/www/html/Tony_RadioAtlante/` con estructura `api/`, `db/`, `media/`, `admin/`, `assets/`.
3. Instalados **icecast2** y **liquidsoap** vía `apt` (no Docker), configurados como servicios systemd (`icecast2`, `liquidsoap-radio`), ambos **enabled** (arrancan solos si el servidor reinicia).
4. Icecast restringido a `127.0.0.1:8000` (no expuesto directamente a internet), solo accesible vía proxy de Apache.
5. Liquidsoap reproduce en bucle aleatorio (`playlist mode="randomize"`, `reload_mode="watch"`) todo lo que haya en `media/`, con `mksafe()` para que el stream nunca se caiga aunque la carpeta esté vacía. (Crossfade pendiente: da error de "fallible source" con la versión de liquidsoap instalada — a revisar más adelante, no crítico.)
6. Apache: habilitados `mod_proxy`/`mod_proxy_http`/`mod_proxy_wstunnel`, añadido `ProxyPass /Tony_RadioAtlante/stream → 127.0.0.1:8000/stream` dentro del vhost SSL existente (backup del `.conf` hecho antes de tocarlo). Verificado `apache2ctl configtest` antes de reiniciar, y confirmado que el resto de apps (`Tony_Bucodental`, `Tony_Calendario`, `Tony_Integracion`, `Tony_Restauracion`) siguen respondiendo 200 después del cambio.
7. Base de datos SQLite creada (`db/radio.sqlite`) con tablas `programs` y `admin_users`. Protegida con `.htaccess` (`Require all denied`).
8. Backend PHP completo: `api/programs.php` (listado), `api/live_status.php` (estado del directo vía proxy al status-json de Icecast), `api/login.php`/`logout.php`/`session_check.php` (acceso admin **solo por contraseña**, sin usuario visible), `api/upload.php` (subida validada por extensión + MIME real), `api/delete.php`.
9. Frontend **mobile-first, orientación vertical**, estética Spotify (verde/negro, tarjetas, reproductor fijo abajo, categorías tipo "chips"). Implementado con **Media Session API** (`navigator.mediaSession`) para que el audio siga sonando con la pantalla bloqueada y aparezcan controles en la pantalla de bloqueo; `manifest.webmanifest` con `orientation: portrait` para poder "añadir a pantalla de inicio" como app.
10. Panel de administración mobile-friendly: login solo-contraseña, formulario de subida (título, categoría, descripción, MP3), listado con duración y botón eliminar.
11. Subidos 2 programas de ejemplo reales: **"Onda Azul. Programa 00. El Reto (Punto de Partida)"** (30:42) y **"Cosas que Importan - Entrevista IFC +21"** (19:21).
12. Verificado end-to-end con curl y en navegador (viewport móvil 375×812): stream en directo devuelve `200 audio/mpeg`, catálogo carga, reproducción on-demand funciona (`currentTime` avanza), login admin funciona, panel lista y permite eliminar programas.
13. Permisos finales: proyecto propiedad de `www-data` (mismo que el resto de apps del servidor) para que PHP pueda escribir en `media/` y `db/` al subir programas.

### Branding aplicado (23 sept 2026, tarde)
- Nombre visible de la marca: **"Radio Atlante · CIFP Tony Gallardo"** (la carpeta/infraestructura sigue llamándose `Tony_RadioAtlante` por ser el nombre ya acordado para la ruta del servidor, pero todo el texto visible en frontend/admin/Media Session dice "Radio Atlante").
- Logo oficial subido a `assets/img/logo.png`, mostrado en la cabecera sobre una placa blanca (por si el PNG tiene fondo transparente con elementos oscuros).
- 3 portadas de sección subidas a `media/covers/` y redimensionadas a 600×600 con ffmpeg: `onda_azul.jpg`, `cosas_que_importan.jpg`, `conoce_tu_empresa.jpg`.
- Mapeo automático categoría → portada en `api/programs.php` (`CATEGORY_COVERS`): cualquier programa futuro subido con categoría "Onda Azul", "Cosas que Importan" o "Conoce tu Empresa" recibe su portada automáticamente sin gestión manual. Si el admin sube una portada propia para un programa concreto, esa tiene prioridad.

### Iteraciones adicionales (23 sept 2026, tarde/noche)
- **Categorías fijas**: Onda Azul, Cosas que Importan, Conoce tu Empresa, Eventos, Otros. Eventos/Otros usan el logo CIFP Tony Gallardo como portada.
- **Panel admin**: subida con categoría en desplegable (ya no texto libre), filtro por categoría, y **edición inline** de programas (título/categoría/descripción) vía `api/update.php`.
- **Favicon** con icono de micrófono (`assets/img/favicon.svg`), aplicado en frontend, admin y manifest.
- **Listado de programas en formato playlist** (filas tipo Spotify: portada pequeña + título + categoría + duración) en vez de cuadrícula de tarjetas.
- **Parpadeo del indicador "EN DIRECTO"** además del punto rojo pulsante.
- **"Sonando ahora" en el directo**: se muestra qué programa se está emitiendo en cada momento, tanto en la tarjeta de directo como en el reproductor persistente y en la pantalla de bloqueo (Media Session). Técnicamente:
  - Al subir/editar un programa, el backend PHP escribe el título como tag ID3 en el propio MP3 (`ffmpeg -metadata title=...`).
  - Liquidsoap lee esa metadata automáticamente y la envía a Icecast.
  - `api/live_status.php` expone `now_playing` leyendo el `title` del status-json de Icecast.
  - **Bug corregido**: las portadas (`covers/`) estaban dentro de `media/`, y Liquidsoap las escaneaba intentando decodificarlas como audio. Se movieron a `/var/www/html/Tony_RadioAtlante/covers/` (fuera de `media/`), y se actualizaron las rutas en el backend (`COVERS_URL_PATH`).

### Pendiente / mejoras futuras (no bloqueante)
- Arreglar el `crossfade()` de Liquidsoap (falla con "fallible source" en la versión instalada; el stream funciona bien sin él, solo faltan transiciones suaves entre pistas).
- Portadas de programas (`cover_image`) — el modelo de datos ya lo soporta, falta subir imágenes desde el admin.
- Parrilla horaria (fase futura, según lo acordado).
- Considerar un botón "editar" programa (actualmente solo subir/eliminar).
- Guardar credenciales (contraseña admin, passwords de Icecast) en un gestor seguro — de momento están solo en este servidor y en el entorno de esta sesión de trabajo.
