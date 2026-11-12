# Objetivos de experiencia del LIVE

Fecha: 2026-11-11. Estado: **IMPLEMENTACIÓN LOCAL PARCIAL**. Sonidos, cola de voz y preparación de OBS implementados en la rama del [primer ensayo](FIRST_LIVE_SETUP.md). Los criterios O1–O6 siguen pendientes de medición; el código y las pruebas offline no acreditan ElevenLabs real, audio capturado en OBS, eventos reales ni monetización.

## Encargo confirmado

El propietario quiere el juego infinito en pantalla, **sin cámara**, con narración automática de ElevenLabs: «NUKE de [usuario]», anuncios de nuevos seguidores/suscriptores, sonidos y efectos distintivos y recompensas por comentar. El terreno y el pico siguen calculándose en tiempo real. No se reinician mapa, herramientas o puntos para crear capítulos del LIVE.

Objetivo principal: que quien entra entienda cómo participar, vea y escuche su influencia y tenga un siguiente momento por el cual quedarse. Buscamos audiencia y retención auténticas. No hay una línea base de transmisiones reales ni una cifra de crecimiento demostrada.

## Objetivos y criterios de aceptación

Todos los números siguientes son **metas iniciales de diseño**, no resultados actuales ni referencias del algoritmo de TikTok.

| ID | Objetivo | Criterio inicial | Cómo comprobarlo |
| --- | --- | --- | --- |
| O1 | Entender el LIVE al entrar | 4 de 5 personas nuevas explican en 5 segundos qué ocurre y una acción gratuita que pueden hacer | Prueba de comprensión en móvil, con audio apagado y sin explicación previa |
| O2 | Sentir que el comentario tiene efecto | Respuesta visual en p95 ≤500 ms; comienzo del efecto aceptado en p95 ≤2 s a carga normal | Instrumentar recepción local, respuesta y primer efecto visible; rechazos explican enfriamiento o cola |
| O3 | Reconocer cada evento por imagen y sonido | Cada familia tiene señal visual/sonora propia; 4 de 5 personas distinguen TNT, NUKE y recompensa de comentario | Prueba con señales mezcladas, sin leer el catálogo; conservar los 18 comandos |
| O4 | Escuchar narración reactiva de ElevenLabs | Con canal libre, envío al TTS→audio audible en p95 ≤3 s; una voz a la vez y cero anuncios duplicados u obsoletos | Medir también espera en cola y evento original→audio en OBS; la cifra del proveedor no sustituye estas mediciones |
| O5 | Tener un motivo para quedarse | Próximo evento o hito entendible; ensayar un momento destacado cada 30–60 s sin detener la excavación | Revisión de la grabación y prueba de comprensión del siguiente objetivo; cadencia como hipótesis |
| O6 | Crecer con evidencia | Obtener 3 sesiones de línea base y 3 sesiones de comparación con una sola variable | Resumen nativo de TikTok y registro por sesión; sin declarar ganador estadístico por seis sesiones |

Guardarraíl operativo: ensayo real de OBS de 120 minutos, sin bloqueo ni reinicio manual; al menos 30 FPS en el 95% de las muestras locales tomadas cada 5 s. El audio no debe impedir la minería o los controles si ElevenLabs falla. Las seis horas virtuales del motor existentes no cumplen este ensayo de OBS.

En O2 el reloj empieza cuando la app recibe y valida el evento: no mide el recorrido completo desde el teléfono del espectador. Los efectos tienen mechas y enfriamientos deliberados. Si hay saturación, mostrar «en cola» o el motivo del rechazo, sin prometer ejecución inmediata. Medir aparte extremo a extremo cuando el relay real esté validado.

## Recorrido del espectador

1. Ve el pico rebotando y una instrucción principal legible: «Elige !dark o !light. Para ayudar: !mine».
2. Envía una acción gratuita; el sistema identifica la fuente, valida el comando y aplica los límites.
3. Recibe confirmación visual, una señal sonora y, cuando corresponda, narración con su nombre moderado.
4. Reconoce el resultado en el juego y el siguiente evento o hito.
5. Puede volver a participar cuando se libera el enfriamiento. La mina continúa siempre.

El catálogo completo permanece disponible. La bienvenida y la ayuda principal deben destacar una acción a la vez. Mostrar el progreso real hacia la TNT comunitaria con el umbral configurado; no asignar los likes agregados a una persona arbitraria.

Para los hitos, usar la **profundidad máxima de la sesión**, no la posición actual del pico que baja y sube. Celebrar el siguiente tramo sin pantalla de fin ni reinicio de puntuaciones. La elección del tamaño del tramo se probará después de medir la velocidad real.

## Voz, sonido y recompensa por evento

Ejemplos de locución propuestos; la plantilla sólo se activa después de que la acción correspondiente se acepte.

