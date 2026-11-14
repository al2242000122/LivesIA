# Voz reactiva de ElevenLabs — ensayo local

**Alcance inicial YouTube, confirmado por el propietario el 2026-11-13:** voz sólo para metas comunitarias de likes y suscriptores gratuitos; los comandos y eventos automáticos conservan sus FX sin narración. El ensayo identifica todas las recompensas como «Prueba». Todavía no existe un conector de eventos reales de YouTube: estos avisos son simulaciones, no una detección de likes o suscripciones del canal. En TikTok, follow y suscripción pagada siguen siendo distintos.

**Prueba real autorizada:** la CLI y los dos avisos funcionaron con la cuenta del propietario; OBS capturó la mezcla y FFmpeg decodificó la grabación completa. Pico−8.14dBFS;2solicitudes del juego y121caracteres reservados. Ver [evidencia y límites](ELEVENLABS_OBS_REHEARSAL_2026-11-13.md). La selección subjetiva de voz, la latencia precisa y el ensayo prolongado continúan pendientes.

Implementación local: el servidor convierte **acciones confirmadas del juego** en frases cortas en español. No acepta texto libre, comentarios completos, URLs, SSML, un modelo o una voz enviados por el navegador. Conserva el juego infinito y Snake. La voz no habilita regalos ni suscripciones pagadas, y configurar credenciales no verifica una conexión real con TikTok ni una emisión en OBS.

## Preparar la cuenta y la voz

**Configuración recomendada por CLI:** el propietario autorizó `npx -y @elevenlabs/cli@latest onboard init`. Se ejecutó CLI1.11.0, se aprobó personalmente el acceso en el navegador y la CLI guardó una clave en `.env.local`, ignorado por Git. Nunca abrir o imprimir ese archivo para verificarlo: usar `onboard check`. El [registro de integración](ELEVENLABS_ONBOARDING.md) explica el SDK y los pendientes reales. No crear otra clave si la existente es válida.

1. En tu cuenta de ElevenLabs, elige una voz con permiso de uso y prueba su pronunciación en español. Copia su **Voice ID**; el nombre visible de la voz no sirve como ID. No clonar voces sin autorización.
2. Usa el onboarding oficial para conectar la cuenta, revisando los permisos antes de autorizar. Revisa ahí tu cuota y condiciones antes del ensayo; este proyecto no compra un plan.
3. **No compartir claves en el chat, panel, URL, capturas ni Git.** El SDK oficial se instala mediante `npm ci` desde el lock. `npm start` carga `.env.local` sólo en el servidor; este arranque requiere Node20.12+ si existe ese archivo. El navegador no recibe credenciales.

La entrada oculta siguiente se conserva como alternativa manual cuando se suministra una clave propia mediante variables de proceso; no es necesaria para repetir la autorización por CLI ya completada. No copiar la clave del archivo al chat.

Desde una terminal local visible, en la raíz de LivesIA. Primero detener el servidor anterior con `Ctrl+C` en su propia ventana; el lanzador rechaza un puerto ocupado y no cierra procesos ajenos. La clave se solicita ocultamente, sólo se conserva en memoria del proceso y el entorno anterior se restaura al terminar:

```powershell
.\scripts\start-youtube-voice.ps1 -CheckOnly
.\scripts\start-youtube-voice.ps1
```

El lanzador pide Voice ID y clave, valida sus formatos y usa Flash v2.5 con un presupuesto de12000caracteres/hora. No inicia OBS, grabación ni emisión. Las variables pertenecen al proceso del servidor; el navegador y la fuente de OBS no reciben la clave ni el Voice ID. Reinicia el servidor al cambiar configuración. Mantén el servicio en `127.0.0.1`, sin túneles ni exposición pública. El modo `-CheckOnly` no pide ni muestra secretos y no comprueba autenticación con ElevenLabs.

## Configuración y límites

