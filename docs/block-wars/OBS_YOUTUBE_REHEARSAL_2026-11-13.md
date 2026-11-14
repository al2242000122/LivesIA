# Ensayo OBS YouTube — 2026-11-13

OBS33.0.1 portable abrió el perfil/colección **LivesIA YouTube**, escena **Mina YouTube**, usando el acceso directo local «Mina Infinita YouTube» del escritorio. Sólo contiene la fuente de navegador de la mina a720×1280, con audio propio; no hay cámara, micrófono ni captura de escritorio. Se activó el sonido desde Interactuar. La pantalla y el registro de OBS confirmaron el perfil correcto y30FPS.

La sala autenticada de YouTube ya permite preparar una emisión. Se guardó el ensayo «MINA INFINITA LIVE ⛏️ Pico que rebota | Ensayo del canal», No listado y Videojuegos. La clasificación de público general fue confirmada por el propietario. La sala permaneció sin señal y el contador de transmisión de OBS en00:00:00. No se inició una emisión ni se reveló/copió la clave de transmisión.

## Grabaciones locales

Archivos fuera de Git, en `%LOCALAPPDATA%/LivesIA/recordings-youtube/`:

| Muestra | Archivo | Duración contenedor | Tamaño | Pico de audio |
| --- | --- | --- | --- | --- |
| Antes de calibrar FX | `LivesIA-2026-11-13_17-35-58.mkv` | 147.133s | 147250483bytes | −33.499481dBFS |
| FX calibrados | `LivesIA-2026-11-13_17-41-20.mkv` | 122.100s | 122417864bytes | −21.572997dBFS |

Ambas muestras: H.264 High,720×1280,30FPS,Rec.709, AAC-LC44.1kHz estéreo. El registro confirma x264CBR8000kbps, keyint60 y AAC128kbps. Se probaron RAIN, THUNDER, STORM y NUKE desde el panel de simulación; el panel reportó dos arenas receptoras (OBS y la vista de prueba del navegador). Sólo se activó el audio de OBS para grabar.

FFmpeg7.1 existente decodificó audio y video completos de ambas muestras con `-xerror`, `-protocol_whitelist file` y demuxer Matroska fijado. Ambas ejecuciones terminaron con0. Se decodificaron4412y3663frames, respectivamente. No se detectaron intervalos negros de2s o más ni muestras NaN/Inf. El silencio entre efectos es esperado; el juego no tiene música de fondo.

El nivel inicial de cada nota pasó de0.035a0.1; la ganancia nominal aumenta9.12dB. Los tiempos y la superposición de efectos difieren entre muestras: la diferencia de sus picos máximos no es una medición controlada de esa ganancia. El límite de8notas permite como máximo0.8 de amplitud sumada antes del volumen maestro. La voz usa su ruta anterior y requiere otra comprobación de mezcla antes del LIVE.

Diagnósticos y captura de Studio permanecen en `artifacts/youtube-preparation/`, ignorado por Git. El registro de OBS conserva una advertencia CSP del estilo inline predeterminado de su fuente de navegador. No se relajó la CSP; esta prueba no mostró una captura negra por ese aviso.

## Réplica

Con FFmpeg existente y una grabación local cerrada, decodificar el archivo completo:

```powershell
& $ffmpegPath -nostdin -hide_banner -v info -xerror -protocol_whitelist file -f matroska -i $recordingPath -map 0:v:0 -map 0:a:0 -vf 'blackdetect=d=2:pix_th=0.05' -af 'astats=metadata=0:reset=0,silencedetect=n=-60dB:d=2' -stats_period 30 -f null -
```

Se reutilizó FFmpeg de una instalación local de `imageio_ffmpeg`; no se instaló ni modificó VideosIA. No se escuchó ni midió narración real de ElevenLabs en estas muestras. Dos grabaciones cortas no acreditan120minutos continuos, estabilidad de subida, chat conectado o monetización.
