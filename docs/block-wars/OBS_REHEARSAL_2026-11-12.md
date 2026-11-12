# Resultado del primer ensayo grabado de OBS

Estado: **captura local comprobada; lanzamiento pendiente**. Archivo privado `LivesIA-2026-11-11_23-21-50.mkv`,888580925bytes, SHA256 `61d056b88cfedf845b92eff380186ad12058a67fc82af5fdf1476069d67c6d37`. No se añade video, texturas ni audio al repositorio.

## Evidencia obtenida

- OBS33.0.1 registró inicio23:21:50 y cierre correcto23:55:38 del11de noviembre, hora local de México. El propietario detuvo la grabación y cerró OBS.
- Duración de video **2026.933s (33min46.933s)**, H.264High,720×1280,9:16,30FPS. Pista AACLC,48kHz,estéreo, duración2026.837s.
- Se decodificaron completamente las dos pistas con FFmpeg7.1 existente en el equipo, demuxer Matroska y protocolo `file` fijados. `-xerror` terminó con código0. El filtro `blackdetect=d=2:pix_th=0.05` no reportó intervalos negros. Esto no es una prueba de ausencia de toda congelación.
- Se inspeccionaron fotogramas a30,900y1800s: terreno/pico distintos, puntajes crecientes y profundidad visible100→385→606. El modo infinito continuaba al minuto30. No aparece cámara, micrófono ni panel de control en la imagen.
- La pista contiene sonidos, con pico global **−37.17dBFS**. Es un nivel bajo que requiere ajustar y escuchar la mezcla antes de emitir. El RMS global está dominado por silencios entre eventos y no se usa como objetivo de mezcla. No hubo voz de ElevenLabs porque no estaba configurada.
- El log de OBS registra60807frames entregados al muxer y60840dibujados; la primera decodificación con sincronización predeterminada reportó60806frames. Son contadores diferentes: no se presenta su diferencia como una medición de frames perdidos. El log al cerrar informa0fugas de memoria detectadas por OBS; no acredita ausencia de fugas en toda la aplicación.

Los artefactos locales ignorados están en `artifacts/first-live/`: log de decodificación completa, tres PNG y una muestra WAV. El archivo original permanece en `%LOCALAPPDATA%/LivesIA/recordings`.

## Incidencias y límites

1. El CSS inline que OBS intenta inyectar fue rechazado por la CSP del juego en tres cargas previas a la grabación. La fuente se mostró correctamente. Queda pendiente eliminar la inyección innecesaria o autorizar exclusivamente ese estilo conocido; no relajar scripts ni permitir inline de forma general por este aviso.
2. Mezcla de FX baja: pendiente una prueba de escucha y ajuste relativo a la voz real, sin saturación. Detectar audio no comprueba sincronía perceptual ni ausencia de eco.
3. La fuente se cargó durante el desarrollo previo al commit `e99bd51`; no se había recargado después de todas las reparaciones de transporte. Esta captura no valida retrospectivamente los controles nuevos de audio o la atribución corregida de acciones diferidas.
4. Se verificaron33min47s reales, **no120min**. Falta el ensayo prolongado con pausas, ráfagas, reconexiones y muestras de rendimiento del motor.
5. Sin conexión real a TikTok/YouTube, sin credencial de ElevenLabs y sin monetización validada. El archivo por sí solo no habilita ninguna plataforma.

## Comando reproducible

Usar la ruta al FFmpeg ya instalado y al archivo local, desde la raíz del proyecto:

```powershell
& $ffmpegPath -nostdin -hide_banner -v info -xerror -protocol_whitelist file -f matroska -i $recordingPath -map 0:v:0 -map 0:a:0 -vf 'blackdetect=d=2:pix_th=0.05' -af 'astats=metadata=0:reset=0,silencedetect=n=-60dB:d=2' -stats_period 30 -f null - 2> artifacts/first-live/full-decode.log
```

La auditoría usó un ejecutable existente de `imageio_ffmpeg`; no instaló dependencias ni modificó VideosIA.
