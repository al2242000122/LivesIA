# YouTube LIVE: preparación del primer ensayo

Actualización: 2026-11-13. Estado: **preparación local implementada, acceso a la sala de control LIVE comprobado; ingestión y chat real pendientes**. Con confirmación explícita del propietario se creó [Mina Infinita LIVE](https://www.youtube.com/@MinaInfinitaLIVE), aceptando las condiciones indicadas en el formulario. No se conectó OAuth ni se emitió.

El13de noviembre se abrió la sala autenticada del canal y se completó la bienvenida seleccionando software de transmisión. Se guardaron título, descripción, categoría Videojuegos y **No listado**; el propietario confirmó público general, no creado específicamente para niños. Studio mostró el ensayo sin señal («No hay datos») en `/video/i0fOJAzWJqA/livestreaming`. No se mostró ni copió la clave de transmisión. El comportamiento de inicio automático queda por comprobar antes de enviar señal desde OBS.

OBS portable cargó **LivesIA YouTube / Mina YouTube** mediante el acceso directo local «Mina Infinita YouTube». Se grabaron y decodificaron completos dos ensayos de147.133s y122.100s: H.264720×1280/30FPS y AAC44.1kHz estéreo. Se elevaron únicamente los FX; el pico de la segunda muestra fue−21.57dBFS, sin saturación en esa muestra. [Evidencia](OBS_YOUTUBE_REHEARSAL_2026-11-13.md). Después, el propietario autorizó [la prueba real de ElevenLabs en OBS](ELEVENLABS_OBS_REHEARSAL_2026-11-13.md): ambos avisos se capturaron, mezcla−8.14dBFS y decodificación completa sin errores. La latencia precisa y el ensayo prolongado siguen pendientes.

## Qué está preparado

Perfil y colección independientes **LivesIA YouTube**, escena **Mina YouTube**. Una sola fuente local: `http://127.0.0.1:4173/block-wars?platform=youtube`,720×1280/30FPS, con audio de la página. Sin cámara, micrófono o captura del escritorio; fuente persistente y sin credenciales de emisión. El perfil anterior **LivesIA Ensayo** permanece intacto.

La vista YouTube muestra **ENSAYO**, **CHAT PENDIENTE** y **EFECTOS DEMO**. No abre el WebSocket de TikFinity ni acepta sus eventos. Los botones del panel siguen disponibles como simulaciones explícitas. Likes, suscriptores, miembros, Super Chat y regalos de YouTube **no controlan el juego** en esta fase. No anunciar lo contrario durante una prueba.

Los picos, colisiones, minería infinita,20eventos internos,14comandos destacados, efectos y Snake se conservan. En YouTube, la voz opcional se limita inicialmente a metas comunitarias de likes y suscriptores gratuitos de prueba. Comandos y eventos automáticos sólo reproducen FX. Sólo el perfil nuevo selecciona la variante YouTube; las rutas sin el parámetro mantienen su funcionamiento anterior.

Para preparar la entrada privada de ElevenLabs existe `scripts/start-youtube-voice.ps1`: solicita la clave ocultamente en una terminal local y no la guarda ni inicia aplicaciones/emisiones. Ver [configuración y prueba](SPEECH_SETUP.md). Las pruebas automatizadas no consumen créditos; la autenticación, voz elegida, pronunciación y mezcla OBS siguen sin comprobarse.

## Crear el canal y habilitar LIVE

1. Entrar personalmente a [YouTube](https://www.youtube.com/channel_switcher) con la cuenta Google destinada al proyecto. El propietario ya inició sesión. No compartir contraseña, códigos o claves en el chat.
2. Canal comprobado en pantalla: **Mina Infinita LIVE**, identificador **@MinaInfinitaLIVE**. No asumir la identidad de Mojang/Microsoft.
3. El propietario completó personalmente la verificación de teléfono; se comprobó el mensaje «Se verificó el número de teléfono». Después se solicitó el acceso en YouTube Studio. La interfaz confirmó solicitud del **12 de noviembre de2026 a las10:28** y mostró «Podrás transmitir en23:59:36». Disponibilidad estimada alrededor del **13 de noviembre a las10:28, hora de Ciudad de México**. Debe volver a comprobarse el acceso al terminar el plazo; no se inició una emisión ni se guardaron números o códigos.
4. Preparar una emisión **no listada**, con chat habilitado si la audiencia real y la configuración del contenido lo permiten. Clasificar el público según el contenido; no cambiar esa clasificación para eludir restricciones de chat.
5. Conectar OBS con YouTube mediante el flujo autorizado de la cuenta o introducir personalmente la clave en OBS. Nunca guardar claves en el repositorio, capturas o navegador del juego. Mantener desactivado el inicio automático de la emisión para revisar la vista previa y el audio antes de salir.

Fuentes oficiales consultadas: [crear canal](https://support.google.com/youtube/answer/1646861?hl=es), [habilitar LIVE y métodos](https://support.google.com/youtube/answer/2474026?hl=es), [emisión con codificador y primera activación](https://support.google.com/youtube/answer/2907883). No se ha determinado la elegibilidad de esta cuenta.

## OBS y formato

El perfil usa x264/CBR8000kbps,30FPS, GOP máximo60frames (2s), AAC128kbps,estéreo44.1kHz y Rec.709. Son los valores preparados a partir de la [guía actual de codificador de YouTube](https://support.google.com/youtube/answer/2853702?hl=es); la aplicación de su tabla720p al lienzo vertical720×1280 es una elección de este proyecto. La subida real y la salud de ingestión aún no se midieron. Reducir bitrate/resolución sólo después de observar la prueba si la conexión no lo sostiene.

YouTube admite LIVE vertical y puede mostrarlo en el feed de Shorts; no garantiza distribución ni audiencia. Si Studio ofrece emisión dual horizontal/vertical, revisar qué lienzo y clave reciben la señal y evitar un recorte centrado que corte la mina o el menú. Esta fase prepara **una salida vertical**, no dos señales ni multistream.

Crear los archivos con OBS cerrado (rechaza sobrescribir perfiles o escenas existentes):

```powershell
node scripts/prepare-obs.cjs "$env:LOCALAPPDATA/LivesIA/obs-studio/33.0.1/config/obs-studio" "$env:LOCALAPPDATA/LivesIA/recordings-youtube" youtube
.\scripts\start-first-live.ps1 -Platform youtube -CheckOnly
.\scripts\start-first-live.ps1 -Platform youtube
```

En esta PC ya se generaron los archivos y `-CheckOnly` verificó firma/rutas. El lanzador no inicia grabación ni emisión y conserva una sesión OBS ya abierta: seleccionar entonces manualmente colección/perfil **LivesIA YouTube**. Abrir sólo una instancia del juego durante el ensayo para no duplicar acciones o peticiones de voz. El panel correspondiente es `/block-wars/control?platform=youtube`.

Antes de emitir: **Mina infinita → Interactuar → ACTIVAR SONIDO**, probar TNT/NUKE, silencio y emergencia; grabar y escuchar la mezcla. El [ensayo previo de33min47s](OBS_REHEARSAL_2026-11-12.md) comprobó captura con el perfil anterior; los FX eran bajos (pico−37.17dBFS). No acredita este nuevo bitrate/audio ni dos horas continuas. Verificar nuevamente con la configuración YouTube y la voz real.

## Texto preparado para la prueba no listada

**Título:** MINA INFINITA LIVE ⛏️ Pico que rebota | Ensayo del canal

**Descripción:**

> Ensayo de una mina automática en ejecución: el pico cae, rebota y rompe bloques por colisión. La excavación continúa sin final de ronda. Hoy verificamos imagen, sonido y estabilidad. Los efectos de este ensayo los activa el operador; el chat todavía no controla el juego. Proyecto independiente, no oficial ni asociado con Mojang o Microsoft.

Cambiar esa descripción únicamente cuando la integración real de comentarios funcione y se haya contrastado. La miniatura, nombre y clasificación del canal quedan a revisión del propietario. Recursos originales de Minecraft son locales y sus derechos de publicación/comercialización siguen pendientes de revisar; ver [MINECRAFT_ASSETS.md](MINECRAFT_ASSETS.md).

## Chat e interacciones: siguiente fase

La alternativa oficial es la [API de YouTube LIVE Chat](https://developers.google.com/youtube/data/live/reference/rest/v3/liveChatMessages). `streamList` entrega mensajes mediante una conexión de servidor y puede incluir historial inicial; requiere deduplicación y un corte temporal para no premiar mensajes antiguos al conectar. `list` exige respetar `pollingIntervalMillis` y presupuesto de cuota. No reutilizar el WebSocket de TikFinity como si fuera YouTube.

Pendiente de implementar y probar: acceso de lectura autorizado, selección del LIVE/chat correctos, reanudación, cuotas, identidades mínimas en memoria y fuente YouTube distinguible, comandos permitidos/moderación, enfriamientos y anuncios sólo por acciones aceptadas. Un suscriptor gratuito y un miembro pagado son eventos distintos. No prometer notificación individual de cada suscripción, ni convertir likes agregados en autores de acciones. Pagos y monetización siguen deshabilitados.

Los likes se tratarán como hitos de comunidad: `statistics.likeCount` es un agregado, no una identidad por pulsación ([videos](https://developers.google.com/youtube/data/reference/rest/v3/videos)). `newSponsorEvent` representa membresía pagada, no una suscripción gratuita ([tipos de chat](https://developers.google.com/youtube/data/live/reference/rest/v3/liveChatMessages)). Los suscriptores con privacidad activada no aparecen en la lista reciente; no se garantiza aviso nominal para todos ([ayuda de YouTube](https://support.google.com/youtube/answer/7280745?hl=es)). La API de [suscripciones recientes](https://developers.google.com/youtube/data/reference/rest/v3/subscriptions/list) exige acceso autorizado para `myRecentSubscribers`; antes de habilitarla debe evitar premiar historial anterior al LIVE. Fuentes comprobadas el2026-11-13.

## Verificación y aceptación

`npm test`, `npm run check`, parserPowerShell y `start-first-live.ps1 -Platform youtube -CheckOnly`. Regresiones: variantes OBS coexisten sin sobrescritura; la vista YouTube bloquea TikFinity y permite controles simulados; variante local/Snake conservan su transporte.

Pendientes para aceptar un LIVE real: acceso LIVE habilitado al concluir el plazo, prueba no listada con vista previa/sonido/subida confirmados, chat real conectado, ensayoOBS120min y revisión de recursos. Reversión: detener emisión/grabación, seleccionar el perfil/colección anterior y volver a la URL sin `platform=youtube`; no borrar grabaciones o perfiles del usuario.
