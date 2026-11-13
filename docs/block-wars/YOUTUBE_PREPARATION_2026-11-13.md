# Preparación local YouTube — 2026-11-13

## Resultado implementado

El propietario eligió YouTube, sin cámara ni micrófono, con ElevenLabs inicialmente sólo para likes y suscriptores gratuitos. La variante `?platform=youtube` ahora aplica esa política a las acciones aceptadas del juego. Los14comandos destacados y los eventos automáticos mantienen sus FX, sin solicitudes TTS. La variante anterior y Snake se conservan.

Las metas de likes se atribuyen a la comunidad, incluso al drenar créditos diferidos. Los votos `!boom` y `!voterain` no se confunden con likes. El botón de follow del panel YouTube se presenta como **suscriptor gratuito de prueba**; no confirma suscripciones reales. Los dos tipos nuevos de narración sólo admiten `source:simulator` y usan prefijo «Prueba».

`scripts/start-youtube-voice.ps1` prepara Voice ID, clave oculta, Flash v2.5 y un presupuesto inicial de12000caracteres/hora. No escribe credenciales, no mata procesos y no abre OBS ni inicia emisiones. Restaura el entorno anterior al terminar. El usuario debe introducir la clave personalmente en una terminal local; nunca en el chat.

## Evidencia ejecutada

| Comprobación | Resultado |
| --- | --- |
| Línea base previa | 215pruebas; sintaxis49archivos |
| `npm test` | 224aprobadas,0fallos,0omitidas en Windows |
| `npm run check` | Sintaxis correcta en50archivos; sustituto de diagnósticos IDE |
| Pruebas del lanzador incluidas en la suite | CheckOnly no interactivo/no exposición de clave ficticia; parámetros inválidos rechazados antes del prompt |
| `start-youtube-voice.ps1 -CheckOnly` | Entrada oculta preparada, sin emisión; puerto ocupado por servidor local existente |
| `start-first-live.ps1 -Platform youtube -CheckOnly` en PowerShell7.6.9 | `ready:true`, rutas y firma OBS verificadas, sin emisión |
| Revisión independiente de lógica, seguridad y calidad | PASS las tres; cada revisión comprobó55pruebas pertinentes |
| Estado seguro del servidor local | `enabled:false`, clave/voz sin configurar,0solicitudes enviadas |

Las pruebas de narración usan respuestas locales simuladas. No se consumieron créditos ni se verificó autenticación o reproducción con ElevenLabs. Las pruebas nuevas cubren comandos/automáticos sin TTS, likes anónimos diferidos, separación de votos, suscriptores de prueba, silencio y emergencia. La prueba CheckOnly no demuestra el funcionamiento del prompt con una clave real.

Limitación del entorno: dos comprobaciones OBS mediante `powershell.exe` lanzado desde el helper Python fallaron al cargar `Microsoft.PowerShell.Security`. La misma comprobación desde la terminal PowerShell7.6.9 del equipo pasó. No se eliminó ni omitió la verificación de firma. Usar PowerShell7 para la preparación OBS en este equipo; la compatibilidad de ese lanzamiento anidado queda pendiente. Las dos pruebas del lanzador de voz sí pasaron con `powershell.exe`.

## Pendiente para el LIVE

1. Volver a comprobar en YouTube Studio el acceso LIVE tras la solicitud del12de noviembre; el plazo mostrado no prueba aprobación.
2. Conectar la lectura autorizada del chat de YouTube y validar comentarios reales, deduplicación y reconexión. Actualmente todos los botones son simulaciones.
3. Elegir la voz, introducir la clave localmente y escuchar el primer ensayo. La conexión del plugin ElevenLabs no configura la clave del servidor.
4. Abrir **LivesIA YouTube / Mina YouTube**, verificar la fuente vertical y grabar una muestra nueva con voz/FX. El ensayo anterior tuvo FX bajos; su medición no acredita la mezcla nueva.
5. Completar120minutos reales en OBS y revisar recuperación, audio, frames y recursos. Los ensayos virtuales previos no sustituyen esta comprobación.
6. Revisar la vista previa y los recursos antes de autorizar la emisión. No se inició una transmisión ni se configuraron pagos.

Durante esta preparación quedó pendiente que el propietario cancelara un aviso de administrador de TikTok. El trabajo de Windows se detuvo en ese aviso; no se automatizó la autorización ni se continuó instalando TikTok para el montaje de YouTube.

## Réplica y reversión

```powershell
npm test
npm run check
.\scripts\start-youtube-voice.ps1 -CheckOnly
.\scripts\start-first-live.ps1 -Platform youtube -CheckOnly
```

Preparación de cuenta y OBS en [YOUTUBE_LIVE_SETUP.md](YOUTUBE_LIVE_SETUP.md); entrada privada y límites en [SPEECH_SETUP.md](SPEECH_SETUP.md). Para revertir este incremento usar `git revert` del commit de preparación; detener el servidor con `Ctrl+C` en su propia ventana. No borrar perfiles, grabaciones ni recursos locales del propietario.
