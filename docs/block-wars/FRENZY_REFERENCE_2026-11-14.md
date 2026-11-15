# Frenesí y alerta de suscripción

## Referencia y objetivo

El propietario pidió aumentar aproximadamente tres veces la intensidad, combinar comandos, TNT con tres cargas, THUNDER más largo, LIKE=NUKE×3, SUB=NUKE×10, una alerta central animada con el nombre del suscriptor y el rótulo EVENT ACTIVE. Se inspeccionó codex-clipboard-f53955a9-ef6d-4a81-851e-456ff3a23364.png: alerta central separada del menú derecho y del inventario izquierdo, lluvia de picos simultáneos y contador amarillo. No se copia el GIF de aguacate ni la interfaz/avatar/chat/métricas ajenas. La alerta usa animación propia de objetos pixelados Minecraft importados localmente, equivalente visual a un GIF sin nuevas descargas o dependencias.

Las cantidades de recompensa se interpretan como cargas gigantes totales: un like detectado lanza3cargas NUKE, un suscriptor público10cargas NUKE, no3/10multiplicaciones adicionales del comando. YouTube no revela la identidad de quien da like: su audio permanece anónimo. Sólo un suscriptor público realmente detectado puede tener nombre; no atribuir el like al último comentarista ni aceptar nombres escritos en el chat como prueba de like. Consultas, retraso de API, baseline y privacidad siguen en YOUTUBE_LIKE_SUB_REWARDS.md.

## Implementación y comprobación

El motor endless aumenta salvas y duración del clima, elimina esperas entre comandos y conserva sus atribuciones independientes. Los modos arena/shaft y Snake conservan sus contratos anteriores. Los límites técnicos de entidades, partículas, operaciones y memoria siguen vigentes: el pedido de combinar efectos no significa asignación infinita que termine congelando el LIVE. Si se alcanza capacidad, se rechaza la acción o permanece en la cola de recompensa con caducidad, sin anunciar una activación falsa.

Las explosiones dibujan tres frentes cuadrados de humo y fragmentos. Movimiento reducido conserva un frente. Cuando varias cargas gigantes quedan físicamente sobre una entrada estrecha, una tarjeta agrupada muestra hasta10miniaturas, cantidad, autor y mecha; se ven hasta4tarjetas, mientras la simulación continúa acotada.

La voz de like dice nuevo like y tres cargas NUKE; la de suscriptor agradece al nombre moderado y anuncia diez cargas NUKE. Los IDs de recompensa/permiso de voz siguen siendo los oficiales opacos, de un uso. El panel y los comentarios no pueden fabricar eventos reales. Las colas y el presupuesto de ElevenLabs se conservan, por lo que en ráfagas pueden omitirse locuciones atrasadas.

## Prueba y reversión

Ejecutar npm run check; node --test --test-concurrency=2 con todos los tests/*.test.cjs; node tests/endless-soak.cjs; node tests/live-cadence-soak.cjs. Usar /block-wars?platform=youtube y el panel local para comprobar TNT, THUNDER, RAIN, FIRE, NUKE y efectos mezclados, alertas y modo reducido. Los tests de suscripción/like usan identidades ficticias; no acreditan una alta real ni la escucha real de su voz.

Revertir al commit451a546 (PR19), reiniciar sólo el servidor propio y refrescar fuente OBS/audio. No borrar recursos ni credenciales y no detener la emisión existente. Rama codex/minecraft-frenzy-rewards basada en PR19; no modificar main.


## Evidencia ejecutada

Suite345/345 y sintaxis70archivos aprobadas. Engine96pruebas y frontend86pruebas enfocadas, más render13y controles específicos de legado. Seis horas virtuales:432000ticks, máximo77entidades/cola,265partículas y60efectos; réplica de movimiento reducido idéntica. Cadencia30min60Hz:3593/3600comentarios aceptados,7rechazos por capacidad, pico96entidades/320partículas. Revisiones independientes de seguridad, lógica y calidad aprobadas tras corregir BIG legacy y comprobar radios distintos en los tres frentes de explosión.

Se observó la alerta central en OBS con un proveedor ficticio local de sólo prueba, sin credenciales ni voz real; captura ignorada artifacts/minecraft-energy/frenzy-subscriber-fixture.png. La prueba estaba rotulada PRUEBA VISUAL LOCAL / SIN YOUTUBE / SIN VOZ REAL. No acredita una alta pública real. Antes de la actualización, la API de la sala3lOET6O-Iqg indicócomplete y OBS mostró Iniciar Transmisión: la emisión ya estaba detenida; no se inició otra emisión automáticamente.
