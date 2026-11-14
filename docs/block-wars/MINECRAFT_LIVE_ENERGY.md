# Ajustes de experiencia Minecraft — 2026-11-14

## Cambios y comportamiento

- Simulación del navegador: paso fijo60Hz, máximo15pasos por frame y250ms de recuperación. No acelera el reloj; reduce el movimiento a saltos del paso anterior de50ms.
- Pico infinito: velocidad inicial horizontal5.6, mínima5 y máxima15celdas/s; gravedad30, rebote.86 y subpasos espaciales acotados. FAST conserva multiplicador1.6. El trabajo acumulado por contacto es3veces el anterior. Grietas y daño siguen aplicándose contra bloques reales.
- RAIN: ocho TNT con separación.16s y mecha.4s; MEGA.9s, NUKE1.5s, Creeper.8s. Flechas, meteoritos, agua y clima avanzan más deprisa. Son elecciones de este juego, no equivalencias exactas con mecánicas vanilla.
- Sólo en infinito: enfriamiento global500ms, por persona1000ms. Comandos atribuidos pueden coexistir y repetirse; repetir un buff renueva su duración fija. Mantener deduplicación, pausa y rechazo honesto al llenar capacidad. Arena/shaft y acciones automáticas conservan sus enfriamientos previos.
- Hasta8climas simultáneos,24entidades/cola combinadas,160partículas y64resultados. Cada clima conserva autor, fuente y acción; el fondo se dibuja una vez.
- Los iconos del menú usan recursos Minecraft locales, incluyendo el recorte UV del rostro Creeper. Se conservan modo serpiente,14comandos destacados y20efectos compatibles.
- Los tonos sintetizados se sustituyen por22OGG oficiales verificados; música/FX/voz tienen mezcla independiente. Pista aportada recortada00:36–00:56,20.000s y bucle. [Preparación de audio](MINECRAFT_AUDIO.md). No nuevos usos pagados de ElevenLabs.

## Evidencia

Baseline:287/287pruebas,61archivos con sintaxis válida. Tras cambios:303/303pruebas y65archivos sintácticamente válidos. Sin dependencias nuevas. Revisión independiente de seguridad y lógica aprobadas. El servicio rechazó crear un tercer agente por límite de hilos; la revisión de calidad adicional la realizó el mismo revisor de seguridad. Encontró valores iniciales de mezcla discordantes y un nodo de ganancia sin uso; ambos corregidos y revalidados. No se presenta como una tercera revisión independiente.

`node tests/endless-soak.cjs`: seis horas virtuales,432000ticks de50ms,280celdas constantes, siete columnas excavadas, replay con movimiento reducido idéntico. Profundidad41442; máximo20entidades+cola,160partículas,31bloques eliminados por actualización. No acredita seis horas reales de OBS.

`node tests/live-cadence-soak.cjs`:30minutos virtuales a60Hz,3600comentarios de prueba a500ms,3598aceptados y2rechazados por capacidad; máximo22entidades,3en cola,2climas y64resultados. Todos los nombres son ficticios; no son espectadores ni popularidad reales.

Ensayo local OBS33.0.1 con fuente y salida60FPS:112.01s,6720frames H.264720×1280/60 y AAC44.1kHz estéreo. FFmpeg decodificó ambos flujos completos con `-xerror`, salida0; pico−3.682dBFS/RMS−29.076dBFS, sin silencios de2s por debajo de−60dBFS. Se enviaron14comentarios simulados separados1.1s. Telemetría60FPS/16.67ms y CPU observada~5.8%. Esto verifica captura local, no escucha remota ni subida a60FPS. Emisión y grabación quedaron detenidas. Captura y log están en `artifacts/minecraft-energy/`, ignorado; la grabación permanece fuera de Git.

## Repetir y revertir

1. `npm ci --ignore-scripts`, `npm run check`, `npm test`.
2. `node tests/endless-soak.cjs` y `node tests/live-cadence-soak.cjs`.
3. Importar imágenes y sonidos con sus scripts; preparar la pista local autorizada segúnMINECRAFT_AUDIO.md.
4. Ejecutar `npm start`; OBSfuente720×1280, FPS personalizados60; Ajustes→Vídeo→60FPS. El generador histórico de perfiles sigue conservando30FPS para compatibilidad: ajustar manualmente este ensayo, sin sobrescribir perfiles.
5. Interactuar→ACTIVAR SONIDO, aplicar mezcla en el panel, grabar localmente y escuchar. Usar comentarios de prueba; una respuestaHTTP200 sólo acredita transporte. Para comprobar YouTube, seleccionar expresamente una emisión propia no listada y ensayar sus comentarios reales.
6. Antes de revertir, detener grabación/emisión y confirmar cierre de Studio si estaba activo. Volver a `codex/youtube-live-chat`, reiniciar servidor y actualizar fuente; devolver fuente/salida30FPS si se busca replicar el ensayo anterior. Conservar recursos locales, credenciales y grabaciones. No modificar main.

Pendiente: aceptación del propietario del estilo/ritmo/música y comandos en transmisión real actualizada; ensayo120min reales y monetización. No se inicia un LIVE nuevo al aplicar este PR.


Estado local al terminar: instalación habitual en la rama de este PR, servidor iniciado con `npm start`, recursos22OGG+WAV copiados y cotejados antes de instalar. OBSfuente restaurada a `http://127.0.0.1:4173/block-wars?platform=youtube`, frecuencia personalizada60 y salida60; sonido activado tras la recarga. Temporal4174 detenido. La emisión de prueba previa figura `complete`/`unlisted`; el lector queda sin seleccionar una emisión nueva. La autorización de lectura continúa configurada. Emisión/grabación detenidas; no se reabre un LIVE por este cambio.
