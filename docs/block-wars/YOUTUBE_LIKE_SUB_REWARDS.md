# LIKE y SUB: recompensas individuales en YouTube

## Comportamiento autorizado

El propietario aprobó: cada +1 neto detectado en likes dispara una TNT sin nombre; cada nuevo suscriptor público detectado dispara NUKE (tres TNT gigantes de colores) con su nombre y aviso de ElevenLabs. SUB significa suscripción gratuita al canal, no miembro de pago. Los comentarios mantienen sus14comandos y efectos, sin narración.

La primera consulta establece una referencia y no recompensa los likes o suscriptores existentes. Se consulta el contador cada15s y los suscriptores públicos cada60s, más el tiempo de red/API; no es un evento instantáneo. YouTube sólo ofrece el contador de likes, no la identidad de cada persona. La API puede publicar cambios con retraso y no permite reconstruir likes simultáneos que se compensan con bajas entre consultas. Se usa un máximo histórico para evitar recompensar repetidamente quitar y volver a poner like; tras una bajada sólo se premian incrementos por encima del máximo recompensado.

Las suscripciones privadas no son observables. Las públicas se deduplican por identidad y deben tener fecha posterior al inicio de la referencia; hacer pública una suscripción antigua no provoca NUKE. La consulta obtiene los50suscriptores más recientes y puede omitir altas si supera esa cantidad entre consultas. No se inventan nombres ni se usa el último comentarista como autor de un like.

Fuentes oficiales: [likeCount](https://developers.google.com/youtube/data/reference/rest/v3/videos#statistics.likeCount), [myRecentSubscribers](https://developers.google.com/youtube/data/reference/rest/v3/subscriptions/list), [privacidad](https://support.google.com/youtube/answer/7280190?hl=es).

## Arquitectura y límites

Se reutilizan OAuth youtube.readonly, la verificación del canal propietario, la selección explícita de la sala, las respuestas acotadas y el presupuesto diario de8000unidades del lector. No se añade permiso de escritura ni otro proveedor de eventos. El coste de las consultas de recompensas se suma al del chat, por lo que la duración disponible depende del uso total de cuota; al agotarse se informa y no se sigue consultando.

El canal SSE youtube_reward es exclusivo de Block Wars con platform=youtube, con esquema independiente del chat y del simulador. Los IDs son opacos; no se guardan nombres en disco ni en telemetría. El tracker acota200likes por muestra,5000identidades por sesión y256permisos de voz de120s; las omisiones por capacidad se reflejan en dropped. La cola visual conserva64recompensas durante30s, prioriza suscriptores y libera una cada0.25s cuando hay capacidad. Pausa, emergencia, cambio o detención de fuente cancelan pendientes; las cargas ya activadas pueden terminar su efecto.

Cada aviso TTS real exige un permiso de un solo uso emitido por el servidor para ese evento, tipo y nombre moderado. El panel no puede crear recompensas reales. Se conservan el presupuesto de caracteres, una voz a la vez, máximo dos voces pendientes, caducidad y silencio. En ráfagas se pueden omitir locuciones para no narrar eventos antiguos; los efectos tienen su propio presupuesto. No se promete una locución por cada like en tráfico elevado.

El montaje continúa sin cámara ni micrófono. Los sonidos de Minecraft, música y secretos permanecen locales e ignorados por Git. Snake, TikFinity y los ensayos anteriores conservan sus reglas.

## Verificar

Ejecutar npm run check y la suite node --test --test-concurrency=2 sobre tests/*.test.cjs. Las pruebas usan proveedores ficticios y recorren contador→SSE→adaptador→experiencia→motor→solicitud tipada de voz, además de baselines, ráfagas, cambios de fuente y rechazos de voz falsificada. Ejecutar también node tests/endless-soak.cjs.

Seleccionar explícitamente la misma sala propia desde el panel; no iniciar ni detener una emisión por configurar el lector. El HUD debe mostrar SINCRONIZANDO hasta disponer de ambas referencias y LECTOR ACTIVO al comprobarlas. Un nuevo like real aumenta likesTriggered y causa TNT; una nueva alta pública aumenta subscribersTriggered y conserva el nombre en NUKE. Comprobar por separado la escucha real de ElevenLabs. Consultar correctamente una lista vacía no prueba un evento de suscripción.

Reversión: volver a ad80299 (PR18), reiniciar el servidor propio y recargar la fuente de OBS. Seleccionar de nuevo la misma sala sólo tras confirmar que continúa no listada/live. No borrar credenciales, recursos ni respaldos; no detener OBS.

## Evidencia de esta entrega

Suite334/334 con concurrencia2 y sintaxis69archivos aprobadas. Revisiones independientes de seguridad, lógica y calidad aprobadas tras corregir cancelaciones de fuente/grants y nombrar políticas. La prueba autenticada de sólo lectura confirmó acceso al contador y a myRecentSubscribers; la lista pública estaba vacía, por lo que no se acredita un alta real ni una locución nueva. Captura de diseño local ignorada: artifacts/minecraft-energy/rewards-preview-crop.png. La evidencia de OBS y el estado real posterior se guardan por separado para no convertir pruebas offline en verificaciones de emisión.
