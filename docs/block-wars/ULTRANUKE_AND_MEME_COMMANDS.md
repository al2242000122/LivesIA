# ULTRANUKE y comandos del ensayo

El propietario conserva LIKE →3cargas y SUB público →10cargas, con el nombre visible **ULTRANUKE**. Cada recompensa lleva una variante interna: LIKE usa el bloque amarillo con símbolo nuclear del pack Minecraught Nuke; SUB usa el misil de HBM Nuclear Tech Mod. Son recursos de mods de Minecraft, no bombas incluidas en Minecraft vanilla. Se importan PNG originales sin modificar; no se ejecuta ni instala ningún mod.

El importador `python scripts/import_nuke_textures.py` fija el paquete por SHA256 y el recurso de HBM por commit+SHA256. Extrae exclusivamente la imagen nuclear del ZIP, comprueba CRC/dimensiones16×16 y guarda dos PNG, procedencia y avisos en `assets-local/nukes/`, ignorado porGit. La ruta separada conserva intacta la instalación oficial de49texturas. Si ya existen los dos recursos, verifica sus hashes sin red; si están alterados, rechaza la importación sin sobrescribirlos. Descargas acotadas, URLs fijadas y redirecciones prohibidas. Las pruebas offline verifican integridad, dimensiones, archivos extra, preservación y repetición.

