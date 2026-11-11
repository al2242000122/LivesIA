# Auditoría y estabilización del MVP

Fecha de revisión: **2026-11-10**, México. Alcance: todos los archivos de la raíz y las seis especificaciones de `docs/block-wars/`. Código base: `60d9f86`; directrices nuevas: `5129514` (`docs/block-wars-growth-first`, PR #1). Esta entrega corresponde al **PR 1 del backlog**, no implementa Block Wars ni habilita nuevas funciones pagadas.

## Arquitectura comprobada

| Archivo | Responsabilidad real |
| --- | --- |
| `server.js` | HTTP en loopback, archivos de una allowlist, comandos JSON y broadcast SSE. No conecta a TikTok. |
| `index.html`, `styles.css` | Overlay vertical; Canvas interno 600 × 744. No video grabado ni assets remotos. |
| `game.js` | Laberinto procedural, BFS, autopiloto, colisiones/escudos, frutas, niveles, rondas, HUD, partículas y recepción WebSocket de TikFinity en el navegador. |
| `control.html`, `control.js` | Panel separado; sus botones simulan eventos por HTTP/SSE. Suscripciones de prueba están separadas de acciones gratuitas. |
| `tests/` | Regresiones con `node:test`, servidor HTTP real y simulación de tiempo/azar para el script del juego. Canvas, DOM y transportes del test unitario son dobles. |
| `docs/block-wars/` | Diseño futuro y prioridades gratis primero. No hay motor Block Wars, picos, TNT ni NUKE implementados. |

Cada ventana del juego mantiene su propia partida, RNG y WebSocket. Abrir una vista previa y OBS crea dos partidas, no un estado autoritativo compartido. `/api/status` cuenta clientes SSE, no espectadores de TikTok ni pruebas de entrega visual. No existen cobros, analítica de ingresos, autenticación TikTok ni publicación automática.

## Evidencia de defectos

Antes de cambiar código: `node --check server.js` y `node --check game.js` pasan; `node --test` encuentra **cero pruebas**. La primera suite nueva tuvo 21 casos: cinco pasaron y 16 fallaron. Se ampliaron casos durante la revisión; las pruebas finales son la referencia ejecutable.

| Problema reproducido | Efecto anterior | Corrección / prueba |
| --- | --- | --- |
| 50 likes LIVE, botón 100 likes, 50 LIVE | Tres frutas en lugar de dos; el botón alteraba el resto real | Acumuladores separados; `panel likes…` |
| Paquete con 1000 likes | Ocho frutas; se perdían dos bloques de 100 | Consumir los diez bloques; `1000 live likes…` |
| WebSocket recibe `null` u objetos numéricos malformados | Excepción en handler, conversión insegura | Validar estructura y escalares antes de convertir; `malformed or oversized…` |
| Repetir mensaje final de regalo con igual `msgId` | Efecto contado dos veces | Ignorar rachas pendientes y finales duplicados dentro de ventana acotada; `gift streaks…` |
| Dos usuarios con igual nickname / cambio de nickname | Cooldown compartido o evadido | Preferir `userId`, `uniqueId`, `username`; nombre solo como fallback |
| Ráfaga de 5000 follows con identidad distinta | Mapa antispam sin límite | TTL y máximo de 2048 entradas; descartar nuevas cuando está lleno |
| Reiniciar tras 920 ms | Primera cuenta regresiva prematura, partículas heredadas | Reiniciar acumuladores y partículas; `full reset…` |
| Suspensión de frame por cinco segundos | Solo descontaba 80 ms de la ronda | Separar tiempo activo transcurrido del delta visual acotado |
| Reanudar tras 60 s de pausa sin frames | Descontaba el minuto pausado con la corrección inicial | Anclar reloj al cambiar pausa; `resuming after suspended…` |
| Reanudar tras cinco segundos de game over | Nueva ronda con 175 s con la corrección inicial | Descartar el tiempo del frame previo al reinicio; `a new round after game over…` |
| Pausar durante game over y esperar 2 s | El reinicio automático cancelaba la pausa del creador | Mantener pausa hasta que el creador reanude; `pause during game over…` |
| Galaxia caducada | Comparaba epoch con tiempo desde navegación; overlay podía permanecer | Comparar deadline y dibujo con el mismo reloj |
| Escudo respawnea en celda con fruta | Fruta debajo de la serpiente | Retirar esa fruta al rescatar |
| Control con `text/plain`, objetos como count o hosts ajenos | Aceptaba solicitudes ambiguas y Host arbitrario | Host/Origin/Fetch-Metadata, JSON tipado y CSP |
| Comandos y conexiones sin límite | Crecimiento de conexiones/buffers, DoS local accidental | 30 comandos/s, 16 SSE, descarte de cliente lento; 413/429/503 explícitos |
| Ventana adicional recibe 503 al llenarse SSE | `EventSource` puede quedar CLOSED sin volver a recibir controles | Recrear conexiones terminales cada 5 s; conservar reconexión nativa en CONNECTING |
| Abrir desde enlace externo con protección inicial | 403 para navegación legítima | Excepción solo para navegación a páginas permitidas; APIs siguen protegidas |
| Panel y relay conectados | Efectos sin indicación de simulación; conexión ambigua | `PRUEBA` en efectos del panel, `RELAY CONECTADO` y aviso LIVE sin verificar |

También se conservan y prueban: conectividad de 100 laberintos con semillas, frutas sin solapamientos y máximo 48, crecimiento cada cuarta fruta, niveles, reinicio tras colisión, escudos hasta cinco, turbo, Galaxia, regalos genéricos, follow, chat, suscripción de prueba, pausa, reinicio y evento especial. No se eliminó ninguna mecánica del MVP.

## Contrato local y límites

`POST /api/command` sigue aceptando `type`, `name`, `giftName`, `count`, `text`. `type` debe pertenecer a la allowlist existente; textos opcionales deben ser strings y `count` opcional un entero positivo. Valores >20 se limitan a 20, como en el MVP. Los clientes que enviaban números como string deben migrar a números JSON. Se requiere `Content-Type: application/json`; funciona el panel existente con estos tipos.

La salida SSE añade `source: "simulation"`, impuesto por el servidor. No se permite que el cliente etiquete un comando como real. El juego rotula pruebas aunque el relay esté conectado. Textos se muestran con `textContent`; se eliminan controles/bidi y se acotan longitudes. El script del panel se extrajo para permitir una CSP sin scripts inline.

- Cuerpo de control: máximo **4096 bytes**; exceso devuelve 413, no un cierre sin explicación. Máximo **30 solicitudes/s** globales; exceso devuelve 429 y `Retry-After: 1`.
- Máximo **16 clientes SSE** y 64 conexiones HTTP; al llenarse SSE responde 503. Si `write()` señala backpressure se cierra ese cliente para impedir cola creciente. `EventSource` reconecta; no hay replay persistente ni garantía de entrega de comandos durante cortes.
- Host permitido: `127.0.0.1:PORT` o `localhost:PORT`. Origin ajeno y solicitudes API cross-site se rechazan. Los enlaces de navegación a páginas locales sí funcionan. Esto protege de sitios web externos; **no autentica ni aísla procesos locales maliciosos**. No exponer el puerto ni usar túneles.
- TikFinity: mensaje string de hasta 16384 unidades UTF-16, validación de números finitos/enteros, hasta 1000 likes por paquete y 20 unidades por regalo. Estos topes preexistentes se conservan; no se interpretan como contabilidad económica.
- Dedupe de regalos con `msgId`: **120 s**, máximo 2048 claves; sin ID no se promete deduplicación. Cooldown follow/sub 20 s, chat 15 s por identidad y 2.5 s global. Mapas se purgan al recibir eventos y no se guardan en disco. Al saturarse se descartan entradas nuevas hasta liberar capacidad.
- El panel permite repetir pruebas sin cooldown, intencionalmente. En Snake, regalos/suscripciones existentes siguen disponibles; eso no habilita el futuro módulo pagado de Block Wars.
- La pausa detiene movimiento y ronda. Los efectos turbo/Galaxia usan tiempo de reloj y pueden vencer durante la pausa, como antes. Una suspensión activa consume tiempo de ronda sin intentar simular miles de pasos al regresar.

## Verificación ejecutada y límites

Entorno local: Windows, Node **24.13.0**, sin instalar dependencias del proyecto. `npm test` y `npm run check` disponibles sin `npm install`. No hay compilador, tipado estático ni linter configurados; se emplea `node --check` para sintaxis y pruebas de ejecución para comportamiento. La CI añade matrices Windows/Linux con Node 20/24, pero su resultado debe comprobarse en el PR, no inferirse del YAML.

Ensayo acelerado tras corregir el reloj de game over: semilla 20261110, seis horas virtuales, frames simulados cada 100 ms, **341 rondas**, máximo 36 partículas y 25 claves de cooldown. Duración real 287.08 s. Heap del proceso de prueba muestreado una vez por minuto virtual después de una hora, tras GC forzado: **4.63–4.68 MiB**. Un ensayo anterior, antes de esa corrección, recorrió 339 rondas. No representa RAM del navegador/OBS, FPS reales, fugas de GPU ni seis horas de emisión real. El script permite repetir el ensayo con `SOAK_HOURS`. La guarda posterior de pausa en game over se valida con regresión propia; el ensayo no envía pausas.

Smoke manual automatizado en Brave: páginas cargadas, todos los botones, panel → HTTP → SSE → juego, escudo/pausa/reinicio y etiqueta `PRUEBA` observados. Vista 720 × 1280; escenario de 1280 px, sin desbordamiento horizontal, footer dentro del viewport. Tras detener y levantar el servidor, el panel informa desconexión y vuelve a enviar controles sin recargar el juego: reconexión SSE observada. Capturas locales bajo `artifacts/` (ignoradas por Git). La reducción de 8 px del padding inferior ajusta la altura natural del escenario al formato objetivo. OBS/CEF, cambios de escena, suspensión de fuente y carga en el equipo de emisión siguen pendientes.

Suite final local: **27/27 pruebas pasan**, también ejecutada desde una copia limpia de los archivos staged, sin `.env` ni `node_modules`. En esa copia se retiró temporalmente la guarda de longitud WS: el fixture JSON válido sobredimensionado produjo dos frutas y la prueba falló, demostrando que detecta la regresión. El archivo se restauró. La revisión adversarial de seguridad/lógica/calidad detectó los fixtures engañosos, el tiempo heredado de game over y el SSE terminal; se corrigieron. No se detectaron regresiones restantes en los caminos cubiertos.

## Fuentes y estado del contrato externo

Consultadas el2026-11-10. [TikFinity Event API](https://tikfinity.zerody.one/tiktok/chatbot) describe endpoint local y envoltura `event`/`data`; remite al conector para los datos. [Guía de rachas de TikTok LIVE Connector](https://ttlc.docs.isaackogan.com/guides/gifts/) explica conteo acumulado y final de racha. La documentación actual incluye payloads anidados (`user`, `gift.type`) que no equivalen automáticamente al formato plano del MVP. No se añadió ese SDK ni se verificó qué versión/forma emite TikFinity instalado.

El handler de esta entrega mantiene el contrato plano legado (`giftType`, `repeatEnd`, `giftName`, `repeatCount`, `likeCount`, `msgId`). **Compatibilidad con paquetes reales, variantes anidadas, IDs de racha y cambio de LIVE: pendiente de PR2 y fixtures anonimizados obtenidos con autorización.** Una conexión WS nunca se usa como prueba de LIVE activo o elegibilidad. No se verificaron cuenta, políticas aplicables a ella, regalos ni ingresos.

## Migración incremental

1. **Esta entrega:** auditoría, regresiones y correcciones acotadas de Snake/relay; mantener todas las rutas y mecánicas existentes.
2. **PR2, pendiente:** módulo compartido de normalización con contrato interno versionado, fuente `simulator`/`tikfinity`, identidad efímera, fixture determinista y contadores agregados de rechazo. Separar las reglas de Snake del transporte. Validar ambas formas reales del proveedor, dedupe con identificador de racha, reconexión con backoff y diagnóstico SSE. Ninguna métrica se inventa.
3. **PR3, pendiente:** motor Block Wars independiente bajo `games/block-wars/`, semilla, minería, rondas DARK/LIGHT, gráficos originales y OBS; Snake permanece disponible. Los picos/encantamientos/TNT/NUKE requieren implementación y pruebas propias.
4. **PR4–5, pendientes:** comandos gratis, likes→TNT agrupados, follows verificables, timers, presupuesto de eventos/frame, panel y métricas mínimas; estabilidad de sesión real antes de crecimiento público.
5. **PR6, bloqueado por validación humana:** regalos opcionales y suscripciones pagadas solo con elegibilidad, eventos reales probados y aprobación del propietario. No hace parte de esta entrega.

## Reproducción y reversión

```powershell
node --version
npm run check
npm test
$env:SOAK_HOURS = '6'
npm run test:soak
node server.js
```

Abrir juego y panel en los enlaces del servidor; para emisión usar solo la URL del juego a 720 × 1280. No se necesitan tokens ni credenciales para los ensayos. Las identidades de tests son inventadas y no salen a TikTok.

Antes de merge, cerrar el PR descarta la propuesta sin tocar `main`. Tras un merge autorizado, crear una rama de reversión y revertir el commit de estabilización mediante otro PR; no revertir la documentación de diseño ni otras entregas. Conservar registros/capturas locales solo mientras sean necesarios y nunca guardar datos crudos de espectadores en Git.
