# Audio local para el ensayo Minecraft

El propietario solicitó sonidos originales de Minecraft y aportó una pista de música local el 2026-11-14. Esta preparación mantiene ambos tipos de archivo fuera de Git. No acredita autorización comercial sobre recursos de Mojang ni sobre la composición musical subyacente. No se descargan videos de YouTube, no se ejecuta el cliente Minecraft y no se importan sus canciones.

## Sonidos originales

Ejecutar desde el proyecto:

```powershell
python scripts/import_minecraft_sounds.py
```

El importador verifica el manifiesto oficial de Minecraft 26.3 fijado por SHA1, comprueba su índice de recursos fijado y descarga únicamente 22 archivos Ogg Vorbis de `resources.download.minecraft.net`. Cada archivo conserva bytes originales y se verifica por tamaño, firma y SHA1. No hay redirecciones, ejecución de archivos ni extracción indiscriminada. La instalación se realiza completa en un directorio temporal antes de publicarse. Una instalación existente sólo se verifica: no se reemplaza ni se borra.

Destino ignorado: `assets-local/minecraft-sounds/`. Su `provenance.json` contiene procedencia e integridad, sin datos de espectadores ni credenciales. El servidor permite únicamente los nombres de sonido estáticos; no sirve el archivo de procedencia.

La tabla `games/block-wars/audio-assets.js` vincula eventos con archivos reales: mecha y explosiones de TNT, trueno/lluvia, fuego, agua, arco/flecha, Creeper, piedra, y sonidos de encantamiento, élitros, tridente, dragón y portal. NUKE, MEGA y otros efectos propios combinan esos sonidos existentes: Minecraft no define comandos con esos nombres. No se sintetizan pitidos sustitutos si faltan recursos; el panel indica el recurso no disponible.

Hay hasta ocho sonidos simultáneos, con liberación al terminar, fallar o superar 12 segundos. Los contactos de minería se agrupan a un máximo de diez por segundo y los impactos del mismo tipo a uno por 150ms. Esos límites protegen la mezcla y son independientes de la aceptación de comandos.

## Música separada

El archivo aportado se conserva sin modificar. La preparación local extrajo exactamente `00:36–00:56` a `assets-local/audio/background-loop.wav`: 20.000 segundos, PCM16 estéreo a 44.1kHz, con entrada/salida de 10ms para evitar clics en el empalme. Su reproducción usa un canal de música con `loop=true`, separado de efectos y ElevenLabs. No se incluye el audio en commits ni PRs.

Recorte reproducible desde un archivo autorizado:

```powershell
ffmpeg -nostdin -n -ss 36 -i RUTA_LOCAL -t 20 -vn -af "afade=t=in:st=0:d=0.01,afade=t=out:st=19.99:d=0.01" -ac 2 -ar 44100 -c:a pcm_s16le assets-local/audio/background-loop.wav
```

En la muestra preparada: pico −0.391dBFS y RMS −15.361dBFS antes de ganancias. El canal de música inicia a 18%, multiplicado por el volumen general de 60%; verificar la escucha remota y ajustar en el panel antes de publicar. La ganancia por defecto no acredita ausencia de saturación en todas las combinaciones de efectos.

## Mezcla y parada

`bw_audio.settings` acepta `musicEnabled`, `musicVolume`, `fxVolume` y `voiceVolume` además de los controles previos. Los volúmenes están entre 0 y 1. El silencio general, pausa, emergencia y cierre liberan los sonidos y la música; reanudar la música arranca su bucle de nuevo, sin reproducir efectos anteriores.

Activar sonido desde OBS → Interactuar sigue siendo necesario tras recargar la fuente. Si falta la pista o un Ogg, el juego continúa y muestra el estado correspondiente; la falta de música nunca provoca solicitudes de voz. Los comentarios de YouTube siguen sin narración. No se realizaron nuevas llamadas pagadas para preparar estos archivos.

Verificar: `node --test tests/block-audio.test.cjs tests/minecraft-sounds.test.cjs`. Las pruebas usan archivos y dispositivos de audio ficticios, no credenciales ni descargas reales. La escucha y mezcla final en OBS requieren ensayo aparte.
