# AGENTS.md — LivesIA / Serpiente Infinita LIVE

## Propósito y alcance
Este repositorio contiene el MVP de **Serpiente Infinita LIVE**, un videojuego original de serpiente que juega automáticamente en laberintos generados por procedimiento. Su salida vertical se captura con OBS para transmisiones de TikTok LIVE. Los espectadores pueden afectar la partida mediante eventos gratuitos (likes, follow, chat) y regalos *cuando existan eventos reales*. El siguiente agente/Codex debe convertir el prototipo en un producto robusto sin romper las funciones actuales ni afirmar monetización o conexión verificadas cuando aún no lo estén.

## Estado del proyecto (MVP; no verificado en una transmisión real)
- Tecnología: HTML/CSS/JavaScript (Canvas2D), Node.js20+ y SDK oficial ElevenLabs en el servidor para narración opcional. El arranque con `.env.local` requiere Node20.12+.
- `server.js`: HTTP en `127.0.0.1:4173`, sirve los archivos y conecta el panel de pruebas al juego por SSE. Rutas: `/`, `/control`, `/styles.css`, `/game.js`, `/api/stream`, `/api/status` y `/api/command`.
- `index.html`: escenario de 720 × 1280 para captura en OBS; el tablero interno es Canvas 600 × 744.
- `styles.css`: apariencia del LIVE y del panel del creador.
- `game.js`: generación de laberintos, búsqueda de caminos BFS, autopiloto, frutas, escudos, turbo, animación, puntajes, rondas de 180 s, HUD e integración WebSocket local con TikFinity.
- `control.html`: panel independiente para simular regalos, likes, follows, suscripciones, comandos de chat, pausa, reinicio y evento especial.
- `README.md`: guía de instalación, tabla de interacciones y limitaciones.
- No existe autenticación de TikTok integrada, sistema de cobros, analítica de ingresos, moderación completa ni integración comercial validada.

## Cómo ejecutar y comprobar
1. Instalar Node.js 20 o posterior.
2. En la raíz: `npm ci --ignore-scripts` y `npm start`. El arranque carga `.env.local` sólo en servidor, si existe. `node server.js` conserva el arranque directo con variables de proceso y se usa en pruebas para no cargar credenciales reales.
3. Abrir `http://127.0.0.1:4173/` y `http://127.0.0.1:4173/control`.
4. Mantener la página del juego abierta y pulsar botones en el panel; comprobar que aparecen efectos, cambia el marcador y la página sigue respondiendo.
5. OBS: Fuente de navegador con URL `http://127.0.0.1:4173/`, resolución **720 × 1280**. No capturar `/control` en el LIVE.
6. Opcional para eventos reales: TikFinity Desktop en la misma PC (Windows), conexión WebSocket a `ws://127.0.0.1:21213/`, con TikTok LIVE activo y la Event API habilitada. Comprobar nombres y estructura de eventos recibidos antes de transmitir.
7. Detener servidor con `Ctrl+C`. No publicar los puertos locales en Internet.

## Contrato de eventos del MVP
- Regalos: `giftName` y `repeatCount`; Rosa/Rose crea +2 manzanas, Heart/Corazón/Finger Heart da escudos (máximo 5), Dona/Donut turbo temporal, Galaxy/Galaxia lluvia de manzanas; resto +1 manzana.
- Gratuitos: cada bloque de 100 likes agrega manzanas, follow agrega 1, suscripción agrega 5, comentario `!manzana` agrega 1 con cooldown.
- Las rachas de regalos pendientes no deben contarse dos veces. TikFinity es un tercero, **no** API oficial de TikTok. La implementación usa supuestos de nombres/campos que deben contrastarse con eventos reales y documentación vigente.
- La API local de pruebas recibe JSON con `type`, `name`, `giftName`, `count`, `text` y difunde eventos a los clientes SSE. Nunca etiquetar eventos simulados como regalos reales.

