# Chat oficial de YouTube: configuración local

Estado al2026-11-14: código probado, autorización de lectura completada personalmente y canal/emisión propios comprobados por la API. El ensayo conocido permanece no listado y el lector muestra `waiting_live`, sin comentarios recibidos. El propietario aceptó las condiciones de Google Cloud y autorizó crear el cliente de escritorio **Mina Infinita LIVE local** en el proyecto `mina-infinita-live`. YouTube Data API v3 está habilitada. Actualización: ingestión real y un comentario recibido verificados; segundo ensayo no listado dejado activo por petición del propietario. La confirmación del efecto de comandos y escucha remota sigue pendiente; ver [evidencia](YOUTUBE_CHAT_VERIFICATION.md).

## Autorizar la cuenta

El único alcance solicitado es `https://www.googleapis.com/auth/youtube.readonly`. No se solicitan escritura, moderación, pagos ni inicio de transmisiones. El permiso permite leer datos de la cuenta de YouTube; el código usa sólo consultas de canal, emisiones, video y comentarios. La pantalla oficial de Google debe revisarse antes de concederlo. No publicar la aplicación OAuth ni ampliar alcances como atajo.

1. Descargar el JSON del cliente **App de escritorio** desde el proyecto propio de Google Cloud. Guardarlo en una carpeta privada fuera de cualquier checkout de Git. No abrirlo en el chat ni pegar sus valores en terminales o capturas.
2. En Windows se recomienda `%LOCALAPPDATA%/LivesIA/youtube`. Crear la carpeta bajo el perfil del propietario; `0600` no garantiza por sí solo permisos ACL de Windows. El asistente no modifica permisos del sistema.
3. Desde la rama de esta integración, ejecutar con rutas absolutas:

   ```powershell
   node scripts/connect-youtube.cjs "$env:LOCALAPPDATA/LivesIA/youtube/desktop-client.json" "$env:LOCALAPPDATA/LivesIA/youtube/authorization.json"
   ```

4. Abrir la página **local** que imprime el asistente y seguir su botón de autorización. Seleccionar la cuenta/canal **Mina Infinita LIVE** y revisar el permiso. El asistente vence a los dos minutos y no imprime códigos ni tokens. Si vence, volver a ejecutarlo. No superar automáticamente una advertencia de seguridad.
5. El archivo privado se crea de manera exclusiva. No se sobrescribe una autorización existente salvo que el operador solicite expresamente `--overwrite`. El token de acceso sólo existe en memoria; el archivo guarda la autorización de renovación. No subir ninguno de los dos JSON a Git.
6. Configurar sólo la ruta local y el canal esperado al iniciar:

   ```powershell
   $env:YOUTUBE_AUTH_FILE = "$env:LOCALAPPDATA/LivesIA/youtube/authorization.json"
   # Para usar otro canal autorizado, configurar su ID público explícitamente.
   $env:YOUTUBE_EXPECTED_CHANNEL_ID = 'UCRJQkWn3h-uh8LCu6WERU2Q'
   npm start
   ```

El proyecto no busca credenciales automáticamente en Descargas ni en perfiles del navegador. Sin `YOUTUBE_AUTH_FILE` explícito, el chat permanece sin configurar. Las pruebas usan archivos ficticios temporales; no ejecutar `npm test` con credenciales de cuenta en variables heredadas.