| Evento | Narración | Sonido/imagen distintivos | Regla |
| --- | --- | --- | --- |
| TNT de comando | «¡TNT de [usuario]!» | Mecha corta y explosión pequeña | Identidad del comentario que causó la acción, con deduplicación y enfriamiento |
| TNT por likes | «¡La comunidad activó TNT!» | Carga comunitaria y explosión | Progreso agregado real; sin inventar un autor |
| NUKE de comando | «¡NUKE de [usuario]!» | Aviso grave y expansión visual distinta de TNT | Respetar el enfriamiento global y los presupuestos del motor |
| Comentario recompensado | «[usuario] refuerza a DARK» o LIGHT | Golpe de pico, brillo y carga de trabajo | Recompensa de juego; el daño se gasta en el próximo contacto físico |
| Nuevo seguidor | «¡Bienvenido, [usuario]!» | Campanilla y distintivo breve | Requiere evento de follow real validado; no llamarlo suscripción pagada |
| Suscripción pagada | «¡Nueva suscripción de [usuario]!» | Fanfarria y distintivo propios | Diseñada pero condicionada a elegibilidad, evento real validado y habilitación explícita |
| Evento automático | «Evento de la mina: [evento]» | Señal correspondiente al evento | No atribuirlo a un espectador ficticio |

El resto del catálogo debe tener fichas equivalentes antes de aceptar O3. Las variaciones visuales no requieren subir el volumen. Conservar reducción de movimiento, controles de volumen, silencio y emergencia.

### Recompensas por comentar

- Primera participación válida: reconocimiento y un impulso pequeño, sujeto a límites. La detección de primera participación es nueva y está pendiente; no se deduce de un contador de actores con TTL.
- `!mine`: conservar el impulso al próximo contacto y el enfriamiento por persona. `!dark`, `!light`, votos y comandos existentes mantienen su función.
- Comentarios repetidos, duplicados y ráfagas no multiplican la recompensa. No premiar por cada carácter, emoji o repetición.
- La recompensa es energía, puntos virtuales o un cosmético; no dinero, premio canjeable ni una promesa de ingreso.
- La voz no lee el chat libre. Usa plantillas permitidas y nombres moderados y acotados; si el nombre falta o no es apto, decir «un minero». Nunca dejar `%user%` literal ni inventar identidades.

### Cadencia y control de ElevenLabs

Una locución activa y un máximo inicial de dos pendientes. Agrupar repeticiones y reemplazar mensajes pendientes de menor prioridad. Prioridad propuesta: evento destacado → suscripción validada → seguidor → resumen de comentarios. Cada mensaje debe seguir describiendo un hecho cierto al reproducirse; probar vencimiento de 8 s para mensajes de evento, con la señal visual/sonora inmediata como respuesta. Registrar los descartes y toda la espera; no ocultarlos excluyéndolos de la medición total. Reinicio/emergencia cancelan audio y pendientes.

Probar frases cortas y una separación inicial de 10–15 s entre narraciones, además de los sonidos breves de acciones. Ajustar con observación; evitar locución continua que tape el juego. ElevenLabs genera la voz de los mensajes elegidos; los sonidos son recursos propios o con licencia documentada.

Antes de activar la API: elegir una voz autorizada para español de México, fijar presupuesto por hora y máximo de consumo, medir caracteres/audio y establecer reintentos acotados. La clave queda en el proceso local, fuera del navegador y de Git. El fallo de voz deja texto/efectos funcionando y se informa al operador. La generación y reproducción real de audio siguen pendientes.

## Medición y experimentos

Métrica principal de audiencia: tiempo de visualización reportado en el resumen nativo del LIVE, **si está disponible**. Conservar su definición y unidad exactas. Retención a 60 s sólo si existe ese dato o una cohorte medible; no inferirla del tiempo medio.

Secundarias: seguidores nuevos atribuidos al LIVE, espectadores únicos y comandos aceptados por minuto. «Seguidores por 100 espectadores» sólo se calcula si numerador y denominador corresponden a la misma sesión cerrada y sus definiciones son compatibles. Si faltan datos, registrar «no disponible». No convertir likes, ventanas SSE ni actores locales en espectadores.

La telemetría actual expone FPS, estado del motor, fuente, profundidad y tiempo. No guarda automáticamente un histórico de sesiones, latencias de interacción, rendimiento de audio ni retención de TikTok. La instrumentación siguiente está **PLANNED**:

| Evento local propuesto | Decisión que permite tomar | Datos mínimos |
| --- | --- | --- |
| `interaction_received` / `interaction_resolved` | Revisar aceptación, rechazo y retraso | Sesión, ID local, tipo permitido, fuente simulador/relay, resultado y motivo fijo |
| `effect_started` | Comprobar respuesta y sincronía | ID de acción, tipo y tiempo monotónico local |
| `narration_started` / `narration_finished` / `narration_dropped` | Ajustar cadencia, cola y fallos | Tipo de mensaje, tiempos, motivo fijo, uso agregado; sin texto de chat ni nombre en logs |
| `milestone_reached` | Probar hitos comprensibles | Profundidad máxima, tiempo de sesión y versión |
| Muestra de rendimiento | Detectar deterioro durante OBS | FPS/estado cada 5 s, duración y versión; sin identidades |