## Reglas para agentes/Codex
- Trabajar en ramas de características y proponer *pull requests* para revisión; no modificar directamente `main` ni el repositorio independiente `al2242000122/gps`.
- Mantener todas las funciones existentes. Documentar claramente cualquier cambio de comportamiento, migración o dependencia nueva antes de introducirlo.
- No introducir secretos, cookies, tokens, claves, credenciales ni información privada en el repositorio ni en logs. Usar variables de entorno y un archivo `.env.example` si algún servicio lo requiere; ignorar `.env`.
- Mantener el servidor sólo en `127.0.0.1` por defecto. Proteger las rutas de control; no exponer el panel mediante túneles o URLs públicas. Sanitizar entrada de red y limitar tasas y tamaño de mensajes.
- Evitar nombres, logotipos, música y recursos ajenos sin autorización. El juego, su aspecto y las animaciones deben ser originales. Un video en bucle sólo puede ser fondo decorativo: la partida y las interacciones deben ser reales y visibles.
- No crear bots de espectadores, auto-regalos, manipulación de métricas, apuestas, premios aleatorios de valor económico por regalos ni estrategias de presión engañosa para monetizar.
- No prometer ganancias ni aprobación de TikTok. Respetar reglas de LIVE y LIVE Gifts vigentes; confirmar elegibilidad de la cuenta por separado.
- Tratar nombres de espectadores como datos no confiables y potencialmente personales. Moderar spam, minimizar persistencia y evitar mostrar texto arbitrario sin saneamiento.
- Preferir pruebas automatizadas que no requieran conexión real, además de pruebas manuales con OBS. No asumir que abrir el WebSocket significa estar emitiendo en TikTok.
- Incluir instrucciones reproducibles de prueba y reversión en cada PR. Corregir problemas de estabilidad antes de ampliar la monetización.

## Prioridades de implementación para Codex
1. **Auditoría y pruebas:** verificar lógica de movimiento/colisiones, reinicio, límites de manzanas, likes, cooldown, rachas de regalos, pausa y modo sin TikFinity. Agregar pruebas con `node:test` cuando sea posible. Documentar fallos descubiertos.
2. **Adaptador de eventos:** separar el transporte TikFinity de las reglas del juego, validar esquema y deduplicar eventos, reconectar con backoff y dar estado explícito de fuente conectada/eventos verificados. Añadir simulador determinista y registro de eventos no sensibles.
3. **Resistencia para transmisiones largas:** recuperación de SSE/WS, pausa al perder conexión, control de memoria/partículas, temporización estable, manejo de errores, reconexión y telemetría local para depurar.
4. **Configuración y UX:** panel para cambiar nombres de regalos y efectos sin editar código, interruptor de simulación, vista previa OBS vertical, accesibilidad, animaciones suaves, sonidos originales opcionales y un fondo visual repetible **sin sustituir el juego en vivo**.
5. **Herramientas del creador:** estadísticas de participación reales pero separadas de ingresos, límites antispam, moderación y pruebas de integración en Windows con TikFinity, OBS y una cuenta elegible.
6. **Despliegue y documentación:** guía paso a paso para Windows, OBS y TikTok LIVE; checklist de privacidad y normas de plataforma; diagnóstico de fallos, métricas y plan de rollback.

## Criterios de aceptación para cada entrega
- `node server.js` sigue levantando el juego y el panel local.
- Se ve correctamente en 720 × 1280 en OBS y el autopiloto mantiene partidas continuas.
- Funciona el modo sin regalos; los eventos gratuitos nunca requieren pago.
- El panel simula eventos sin TikTok; los eventos reales se distinguen de los simulados.
- La consola no muestra errores inesperados; no hay credenciales ni datos personales en commits.
- El PR explica pruebas ejecutadas, límites de validación y capturas cuando cambia la UI.

## Nota para el primer turno de Codex
Inspecciona todos los archivos, resume la arquitectura real, identifica defectos con evidencia y propón un plan por fases. **Primero pruebas y estabilización**, luego integración LIVE y personalización. No afirmar que la monetización está lista ni cambiar `main` directamente: implementar en rama y abrir PR. No hace falta reescribir todo en un framework para el MVP.

