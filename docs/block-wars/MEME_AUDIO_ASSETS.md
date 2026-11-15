# Audio local de 67 y SIUUU

El propietario pidió buscar e incorporar audio para los comandos67 ySIUUU, con el grito original de Cristiano Ronaldo paraSIUUU. MESSI no tiene audio propio. No se usa TTS ni una imitación de voz para estos clips.

| Archivo local | Fuente y atribución | Duración | Condiciones comprobadas |
|---|---|---|---|
| `meme_67.ogg` | [Sixseven67, qubodup, Freesound832306](https://freesound.org/people/qubodup/sounds/832306/) | 2.972s | La ficha dice voz propia y muestraCC0. Se importa su previewOGG sin modificar. |
| `meme_siuuu.mp3` | [SUII!, subida por noface1 en Myinstants](https://www.myinstants.com/en/instant/suii-24732/) | 1.848s | La ficha identifica el grito de Cristiano Ronaldo. Es una copia comunitaria: no se verificó permiso del titular ni licencia de retransmisión. No se presenta como royalty-free. |

La segunda grabación es el fragmento vocal reconocible solicitado, no una voz sintética ni una versión generada. La atribución al personaje procede de la ficha de origen; no se hizo una verificación forense de identidad. No se descarga una canción ni una grabación larga. Que un portal permita descargar un archivo no acredita por sí solo los derechos para una emisión monetizada.

`python scripts/import_meme_audio.py` descarga exclusivamente dos URLHTTPS fijadas, sin redirecciones, y comprueba tamaño, SHA256, contenedor y duración máxima4s antes de escribir ambos archivos. Se conservan sus formatos reales: OggVorbis para67 y MPEG-1LayerIII/MP3 paraSIUUU. No se cambia la extensión para fingir una conversión. El importador no descarga ni ejecuta programas y no depende de FFmpeg.

Los archivos se guardan en `assets-local/minecraft-sounds/`, ignorado porGit, junto a una procedencia separada `meme-audio-provenance.json`. Los22sonidos Minecraft y su procedencia original permanecen intactos. Repetir la importación verifica los bytes sin volver a descargar; una instalación parcial o alterada se rechaza en lugar de sobrescribir archivos desconocidos. No añadir estos binarios a commits/PRs.

La reproducción usa el mezclador FX local y un volumen de muestra moderado; los clips conservan sus bytes originales. No se acredita escucha remota o mezcla real de OBS por la importación. Las pruebas offline cubren muestras truncadas, hashes/tamaños/duración incorrectos, instalación incompleta, repetición y conservación de sonidos previos.

Los hashes y URL exactos están en `scripts/import_meme_audio.py`. Para comprobar: `node --test tests/import-meme-audio.test.cjs`. Para revertir el código, usar el commit anterior de la rama; no borrar ni reemplazar los recursos locales anteriores como parte del rollback.
