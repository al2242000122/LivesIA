# AGENTS.md — LivesIA / Serpiente Infinita LIVE

## Propósito y alcance
Este repositorio contiene el MVP de **Serpiente Infinita LIVE**, un videojuego original de serpiente que juega automáticamente en laberintos generados por procedimiento. Su salida vertical se captura con OBS para transmisiones de TikTok LIVE. Los espectadores pueden afectar la partida mediante eventos gratuitos (likes, follow, chat) y regalos *cuando existan eventos reales*. El siguiente agente/Codex debe convertir el prototipo en un producto robusto sin romper las funciones actuales ni afirmar monetización o conexión verificadas cuando aún no lo estén.

## Estado del proyecto (MVP; no verificado en una transmisión real)
- Tecnología: HTML/CSS/JavaScript (Canvas 2 D) y Node.js 20+ sin dependencias npm.
- `server.js`: HTTP en `127.0.0.1:4173`, sirve los archivos y conecta el panel de pruebas al juego por SSE. Rutas: `/`, `/control`, `/styles.css`, `/game.js`, `/api/stream`, `/api/status` y `/api/command`.
- `index.html`: escenario de 720 × 1280 para captura en OBS; el tablero interno es Canvas 600 × 744.
- `styles.css`: apariencia del LIVE y del panel del creador.
- `game.js`: generación de laberintos, búsqueda de caminos BFS, autopiloto, frutas, escudos, turbo, animación, puntajes, rondas de 180 s, HUD e integración WebSocket local con TikFinity.
- `control.html`: panel independiente para simular regalos, likes, follows, suscripciones, comandos de chat, pausa, reinicio y evento especial.
- `README.md`: guía de instalación, tabla de interacciones y limitaciones.
- No existe autenticación de TikTok integrada, sistema de cobros, analítica de ingresos, moderación completa ni integración comercial validada.

## Cómo ejecutar y comprobar
1. Instalar Node.js 20 o posterior.
2. En la raíz: `node server.js` (no ejecutar `npm install`; no hay dependencias).
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

**Corrección solicitada por el propietario:** el juego visible debe continuar sin finalizar. La app usa `layout:'endless'`: un pico con gravedad, rebote y colisión círculo-bloque, daño por contacto y terreno generado en un buffer de280 celdas. No usar fin de ronda ni resumen en ese modo. `round` es sólo un ciclo interno de votos cada180 s; no reinicia terreno, herramientas o puntuaciones. `arena` y `shaft` conservan comportamiento anterior para compatibilidad. Las diez etapas de grietas son PNG originales `destroy_stage_0..9`: la importación ahora contiene34 PNG, con actualización segura de la instalación24 y respaldo local.

Juego `/block-wars`, panel `/block-wars/control`; Snake conserva `/` y `/control`. Física en `physics.js`, motor y cámara separados; cinco picos,18 eventos, reglas gratuitas y controles se conservan. Telemetría admite el contrato original9 campos y uno ampliado12 campos con `mode,depth,elapsed`, sin PII. El transporte compartido distingue simulación/relay; TikFinity y OBS real siguen pendientes. Sin recursos importados se ve arte de respaldo claramente rotulado. Cambiar contratos requiere pruebas de regresión en ambos juegos. `npm run test:endless-soak` prueba seis horas virtuales del modo infinito, no seis horas reales de OBS.

## Verificación de la fase de estabilización

Sin instalar dependencias: `npm run check`, `npm test` y `npm run test:soak` (dos horas virtuales por defecto; `SOAK_HOURS=6` para seis). `node --check` sustituye diagnósticos IDE cuando no están disponibles. Las pruebas unitarias ejecutan el script real del juego con DOM/Canvas/tiempo/transporte dobles; la integración HTTP/SSE usa procesos reales. Ninguna de ellas acredita un LIVE ni una sesión OBS prolongada. Ver `docs/AUDIT_PHASE_1.md` para contrato, evidencias y pendientes.

Una demora superior a una ronda puede ocultar reinicios dobles en las pruebas de tiempo: para comprobar reinicio tras game over usar también demoras menores de 180 s (p. ej. 5 s). Los mensajes sobredimensionados de prueba deben contener JSON válido para cubrir la guarda de longitud.