## Nuevo modo prioritario: Block Wars LIVE (implementado para ensayo local)

**Objetivo estratégico actualizado:** primero audiencia, likes, follows, comentarios y tiempo de visualización orgánicos; monetización con regalos y suscripciones pagadas **solo más adelante**. El término `sub` significa suscripción potencialmente pagada, no un follow gratuito.

Leer en este orden antes de modificar el proyecto:
1. `docs/block-wars/README.md`
2. `docs/block-wars/GAME_DESIGN.md`
3. `docs/block-wars/GROWTH_AND_MONETIZATION.md`
4. `docs/block-wars/TECHNICAL_SPEC.md`
5. `docs/block-wars/CODEX_BACKLOG.md`

Codex debe mantener Serpiente Infinita como modo existente, implementar Block Wars en módulos independientes y usar un adaptador de eventos compartido con simulación y fuentes distinguibles. Crear un PR por fase; no eliminar funcionalidades, no mezclar efectos gratuitos con donaciones y no ejecutar la fase de regalos antes de contar con elegibilidad y validación real.

**Actualización explícita del propietario (2026-11-11):** aplicar las diez referencias de excavación vertical y descargar texturas originales de Minecraft para uso local. Esta indicación sustituye la anterior prohibición de texturas de Mojang para este ensayo. `python scripts/import_minecraft.py` descarga un cliente oficial fijado, verifica integridad y extrae únicamente PNG a `assets-local/minecraft/` (ignorado por Git). No ejecutar el JAR ni incluir recursos de Mojang en commits/PRs. Procedencia y condiciones en `docs/block-wars/MINECRAFT_ASSETS.md`; no asumir permiso comercial ni confundirlo con grabar gameplay del cliente Minecraft. Los efectos son propios y no se importan sonidos.

**Corrección solicitada por el propietario:** el juego visible debe continuar sin finalizar. La app usa `layout:'endless'`: un pico con gravedad, rebote y colisión círculo-bloque, daño por contacto y terreno generado en un buffer de280celdas. No usar fin de ronda ni resumen en ese modo. `round` es sólo un ciclo interno de votos cada180s; no reinicia terreno, herramientas o puntuaciones. `arena` y `shaft` conservan comportamiento anterior para compatibilidad. Las diez etapas de grietas son PNG originales `destroy_stage_0..9`: la importación ahora contiene34PNG, con actualización segura de la instalación24 y respaldo local.

Juego `/block-wars`, panel `/block-wars/control`; Snake conserva `/` y `/control`. Física en `physics.js`, motor y cámara separados; cinco picos,18eventos, reglas gratuitas y controles se conservan. Telemetría admite el contrato original9campos y uno ampliado12campos con `mode,depth,elapsed`, sin PII. El transporte compartido distingue simulación/relay; TikFinity y OBS real siguen pendientes. Sin recursos importados se ve arte de respaldo claramente rotulado. Cambiar contratos requiere pruebas de regresión en ambos juegos. `npm run test:endless-soak` prueba seis horas virtuales del modo infinito, no seis horas reales de OBS.

## Siguiente encargo: experiencia del LIVE

El propietario confirmó **sin cámara**, con ElevenLabs narrando eventos y nombres de usuario moderados, sonidos/efectos diferenciados y recompensas por comentar. La definición está en `docs/block-wars/LIVE_EXPERIENCE_GOALS.md` y la plantilla en `docs/block-wars/LIVE_SESSION_TEMPLATE.md`. Implementación local parcial: `audio.js` sintetiza FX propios y acota voz/cola/caducidad; `experience.js` anuncia sólo acciones aceptadas; `lib/speech.js` usa plantillas y credenciales del servidor, con presupuesto. `FIRST_LIVE_SETUP.md` y `SPEECH_SETUP.md` describen preparación y pendientes. No declarar voz real, sincronía OBS, eventos reales o monetización verificadas por pruebas offline. Follows y suscripciones pagadas son distintos; Block Wars conserva los eventos pagados deshabilitados.

