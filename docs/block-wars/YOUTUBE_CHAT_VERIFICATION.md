# Verificación del lector de chat — 2026-11-14

Estado: **código y pruebas locales verificados; autorización de la cuenta, chat real e ingestión pendientes**. Rama `codex/youtube-live-chat`, basada en `codex/elevenlabs-youtube-onboarding`; main permanece intacto.

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

Google Cloud: proyecto y YouTube Data API v3 habilitados; cliente **Mina Infinita LIVE local** creado con permiso explícito del propietario. El JSON descargado se guarda fuera de Git y nunca se imprime. El propietario aprobó añadir únicamente su cuenta como usuario de prueba; el último estado leído todavía mostraba la lista vacía y se solicitó completar el paso manualmente debido a un fallo del control de ventana. No existe todavía autorización privada guardada ni recepción de comentarios reales comprobada.

No se inició una transmisión. Likes y suscriptores reales siguen pendientes; sus botones continúan siendo simulaciones. Los comentarios YouTube tienen FX y autor, sin TTS. Recursos de Minecraft permanecen locales/ignorados y el permiso de comercialización no se da por resuelto.

El formato HTTP autenticado, cuenta/canal efectivo, latencia, glifos reales de la fuente y comportamiento en OBS se aceptan mediante un ensayo no listado autorizado. El contador de cuota es local y se reinicia con el proceso. OAuth externo en Prueba requiere renovar consentimiento al caducar, según la [configuración y sus fuentes](YOUTUBE_CHAT_SETUP.md).