Fuentes: [Minecraught Nuke y declaración MIT](https://modrinth.com/mod/minecraught-nuke), [HBM en el commit importado](https://github.com/HbmMods/Hbm-s-Nuclear-Tech-GIT/tree/d4708ef9c32418b8fdc4758d5d427ae9d99bd97a), [licencia de HBM](https://github.com/HbmMods/Hbm-s-Nuclear-Tech-GIT/blob/d4708ef9c32418b8fdc4758d5d427ae9d99bd97a/README.md#license). Los autores conservan sus derechos; copias y procedencia permanecen locales, fuera de commits y paquetes públicos.

## Destrucción real y aspecto

LIKE usa tamaño4.2 y radio7.5; SUB tamaño5.2 y radio11. El núcleo físico sigue siendo pequeño para entrar en pozos estrechos. Sus ondas posteriores recorren más terreno hacia abajo, conservando autor, fuente e ID al reciclar filas. Todas las fases se procesan dentro de los presupuestos existentes de bloques por actualización, sin perder comandos por ocupación. La nube pixelada dura7s en LIKE y9s en SUB; el movimiento reducido elimina agitación y limita frentes sin cambiar el daño. El comando de chat NUKE conserva su comportamiento anterior.

`rewardVariant` es metadata interna, no un campo del JSON de comandos ni un permiso para fabricar recompensas oficiales. La alerta, narración tipada y los carteles dicen ULTRANUKE y conservan las cantidades3/10. Los permisos de voz de un uso y sus presupuestos permanecen. No se atribuyen likes a una persona.

## Partículas originales y colores

Las TNT de una salva se distinguen en rojo, azul y verde mediante filtros de color sobre la textura original; NUKE mantiene sus tres paletas y ULTRANUKE conserva sus dos diseños. No se redibujan los PNG descargados.

`python scripts/import_minecraft_particles.py` verifica el cliente oficial fijado y extrae24PNG originales en `assets-local/minecraft-particles/`:16fotogramas32×32 de explosión y8fotogramas8×8 de humo en el orden de los JSON originales. Se cargan hasta75imágenes en total (49base,2nucleares,24partículas); la falta de recursos opcionales conserva el respaldo de dibujo y un estado incompleto. No se ejecuta el JAR ni se incluyen los recursos enGit.

Las detonaciones TNT y NUKE dibujan los fotogramas reales con transparencia, humo y escalado de píxel. Hay un presupuesto compartido de96dibujos de partículas por fotograma, además de las seis nubes detalladas de ULTRANUKE. Movimiento reducido usa menos partículas sin alterar daño. Los impactos fuera de pantalla no consumen el presupuesto de los visibles. Esta composición Canvas usa los recursos originales; no afirma reproducir exactamente el shader3D o la iluminación del cliente Minecraft.

## Tres comandos nuevos

| Comentario | Acción en la mina | Audio propio |
|---|---|---|
| 67, !67, SIX SEVEN | Salva rápida de13explosivos, agrupados como6+7, con impactos sucesivos | Sixseven de qubodup,2.972s, CC0 |
| MESSI | Balón pixelado con trayectoria curva, rebotes y destrucción por contacto | Ninguno: sin cue, impacto ni narración de MESSI |
| SIUU, SIUUU | Salto y aterrizajes destructivos, ondas y abanico de picos | Fragmento de1.848s identificado como el grito de Cristiano Ronaldo |

Los17comandos destacados se superponen y usan la FIFO cuando falta espacio activo. Las20acciones anteriores permanecen compatibles. El audio de SIUUU procede de una copia comunitaria: su procedencia e integridad están registradas, pero la licencia de retransmisión no está verificada. Detalles y reinstalación en [MEME_AUDIO_ASSETS.md](MEME_AUDIO_ASSETS.md). MESSI no silencia la música ni los demás efectos.

El banner pequeño **NOOB = BAN** es una broma visual. No registra un comando, no bloquea espectadores y no ejecuta moderación. El montaje sigue sin cámara ni micrófono.

## Música de fondo

El propietario aportó `Okay lets Go.opus` y pidió el segmento04–20s en bucle. Se preparó una pista PCM16 estéreo48kHz de exactamente16s, con5ms de entrada/salida para evitar clics y una reducción de3.588dB para evitar la saturación del Opus decodificado. El pico del WAV es−0.724dBFS. Se conserva el bucle anterior completo, sin modificar, como `assets-local/audio/background-loop-backup-youre-beautiful-36-56.wav`; el nuevo está también identificado como `background-loop-okay-lets-go-04-20.wav`. `background-loop.wav` selecciona la música activa sin cambiar la ruta ni mezclarla con FX/voz. Los tres WAV y su procedencia son locales e ignorados.

Para volver al respaldo, copiar el WAV de respaldo sobre `background-loop.wav` y recargar/habilitar el audio de la fuente de OBS. La herramienta de recorte SoundFile0.14 se usó en un directorio temporal, sin dependencias nuevas para la aplicación. El archivo aportado y su nombre no se interpretan como una verificación de licencia comercial.

## Comprobar y revertir

Ejecutar `npm run check`, suite completa `node --test --test-concurrency=2`, `node tests/endless-soak.cjs` y `node tests/live-cadence-soak.cjs`. Los casos ULTRANUKE comparan destrucción con la misma cantidad de cargas, en terreno inicial y profundo: SUB debe superar LIKE y ambos superar NUKE normal. Se verifica también reciclaje del terreno, atribución, ruta de recursos/audio, silencio de MESSI, menú real de17IDs y movimiento reducido.

Reversión: commit67d93db (PR21), reiniciar sólo el servidor propio y refrescar fuente/audio de OBS, conservando recursos y credenciales. Rama `codex/ultranuke-rewards`, PR apilado sobre `codex/minecraft-live-feedback`; main intacta. No crear ni detener una emisión para desplegar este cambio. Las pruebas offline no acreditan suscripciones reales, escucha remota ni una transmisión prolongada.

## Evidencia ejecutada

| Comprobación | Resultado |
|---|---|
| Referencia previa |34pruebas enfocadas y73archivos de sintaxis, aprobados |
| Suite final |391/391, concurrencia2 |
| Sintaxis final |78archivos; sustituye diagnósticos IDE no disponibles |
| Resistencia endless |6hvirtuales,432000ticks,75433colisiones; réplica de movimiento reducido idéntica |
| Cadencia |30minvirtuales a60Hz,3600/3600comandos aceptados y0rechazos |
| Importadores |Pruebas offline de hashes, tamaños, formatos, preservación y repetición aprobadas |
| Revisiones independientes |Seguridad,lógica,calidad PASS; addendum de partículas aprobado en seguridad y lógica |

Las revisiones detectaron y corrigieron un intervalo67 configurado que se ignoraba y un descarte de cuerpos por un destino antiguo al reciclar terreno. Se añadieron regresiones con configuración alterada y la combinación natural de ULTRANUKE con MESSI,SIUUU yRAIN. El presupuesto de dibujo también excluye impactos fuera de pantalla para reservar partículas a los visibles. No se detectaron regresiones pendientes. Los datos de música se comprobaron decodificando el archivo y verificando duración, picos y extremos del bucle; esto no demuestra escucha remota enYouTube.

## Carga local en OBS

Código0bf9a62 y recursos verificados cargados en la instalación habitual. Las rutas locales devolvieron200 con los tipos correctos para los dos sprites nucleares, partículas, audio67OGG, SIUUUMP3 y músicaWAV de16s. El servidor quedó como proceso propio en segundo plano; su PID y registros están en artifacts ignorados, sin credenciales.

Se observó el perfil LivesIAYouTube, escena MinaYouTube y fuente720×1280 configurada a60FPS. Tras habilitar audio, el medidor quedó activo y desapareció el botón de activación. Se observaron el cartel ULTRANUKE3/10, los17comandos, NOOB=BAN y efectos combinados del simulador con PRUEBA:67,MESSI,SIUU,TNT,NUKE. Se guardó la captura local ignorada `artifacts/minecraft-energy/ultranuke-commands-obs.png`. En captura con efectos se observó58.03/60FPS y después60/60; no es una medición sostenida de rendimiento.

La sala anterior ya figuraba complete y OBS estaba cerrado al retomar. La apertura local tuvo un aviso transitorio de OBS; la siguiente observación mostró la ventana normal con la mina funcionando. Al terminar, emisión y grabación estaban detenidas; no se creó ni inició otroLIVE. No se verificaron eventos oficiales nuevos ni escucha remota de voz/memes en esta entrega. El origen comunitario del grito de Ronaldo y su licencia no verificada siguen documentados por separado.