Controles de audio `bw_audio` deben estar también en la lista de controles de `integrations/transport.js`: comprobar sólo `app.onControl` no cubre SSE. Las acciones comunitarias diferidas de reglas pasan su fuente como segundo argumento interno a `engine.action`; no incorporarlo al JSON del motor ni atribuir likes agregados a una persona. La fuente debe conservarse al drenar la cola para mantener «Prueba» en simulaciones.

## Preparación YouTube LIVE

`docs/block-wars/YOUTUBE_LIVE_SETUP.md` describe la variante local YouTube. La URL `?platform=youtube` desactiva TikFinity y muestra chat real pendiente; sólo admite eventos simulados. No reutilizar TikFinity ni anunciar likes/suscriptores de YouTube como acciones integradas. `scripts/prepare-obs.cjs CONFIG RECORDINGS youtube` crea archivos separados **LivesIA YouTube** sin sobrescribir el ensayo anterior; `start-first-live.ps1 -Platform youtube -CheckOnly` comprueba preparación sin abrir aplicaciones. Al 2026-11-12, canal y teléfono verificados; activación LIVE en espera, subida, chat oficial y monetización pendientes. En TikTok, LIVE Studio 1.39.6 instalado, sesión iniciada por el propietario y estado «Sin acceso» observado; solicitud de acceso **Under review**, sin aprobación confirmada. Ver `docs/block-wars/TIKTOK_LIVE_ACCESS.md`. Los tests de UI deben exigir que cada ID solicitado exista en el HTML real; no crear nodos de prueba automáticamente para IDs inexistentes.

## Comandos Minecraft seleccionados

**Voz real probada en OBS (2026-11-13):** el propietario aprobó CLItest y dos avisos. `onboard test`200/nextdone; app2TTS/121caracteres reservados/errornull para likes y suscriptor ficticio. RAIN dejó contador2. OBS grabó154.766s,decodificacióncompleta0,H264720×1280/30,AAC44.1kstereo,pico−8.14dBFS. Clave/VoiceID sólo envlocal ignorado; nunca abrir/imprimir. Ver `ELEVENLABS_OBS_REHEARSAL_2026-11-13.md`. No afirmar chat YouTube real, latencia medida ni120min por este ensayo. Servidor local quedó activo; grabación/emisión detenidas.

**ElevenLabs CLI autorizado (2026-11-13):** el propietario solicitó `npx -y @elevenlabs/cli@latest onboard init` y aprobó personalmente el navegador. CLI1.11.0 guardó una clave en `.env.local` ignorado por Git. Nunca abrir/imprimir ese archivo: verificar con `onboard check`. SDK2.78.0 MIT fijado en lock, sólo servidor; sin agentesLLM nuevos. `scripts/start.cjs` carga env local con `process.loadEnvFile` y después el servidor. Tests usan server.js directo/fixtures ficticias, nunca la clave real. Conservar límites de presupuesto, plazo8s total, audio2MiB, reintentos0 y endpointHTTPS fijo. El flujo CLI exige aprobación de la prueba concreta antes de arrancar app con voz/enviar TTS. Ver `ELEVENLABS_ONBOARDING.md`.

**Ensayo YouTube guardado y OBS comprobado (2026-11-13):** el propietario confirmó público general. El ensayo de Studio se guardó como No listado/Videojuegos, sin señal. El acceso directo local «Mina Infinita YouTube» carga OBS con `--portable` y el perfil/colección/escena correctos; abrir sólo el exe había cargado «Sin título». Dos grabaciones completas de147.133s/122.100s se decodificaron con FFmpeg. FX ajustados a0.1por nota; pico posterior−21.57dBFS en esa muestra. Ver `OBS_YOUTUBE_REHEARSAL_2026-11-13.md`. Voz real, mezcla con voz, ingestión, chat y120min reales siguen pendientes; las notas de preparación anteriores reflejan pasos históricos.

