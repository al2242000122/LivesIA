# Correcciones del ensayo Minecraft

## Comportamiento vigente

El propietario confirmó LIKE → 3 cargas NUKE y SUB público → 10 cargas NUKE. El cartel usa dos líneas transparentes con iconos locales y letras amarillas/cian, sin título ni bloque de diagnóstico. Las activaciones reales conservan el nombre sin el prefijo CHAT YOUTUBE; las simulaciones conservan PRUEBA. El panel sigue mostrando los estados técnicos y se mantiene el botón de sonido hasta activarlo.

TNT y CREEPER se dispersan por posición, altura, velocidad y demora de salida. RAIN baja de24 a12 picos y dura10s. MEGA y NUKE nacen cerca del pico: un núcleo físico pequeño permite que sus sprites gigantes entren en pozos estrechos. Se comprueba daño sobre terreno inicial, profundo y pozos de una sola columna. BIG agranda el dibujo y la excavación sin agrandar la colisión hasta atascarla. Los buffs del pico comparten su duración entre equipos; FAST gira45rad/s y SPIN60rad/s, con más daño real y subpasos físicos para evitar atravesar paredes.

## Ráfagas sin rechazo por ocupación

En endless, un comando válido ya no se rechaza porque estén ocupados los huecos de entidades o clima. Se guarda en una FIFO sin cupo de comandos ni caducidad automática, con copia de su acción y atribución saneada. Se empiezan varios pendientes por actualización cuando existe espacio. Una ráfaga no requiere que termine todo el efecto anterior; el límite de64 inicios por actualización controla el trabajo por frame, sin rechazar el resto. Si llegan permanentemente más comandos de los que se pueden ejecutar, la cola y la espera crecen: no se promete capacidad infinita de memoria.

Se conservan los presupuestos de cuerpos activos, partículas, bloques y dibujo para mantener fluidez. Una recepción pendiente dice «recibido · en cola»; el aviso de activación y los FX ocurren sólo al comenzar realmente, con el mismo autor e ID. El registro de miembros lleno no bloquea los comandos instantáneos sin cooldown. La validación, deduplicación, moderación y protecciones del transporte permanecen. Las recompensas oficiales de likes/subs conservan sus presupuestos y caducidades propios; la eliminación del rechazo por ocupación se refiere a los comandos del juego.

Pausa congela la cola existente y rechaza entradas nuevas hasta reanudar. Emergencia y reinicio la vacían. Detener o cambiar la fuente YouTube cancela sus comandos pendientes; los de simulación se conservan. Los modos arena/shaft y Snake conservan su política anterior.

## Likes y suscripciones

El contador compara cada muestra con la anterior: quitar un like y volverlo a dar puede generar otra recompensa si YouTube informa la bajada y la subida en consultas distintas. Si ambos movimientos se compensan entre consultas, no se pueden reconstruir. Las consultas siguen siendo likes15s y suscriptores60s. YouTube no proporciona el nombre de quien da like.

Una nueva fecha de creación permite detectar la resuscripción pública de una identidad vista antes, sin repetir la misma alta ni premiar historial antiguo. Datos inválidos o fechas futuras ya no bloquean para siempre una identidad. La comprobación oficial de sólo lectura durante esta entrega devolvió cero suscriptores públicos; no verifica un alta ni explica por sí sola si una suscripción concreta era privada. Fuentes: [suscripciones recientes](https://developers.google.com/youtube/data/reference/rest/v3/subscriptions/list), [fecha de creación](https://developers.google.com/youtube/data/reference/rest/v3/subscriptions#snippet.publishedAt), [privacidad](https://support.google.com/youtube/answer/7280190?hl=es).

## Comprobar y revertir

Ejecutar `npm run check`, `node --test --test-concurrency=2` con los archivos `tests/*.test.cjs`, `node tests/endless-soak.cjs` y `node tests/live-cadence-soak.cjs`. Los tests `block-pending` y `backlog-experience` cubren ráfagas, orden, copia segura, cancelación, pausa, reinicio y anuncios diferidos. No representan un ensayo real prolongado de OBS ni verifican suscripciones privadas o monetización.

Reversión: volver a350105c (PR20), reiniciar sólo el servidor propio y refrescar la fuente/audio de OBS. No borrar recursos ni credenciales; no detener ni iniciar transmisiones por hacer rollback. Rama `codex/minecraft-live-feedback`, PR apilado sobre `codex/minecraft-frenzy-rewards`; main intacta.

## Evidencia ejecutada

Suite completa371/371 y sintaxis73archivos aprobadas. Seis horas virtuales:432000ticks,82237colisiones, reproducción de movimiento reducido idéntica, máximo70entidades/cola,303partículas y60efectos. Cadencia de30min virtuales a60Hz:3600/3600comandos aceptados, cero rechazos. Ráfaga de1000TNT: todos recibidos y comenzados una vez, en orden, con trabajo activo acotado. Las revisiones independientes de seguridad, lógica y calidad terminaron PASS tras corregir el anuncio automático diferido, renovación de miembros y validación de velocidad FAST. Los diagnósticos IDE se sustituyeron por la comprobación de sintaxis. Las verificaciones visuales y la señal real del ensayo se registran por separado; estos números no acreditan seis horas reales de OBS.

Versión922b1ce cargada en el ensayo existente no listado, sin detener ni reiniciar OBS. Se refrescó la fuente y se habilitó su audio: título/caja/diagnósticos ausentes, cartel transparente nuevo, medidor de audio activo y60FPS observados. Se enviaron nueve comandos explícitos del simulador (TNT,CREEPER,NUKE,MEGA,RAIN,BIG,SPIN,FAST,THUNDER); se observaron efectos combinados con atribución PRUEBA, sin crear likes ni suscripciones falsas ni solicitarles voz. Captura local ignorada `artifacts/minecraft-energy/feedback-frenzy-live.png`. El lector oficial quedó connected/rewards active sin errores y el ensayo siguió live/unlisted. No se verificó un alta pública real ni se midió latencia de voz en esta actualización.