Usar un mismo reloj monotónico para las latencias locales. Mantener resultados de simulación y relay separados; una conexión abierta no verifica un LIVE. No instalar analítica externa para obtener estos agregados locales.

### Primera secuencia de pruebas

1. **Usabilidad:** 5 personas nuevas, móvil, con y sin audio. Corregir comprensión antes de medir crecimiento.
2. **Ensayo local:** comentarios de prueba, cooldowns, ráfagas, voz, desconexión del proveedor, silencio y emergencia. Comprobar que un evento produce una sola recompensa/anuncio.
3. **Ensayo OBS:** 120 minutos con el formato sin cámara. Verificar captura, audio, mezcla y continuidad; no sustituirlo por el soak del motor.
4. **Línea base:** 3 LIVE comparables cuando cuenta, eventos y recursos estén habilitados y validados. Registrar fuente y disponibilidad de cada métrica.
5. **Comparación exploratoria:** otras 3 sesiones cambiando sólo una instrucción de entrada. Conservar horario comparable, duración, configuración, umbral de likes y cadencia. No cambiar a la vez voz, retos y frecuencia de eventos.

Hipótesis inicial: una instrucción principal comprensible aumenta la participación aceptada y reduce preguntas sobre cómo jugar. Usar primero O1 y las métricas instrumentadas; el tiempo de visualización aporta contexto. Una comparación de sesiones sin asignación aleatoria es exploratoria, no un A/B causal. Definir muestra y efecto mínimo después de conocer tráfico y variabilidad; no imponer un porcentaje de crecimiento inventado ni detener una prueba por un pico favorable.

Registro preparado en [LIVE_SESSION_TEMPLATE.md](LIVE_SESSION_TEMPLATE.md).

## Primer entregable de implementación

Prioridad P0: respuesta visible a acciones/rechazos y orquestación de voz, sonidos y efectos para **TNT, NUKE y comentario recompensado**. Probar que el nombre correcto y el anuncio coinciden con el efecto aceptado. Después ampliar al resto del catálogo y follows reales. Suscripciones pagadas y regalos conservan su puerta de validación y elegibilidad.

La mina infinita, picos, colisiones, los 18 eventos, límites, controles y Snake se conservan. Esta fase se considera aceptada cuando cumple O1–O4 y el ensayo real de OBS; O5–O6 se evalúan con las sesiones y datos que efectivamente existan.

## Skills consultadas y fuentes

Búsquedas ejecutadas mediante `find-skills`: `tiktok live`, `game design engagement`, `ab test analytics` y `elevenlabs realtime voice`. Las skills se leyeron para planear; no se instalaron globalmente ni se ejecutó generación de voz.

- [social 2.5.2](https://github.com/coreyhaines31/marketingskills/blob/main/skills/social/SKILL.md): claridad del mensaje, identidad y participación. Sus consejos de videos cortos no se toman como reglas de LIVE ni sus cifras como benchmarks comprobados para este juego.
- [analytics 2.2.5](https://github.com/coreyhaines31/marketingskills/blob/main/skills/analytics/SKILL.md): medir decisiones con fuentes, ventanas y denominadores compatibles. El índice también devuelve el nombre anterior `analytics-tracking`; el paquete actual ofrece `analytics`.
- [ab-testing 2.0.7](https://github.com/coreyhaines31/marketingskills/blob/main/skills/ab-testing/SKILL.md): una hipótesis/variable, métrica principal y límites de inferencia. Estas tres guías tienen [licencia MIT](https://github.com/coreyhaines31/marketingskills/blob/main/LICENSE).
- Skill del plugin ElevenLabs `text-to-speech`: planificación de voz por texto. Se contrastó con las [instrucciones oficiales de streaming](https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/streaming) y [metodología de latencia](https://elevenlabs.io/docs/eleven-api/concepts/latency-methodology). La latencia anunciada del servidor excluye red y reproducción; no se promete como latencia del LIVE.

Se leyó el candidato `stanestane/game-design-skills-bundle@game-design-core-loop-extractor`, cuyo aviso exige licencia comercial; no se adoptó como skill de este proyecto. Los resultados centrados en TikTok Shop o scraping tampoco se usaron como requisitos de gaming.

Como contexto histórico, [TikTok describió interacciones de espectadores en su serie de gaming de 2021](https://newsroom.tiktok.com/gaming-goes-live-on-tiktok/?lang=en). Ese anuncio no demuestra permisos actuales, elegibilidad de esta cuenta ni aprobación de esta aplicación. Las metas de este documento son propuestas propias; no garantías de distribución o ingresos.