**Acceso YouTube comprobado (2026-11-13):** la sesión autenticada abrió la sala LIVE del canal y completó la bienvenida para software de transmisión. No se envió señal ni se reveló/copió clave. El formulario del ensayo tiene título, descripción, Videojuegos y No listado preparados pero sin guardar, pendiente de clasificación de público por el propietario. Studio asignó inicialmente Público: antes de conectar OBS guardar/verificar visibilidad e inicio automático. Ver `YOUTUBE_LIVE_SETUP.md`; OAuth/chat, voz real y ensayo OBS continúan pendientes.

**Preparación inicial YouTube (2026-11-13):** el propietario limita ElevenLabs a likes y suscriptores gratuitos. `createExperience(...,{platform:'youtube'})` conserva FX de comandos/automáticos con `narrate:false`; sólo TNT comunitaria aceptada con metadata `trigger:'like'` y follow del simulador usan `like_milestone`/`youtube_subscriber`. Ambos tipos TTS exigen `source:simulator` hasta existir conector real. `!boom`/`!voterain` no son likes; no atribuir agregados a un usuario ni miembros pagados a suscriptores gratuitos. `scripts/start-youtube-voice.ps1` ofrece entrada local oculta sin guardar claves ni iniciar OBS/emisiones. No pedir claves en chat. El servidor previo debe detenerse en su propia ventana: el lanzador no mata procesos ajenos. Activación LIVE, OAuth/chat, voz real y nuevo ensayo OBS siguen pendientes.

El propietario aprobó los comandos 1–14: TNT, RAIN, THUNDER, STORM, CREEPER, METEOR, FIRE, TSUNAMI, SPIN, FAST, MEGA, NUKE, ARROW y BIG. Ver `docs/block-wars/MINECRAFT_COMMANDS.md`. Se promueven en menú y eventos automáticos endless; los 18 anteriores siguen compatibles y STORM/CREEPER amplían `EVENTS` a20. `rain`, `!rain`, `TNT RAIN` y `TNTRAIN` son lluvia directa de TNT; la votación previa se conserva como `!voterain`. El importador admite41PNG con respaldo desde24/34, recursos fuera de Git. No confundir la cámara de seguimiento del terreno con una webcam: el montaje sigue sin cámara ni micrófono.

La atribución se pasa en un segundo argumento interno a `engine.action`, separado del JSON público. Debe persistir en proyectiles, clima, impactos y fuego, sin inventar autor para likes o votos. Para verificar nombres del panel recorrer **contrato del servidor → adaptador compartido → experiencia → UI**, no sólo inyectar eventos ya normalizados: antes el adaptador recibía «Prueba local» pese a la identidad enviada. Los IDs de audio automáticos deben ser únicos incluso después de reiniciar el motor determinísticamente. Las coordenadas físicas continuas se convierten a grilla al impactar; el renderer vuelve a sumar el centro de celda una sola vez.

## Verificación de la fase de estabilización

Tras `npm ci --ignore-scripts`: `npm run check`, `npm test` y `npm run test:soak` (dos horas virtuales por defecto; `SOAK_HOURS=6` para seis). `node --check` sustituye diagnósticos IDE cuando no están disponibles. Las pruebas unitarias ejecutan el script real del juego con DOM/Canvas/tiempo/transporte dobles; la integración HTTP/SSE usa procesos reales. Ninguna de ellas acredita un LIVE ni una sesión OBS prolongada. Ver `docs/AUDIT_PHASE_1.md` para contrato, evidencias y pendientes.

Una demora superior a una ronda puede ocultar reinicios dobles en las pruebas de tiempo: para comprobar reinicio tras game over usar también demoras menores de 180 s (p. ej. 5 s). Los mensajes sobredimensionados de prueba deben contener JSON válido para cubrir la guarda de longitud.
