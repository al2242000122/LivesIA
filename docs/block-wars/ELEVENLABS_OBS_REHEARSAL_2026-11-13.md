# ElevenLabs y OBS — prueba real autorizada

El propietario autorizó la prueba de la CLI y dos avisos en OBS, sin iniciar transmisión. El13de noviembre se ejecutó `onboard test --env-path .env.local`: devolvió HTTP200 y `next:done`, generando un MP3 local de1.88s. FFmpeg decodificó ese audio completo sin errores. La clave permaneció en `.env.local`, fuera de Git y sin abrir/imprimir su contenido.

Se completaron Voice ID y Flash v2.5 en la configuración local ignorada, conservando valores existentes si los había. La voz elegida fue David, español mexicano, consultada en la cuenta; su ID no se incorpora al repositorio. Se detuvo el servidor anterior mediante su sesión propia y se inició `scripts/start.cjs`. El estado seguro confirmó clave/voz configuradas y contadores iniciales en0.

## Recorrido probado

OBS portable mantuvo **LivesIA YouTube / Mina YouTube**. Se habilitó la narración mediante el panel, volumen60/100 y fuente OBS0.8. Sólo la fuente de OBS tenía audio activado; la segunda arena del navegador recibió las mismas simulaciones sin reproducir voz.

1. Botón25likes: TNT comunitaria aceptada, con frase fija de meta de likes y prefijo «Prueba», sin atribuir likes a una persona.
2. Suscriptor gratuito de prueba, identidad ficticia «Minero demo»: frase fija de agradecimiento, también con prefijo «Prueba».
3. RAIN: efectos de lluvia de TNT; el contador de solicitudes TTS se mantuvo en2.

Tras ambos avisos, el estado del narrador mostró `requestsSent:2`, `charactersUsed:121`, `inFlight:0`, `errorCode:null`. Son caracteres reservados por la aplicación, no una factura de créditos. La solicitud adicional de la CLI no pertenece a esos contadores. No se enviaron más solicitudes TTS del juego.

## Grabación y medición

Archivo local, fuera de Git:

`%LOCALAPPDATA%/LivesIA/recordings-youtube/LivesIA-2026-11-13_21-20-10.mkv`

| Dato | Resultado |
| --- | --- |
| Tamaño | 155040574bytes |
| Duración Matroska | 154.766s |
| Video | H.264 High,720×1280,30FPS,Rec.709 |
| Audio | AAC-LC,44.1kHz,estéreo |
| Decodificación completa con FFmpeg7.1 y `-xerror` | Exit0;4643frames |
| Pico de la mezcla | −8.140822dBFS |
| RMS peak de la mezcla | −16.121445dBFS |
| Contador de emisión OBS al terminar | 00:00:00 |

La grabación contiene los dos avisos y los FX. Se extrajeron dos ventanas de audio (32–37s y76–81s) a `artifacts/youtube-preparation/likes-y-suscriptor.mp3` para escucharlas juntas. La muestra tiene margen de pico y no presentó saturación digital. Los diagnósticos completos están en `voice-full-decode.log`, ignorado por Git.

Se decodificaron audio y video completos con protocolos locales y demuxer Matroska fijado, usando `blackdetect`, `astats` y `silencedetect`. No se inició una emisión ni se introdujo una clave de transmisión. Al terminar, OBS quedó sin grabación ni emisión activas; el servidor local sigue disponible.

## Alcance pendiente

Esta prueba confirma generación con la clave del propietario y captura de voz/FX en OBS. La valoración de timbre/pronunciación queda para escuchar la muestra; no se midió latencia extremo a extremo ni sincronía precisa entre voz y efecto. Tampoco acredita dos horas continuas, estabilidad de subida o comentarios reales de YouTube. Likes y suscriptores siguen siendo simulaciones locales: el conector oficial del chat y los datos reales aún están pendientes.
