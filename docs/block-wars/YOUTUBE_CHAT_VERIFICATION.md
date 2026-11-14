# Verificación del lector de chat — 2026-11-14

Estado: **código, pruebas locales y autorización de lectura verificados; chat real e ingestión pendientes**. Rama `codex/youtube-live-chat`, basada en `codex/elevenlabs-youtube-onboarding`; main permanece intacto.

## Comprobaciones ejecutadas

Después de `npm ci --ignore-scripts`:

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 287 pruebas, 287 aprobadas, 0 fallos |
| `npm run check` | 61 archivos con sintaxis válida |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilidades reportadas; sin dependencias nuevas |
| Revisión independiente de seguridad | PASS tras corregir cancelación HTTP |
| Revisión independiente de lógica | PASS tras corregir errores403 y límites Unicode |
| Revisión independiente de calidad | PASS tras unificar límites Unicode y probar el circuito completo |

Las revisiones finales cubren el conjunto de cambios y después el diff de corrección `a8346cd..60236e6`. Los primeros intentos de revisión que fallaron por límite del servicio no cuentan como aprobaciones. `node --check` sustituye diagnósticos IDE; no se ejecutó un IDE conectado.

Se conservan Snake, simulador, TikFinity en su variante, minería infinita,14 comandos destacados y20 efectos internos. Las pruebas usan los módulos reales con HTTP/SSE local, fixtures de Google y DOM/Canvas de prueba. Ninguna prueba lee credenciales reales ni envía TTS.

## Regresiones verificables corregidas

- El plazo de cabeceras inicialmente rechazaba la espera sin cancelar el `fetch`. Ahora aborta su conexión y conserva cancelación por sesión durante el cuerpo; los reintentos no acumulan solicitudes activas.
- Un HTTP403 con `quotaExceeded`, `liveChatEnded` o `liveChatDisabled` se confundía con acceso denegado. Ahora sólo se lee un cuerpo acotado a16KiB/5s y se devuelve un código fijo, sin texto remoto ni secretos.
- Nombres válidos con emojis pasaban el lector y fallaban el adaptador. El circuito YouTube usa44 puntos de código para nombre y500 para comentario. Se verifican los bordes mediante lector→adaptador→experiencia→motor→canvas; se rechazan45/501. Fuentes anteriores conservan comportamiento.
- Una conexión de streaming sana podía agotar200 callbacks y descartar todos los mensajes siguientes. Ahora rota conservando cursor/dedupe. También rota tras1MiB o300s; cuenta espacios y frames incompletos.
- Los reintentos iniciales podían esperar menos de15s. La espera final, incluyendo jitter, queda entre15y60s.
- El asistente OAuth podía conservar conexiones HTTP parciales tras vencer, o instalar credenciales después del timeout. Las pruebas cubren cierre de sockets y escritura demorada, además de callbacks falsificados y PKCE.

Los ensayos de seis horas **virtuales** de sondeo y streaming recorren reconexiones, límites, cursor y parada. No equivalen a seis horas reales, ni al ensayo OBS de120min.

## Configuración real y límites

Google Cloud: proyecto y YouTube Data API v3 habilitados; cliente **Mina Infinita LIVE local** creado con permiso explícito del propietario. El propietario añadió personalmente dos usuarios de prueba y completó la autorización de lectura tras revisar el aviso de Google. El asistente terminó con código0 y guardó el archivo privado fuera de Git. Ningún token o clave se incluye en esta evidencia.

El 2026-11-14 el servidor comprobó el canal esperado mediante la API oficial y consultó una emisión propia: el ensayo conocido figura como `unlisted`/`ready`. Se seleccionó ese video explícitamente; el lector quedó `waiting_live`, con autenticación válida, error nulo y cero comentarios recibidos. La muestra inicial consumió 3 unidades del contador local, no es una lectura de la cuota global del proyecto. El servidor se reinició mediante el arranque normal; la configuración privada conserva sólo la ruta del archivo de autorización.

OBS 33.0.1 mantuvo perfil/escena **LivesIA YouTube / Mina YouTube**, 30 FPS y emisión/grabación detenidas. Se actualizó la fuente y se activó su sonido. La configuración de Emisión todavía apuntaba a Twitch; se preparó **YouTube-RTMPS / Primary YouTube ingest server** y se dejó la entrada protegida para que el propietario pegue personalmente la clave del ensayo. Su guardado y la señal de salida todavía no se verificaron. No se muestra, copia ni captura esa clave. Evidencia visual local en `artifacts/youtube-preparation/obs-chat-autorizado.png`, fuera de Git.

No se inició una transmisión. Likes y suscriptores reales siguen pendientes; sus botones continúan siendo simulaciones. Los comentarios YouTube tienen FX y autor, sin TTS. Recursos de Minecraft permanecen locales/ignorados y el permiso de comercialización no se da por resuelto.

El formato HTTP autenticado del chat, latencia y comportamiento de comandos reales en OBS se aceptan mediante un ensayo no listado autorizado; comprobar la cuenta/canal no sustituye ese ensayo. Los contadores de voz permanecieron en cero tras preparar esta sesión. El contador de cuota es local y se reinicia con el proceso. OAuth externo en Prueba requiere renovar consentimiento al caducar, según la [configuración y sus fuentes](YOUTUBE_CHAT_SETUP.md).