En modo externo **Prueba**, Google limita la autorización y su token de renovación a siete días para este alcance. Antes de futuros ensayos hay que revisar el acceso y repetir la autorización personalmente cuando caduque; el lector debe detenerse con estado de acceso no disponible. No cambiar a producción ni ampliar permisos para evitar ese control sin una revisión separada. [Limitaciones oficiales de autorización en pruebas](https://support.google.com/cloud/answer/15549945?hl=en), consultadas el2026-11-14.

## Elegir la emisión

Usar `/block-wars/control?platform=youtube`, mantener ese panel fuera de OBS y consultar manualmente las emisiones propias. Elegir el video de forma explícita; nunca se selecciona automáticamente el primero. Seleccionar un video sólo inicia su lector: no crea, publica, inicia ni detiene una emisión de YouTube.

El servidor comprueba que el token corresponde al canal esperado y que el video pertenece a ese canal. Un video programado puede no tener chat activo: el estado correcto es **esperando LIVE**. La existencia de un ID de chat en una emisión no acredita actividad. Tras descubrir el chat activo, se descarta la primera respuesta de historial. Sólo comentarios nuevos de tipo `textMessageEvent` pueden activar comandos.

Los 14 comandos conservan autor, origen YouTube y efectos. Todos los comentarios conservan los FX sin enviar narración a ElevenLabs. Likes y suscriptores reales siguen pendientes; los botones de esos eventos son pruebas explícitas. Miembros, Super Chat y pagos no se convierten en recompensas.

## Límites y diagnóstico

- Una sesión seleccionada por servidor. Cambiar video o detener cancela el trabajo anterior. No hay cola de comandos de espectadores para ejecutar después.
- Transporte HTTP oficial por array JSON incremental, con alternativa `liveChatMessages.list`. Su formato autenticado real todavía requiere prueba. El sondeo respeta al menos 15 segundos y el intervalo de Google.
- Mensajes de más de 15 segundos o más de 5 segundos en el futuro se descartan. Dedupe de hasta 2048 identificadores en memoria; los IDs expuestos son HMAC efímeros, no IDs de canal.
- Respuestas y objetos tienen límites de bytes, profundidad y trabajo; las ráfagas sobrantes se descartan. Los tiempos de espera y el backoff evitan solicitudes solapadas sin límite.
- Presupuesto local conservador de 8000 unidades por fecha del Pacífico. Es un contador en memoria: reiniciar el proceso lo reinicia y no consulta la cuota real compartida de Google. Revisar el panel de cuotas del proyecto; no usar reinicios para eludirla.
- La lista manual se comparte entre peticiones concurrentes y se conserva 60 segundos. La consulta está limitada a la primera página de 50 canales/emisiones; falla de forma cerrada si no encuentra al propietario.
- Los errores son códigos fijos; no registrar cuerpos remotos, tokens, nombres o mensajes. Un fallo transitorio durante descubrimiento puede requerir seleccionar nuevamente el video; los fallos transitorios del lector se reintentan con espera.

## Contrato local y pruebas

Rutas bajo las mismas guardas de Host, Origin, tamaño JSON y tasa del servidor:

| Ruta | Función |
| --- | --- |
| `GET /api/youtube/status` | Estado y contadores sin credenciales |
| `GET /api/youtube/broadcasts` | Lista manual de emisiones del propietario |
| `POST /api/youtube/select` | JSON exacto `{ "videoId": "ID_de_11___" }`, 11 caracteres ASCII permitidos |
| `POST /api/youtube/stop` | JSON exacto `{}`, cancela el lector |

SSE dedicado: `youtube_state` y `youtube_comment`. Snake ignora estos eventos; `/api/command` sigue imponiendo simulación aunque el emisor intente indicar `source:youtube`. No existe ruta para importar credenciales desde el navegador.

```powershell
node --test tests/youtube-auth.test.cjs tests/youtube-chat.test.cjs tests/youtube-server.test.cjs
npm test
npm run check
npm audit --omit=dev --audit-level=high
```

La aceptación real requiere un LIVE **no listado autorizado**, un comentario nuevo de una persona, efecto y nombre correctos en OBS, rechazo de historial/duplicados y ausencia de TTS por comentarios. Antes de enviar señal hay que revisar inicio automático, clave, vista previa y autorización del operador. El ensayo OBS de 120 minutos y la ingestión real permanecen separados de los tests virtuales.

Reversión: detener el lector desde el panel, quitar `YOUTUBE_AUTH_FILE` del entorno y arrancar la rama anterior. No borrar perfiles, grabaciones ni claves locales. La revocación del permiso se hace personalmente desde la cuenta de Google.

Fuentes oficiales: [OAuth para aplicaciones instaladas](https://developers.google.com/identity/protocols/oauth2/native-app), [autenticación de YouTube LIVE](https://developers.google.com/youtube/data/live/authentication), [consulta de emisiones propias](https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/list), [streamList](https://developers.google.com/youtube/data/live/reference/rest/v3/liveChatMessages/streamList), [list e intervalos](https://developers.google.com/youtube/data/live/reference/rest/v3/liveChatMessages/list), [transporte HTTP de Google](https://docs.cloud.google.com/apis/docs/http), [cuotas](https://developers.google.com/youtube/data/determine_quota_cost). Consultadas el 2026-11-13.