| Variable | Valor predeterminado / valores admitidos |
| --- | --- |
| `ELEVENLABS_API_KEY` | Sin valor; necesaria. Cadena de 16–256 caracteres alfanuméricos, `_` o `-` |
| `ELEVENLABS_VOICE_ID` | Sin valor; necesario. 8–80 caracteres alfanuméricos, `_` o `-` |
| `ELEVENLABS_MODEL_ID` | `eleven_flash_v2_5`; admite también `eleven_turbo_v2_5` y `eleven_multilingual_v2` |
| `ELEVENLABS_MAX_CHARACTERS_PER_HOUR` | `12000`; entero entre `100` y `100000` |
| `ELEVENLABS_MIN_INTERVAL_MS` | `5000`; entero entre `5000` y `60000` |

Un valor inválido deja la voz sin habilitar. Las frases tienen como máximo 160 caracteres, los nombres pronunciados como máximo 32 caracteres Unicode y la respuesta MP3 como máximo 2 MiB. Cada solicitud tiene 8 segundos de plazo total, incluida la descarga. Se permiten dos solicitudes simultáneas y al menos cinco segundos entre inicios; no se crea una cola sin límite en el servidor.

Flash y Turbo reciben la indicación de idioma español. Para Multilingual v2 se omite `language_code`, que ese modelo no admite; el texto de las plantillas sigue siendo español. [Aclaración oficial de compatibilidad](https://elevenlabs.io/docs/changelog/2026/6/29).

El presupuesto se reserva **antes de solicitar el audio**, incluso si el proveedor falla, tarda demasiado o se desconecta el navegador. No se descuenta el consumo reservado tras un error, porque la solicitud pudo haberse procesado. Los contadores son locales y conservadores: no representan facturación ni confirman que una narración se haya escuchado. La ventana horaria comienza al iniciar el módulo y se renueva después de una hora. Reiniciar el servidor reinicia presupuesto y deduplicación; configura también un límite en ElevenLabs.

## Comprobar el ensayo

Para YouTube abre `/block-wars?platform=youtube` y su panel `/block-wars/control?platform=youtube`. Habilita el audio y la narración. Prueba25likes hasta que se acepte la TNT comunitaria y «Suscriptor de prueba»: sólo ellos solicitan voz. Si el motor aplaza la TNT, el aviso espera su aceptación. Prueba después RAIN, THUNDER, STORM y NUKE: deben producir FX sin consumir TTS. `!boom` y `!voterain` tampoco se anuncian como likes. Fuera de la variante YouTube se conserva la narración anterior de acciones.

Los eventos simulados se narran con el prefijo **«Prueba»**. Verifica primero con audífonos o grabación local; después comprueba en OBS que la fuente de navegador entrega audio una sola vez, sin eco ni una segunda pestaña reproduciéndolo. Revisa la grabación antes de emitir. Si la voz no está configurada, el juego debe continuar con sus efectos locales.

En otra terminal se puede consultar únicamente el estado seguro:

```powershell
Invoke-RestMethod 'http://127.0.0.1:4173/api/block-wars/speech/status'
node --test tests/speech.test.cjs
```

`enabled` significa **configuración válida**, no una prueba de autenticación con el proveedor. El estado expone `keyConfigured`, `voiceConfigured`, `errorCode`, `charactersUsed`, `characterLimit`, `requestsSent` e `inFlight`; no publica claves, IDs de voz ni nombres de participantes. Las pruebas automatizadas usan respuestas locales simuladas y no consumen créditos.

| Código de error | Acción del operador |
| --- | --- |
| `not_configured`, `invalid_*_configuration` | Corregir variables locales y reiniciar el servidor |
| `provider_auth` | Revisar permisos de la clave y acceso a la voz en ElevenLabs |
| `provider_rate_limit`, `rate_limit`, `concurrency_limit` | Reducir frecuencia; no reintentar en bucle |
| `character_budget` | Esperar a la siguiente ventana o revisar el límite antes de aumentarlo |
| `provider_timeout`, `provider_error` | Mantener el juego y sonidos locales; revisar conectividad antes de otro ensayo |
| `invalid_audio`, `audio_too_large` | El audio fue rechazado; no se reenvía la respuesta del proveedor |
| `duplicate_action` | La acción ya reservó narración; no reenviarla con otro ID |
| `cancelled` | El solicitante canceló o se desconectó; puede existir consumo previo |

## Contrato implementado

`lib/speech.js` exporta `createSpeech({env, fetchImpl, now})`, con `status()` y `synthesize(payload, {signal})`, y `validatePayload(payload)`, que devuelve una copia válida o `null`. Una opción `timers` permite comprobar el plazo con un reloj de prueba, sin esperar ni usar la red. El módulo no escribe archivos ni registra nombres o secretos.

`POST /api/block-wars/speech` recibe exactamente estos cinco campos:

```json
{
  "actionId": "d1fa9c0a-3651-4250-844f-6b727fc7856b",
  "kind": "nuke",
  "actorName": "Ana María",
  "team": "dark",
  "source": "simulator"
}
```

- `actionId`: 8–80 caracteres, empieza por letra o dígito y sólo usa letras ASCII, dígitos, `:`, `_`, `-`. Se conserva dos minutos en memoria para evitar narrar/cobrar dos veces la misma acción, incluso después de un error. La tabla admite hasta 256 entradas y rechaza nuevas solicitudes si se llena; no expulsa entradas vigentes.
- `kind`: los20eventos existentes, más `mine`, `follow` y los refuerzos `turbo` y `descomunal`. Añade `like_milestone` y `youtube_subscriber` exclusivamente con `source:simulator`; no admite regalos ni suscripciones pagadas. La selección de qué acción se narra se aplica en la experiencia del juego; el endpoint conserva los tipos anteriores para compatibilidad.
- `actorName`: hasta 64 caracteres de entrada, letras/marcas/números Unicode, espacios, `_` y `-`; admite cadena vacía. Se normaliza y recorta antes de pronunciarlo. Un filtro local básico de palabras ofensivas usa una atribución genérica a la comunidad; **no equivale a moderación completa**. Nunca se lee el comentario recibido. El operador debe poder silenciar la narración.
- `team`: `dark`, `light` o `neutral`.
- `source`: `simulator`, `tikfinity` o `automatic`. Simulación se anuncia como prueba; los eventos automáticos se atribuyen a la mina, sin nombre inventado. Un follow automático se rechaza. El campo de fuente por sí solo no acredita que el evento sea real: eso depende del adaptador y su validación.

La experiencia recibe internamente `{platform:'youtube'}` como quinto argumento y pasa al audio `narrate` y, sólo para las dos recompensas, `speechKind`. No amplía los cinco campos HTTP ni permite frases libres. Las metas de likes nunca pronuncian el nombre de un espectador. Las suscripciones de ensayo no se aceptan desde TikFinity ni desde el temporizador.

Al habilitar la voz se envían a ElevenLabs la frase resultante y, cuando corresponda, el nombre público normalizado, Voice ID y modelo configurados. El SDK añade cabeceras públicas de nombre/versión, runtimeNode y User-Agent. No se envían el chat completo, ID de TikTok ni telemetría de la partida. El audio permanece en memoria durante la respuesta. La ruta fija es HTTPS de ElevenLabs, con redirecciones bloqueadas y reintentos desactivados; el solicitante no puede elegir host o URL. El servidor devuelve MP3 o un error fijo y nunca reenvía mensajes privados del proveedor. La latencia, el volumen y la captura OBS todavía deben medirse con la voz y equipo elegidos.

Referencias oficiales consultadas el 2026-11-11: [Stream speech](https://elevenlabs.io/docs/api-reference/text-to-speech/stream), [Streaming Text to Speech](https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/streaming). El endpoint acepta el formato `mp3_44100_128`; el modelo inicial es Flash v2.5. La disponibilidad de voces, cuotas y planes se comprueba en la cuenta del propietario.
