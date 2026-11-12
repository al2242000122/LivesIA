# Block Wars LIVE — plan de implementación local

Actualización: 2026-11-11. Estado: **implementado para ensayo local**, con pozo vertical y catálogo de18 eventos; OBS prolongado, TikFinity real y LIVE siguen pendientes. El encargo prioriza participación gratuita y conserva Snake. No merge automático ni promesas de audiencia, ingresos o LIVE verificado.

## Arquitectura y contratos acordados para esta entrega

JavaScript/Canvas y Node20+, sin nuevas dependencias npm. Módulos UMD utilizables con `require()` en pruebas y globals en navegador. Adaptador compartido bajo `integrations/`; motor, reglas y presentación separados bajo `games/block-wars/`. Por petición posterior del propietario, el render admite24 PNG originales de Minecraft26.3 importados localmente para bloques, picos y TNT. No se presentan como arte propio: la lógica, cielo, animación y efectos son implementación local, con gráficos procedurales de respaldo. Ver [REFERENCE_IMPLEMENTED.md](REFERENCE_IMPLEMENTED.md) para procedencia, diferencias y límites.

### Motor (`games/block-wars/engine.js`)

Exporta `createEngine(options)` y configuración estática `PICKAXES,MATERIALS,EFFICIENCY,BUFFS,EVENTS,LIMITS`. El modo compatible por defecto es `layout:'arena'`,20×25; la app pública usa `{seed:20261110,layout:'shaft',width:7,height:40,duration:180,eventInterval:60,reducedMotion:false}`. Objeto devuelto:

```js
const engine = createEngine({seed:42,layout:'shaft',width:7,height:40});
engine.update(0.05); // segundos; presupuesto acotado por actualización
engine.action({type:'tnt', team:'dark'}); // devuelve true si acepta; false si rechaza
engine.action({type:'pickaxe', team:'light', pickaxe:'gold'});
engine.action({type:'enchant', team:'dark', efficiency:5, unbreaking:3, fortune:3});
engine.pause(true); // false reanuda
engine.clearEffects(); // limpia entidades, cola, VFX y buffs; no publica ni envía datos
engine.configure({eventInterval:60,reducedMotion:true});
engine.reset(42);
const state = engine.state; // referencia para lectura por render, no copiar cada frame
```

`state`: `width,height,layout,blocks` (array row-major de bloque o null; bloque `{material,hp,maxHp,value}`), `teams.dark/light` (`score,blocks,pickaxe,durability,efficiency,unbreaking,fortune,progress,target,effectiveSpeed,unlocked,buffs,cooldowns`), `remaining,roundDuration,elapsed,round,phase,result,nextEventIn,paused,particles,effects,queue,entities,focus,activeEvent`. Coordenadas de target, partículas, efectos y entidades en celdas. Partículas `{x,y,vx,vy,life,color}`, efectos `{kind,x,y,age,duration}`; entidades `{kind,team,x,y,targetX,targetY,age,duration,size,rotation}` con origen adicional para la trayectoria. `focus={x,y,team}` señala el frente y el único pico visible; `activeEvent={kind,remaining,duration,team}` sincroniza el HUD. `phase` es `playing`/`summary`; resultado `dark`/`light`/`tie`/null.

El pozo abre dos columnas por ocho filas, elige bloques junto al cielo conectado y avanza hacia profundidad. Termina por tiempo, terreno agotado o frente que alcanza el piso; el resumen dura4s y luego genera otra ronda. Esto evita volver a paredes antiguas superiores y dejar la cámara mirando cielo vacío. Los picos se desbloquean y reparan gratuitamente. `configure({duration})` aplica a la próxima ronda; no altera el tiempo transcurrido de la actual.

Acciones del catálogo: `tnt,rainbow,mega,arrow,butterfly,nuke,tnt_rain,thunder,fire,rain,tsunami,black_hole,jackpot,demon,meteor,spin,fast,big`; también `mine,turbo,descomunal,repair,pickaxe,enchant`. Los explosivos del pozo descienden como objetos durante aproximadamente1.2s antes del impacto; ráfagas añaden0.08s por objeto. La trayectoria programada, radios, daño y cooldowns son decisiones de implementación, no física inferida de imágenes. Jackpot sólo duplica puntos virtuales. NUKE conserva cooldown global45s incluso entre rondas. Los buffs del catálogo cambian velocidad, ruta, desgaste, puntos o excavación; sus duraciones y cooldowns están en `config.js`.

Entidades+cola comparten máximo24 entradas; VFX24 y partículas160. Explosiones consumen como máximo32 operaciones y el presupuesto compartido con minería es40 por actualización. `update(dt)` limita a0.25s; velocidad efectiva máxima240 b/s y progreso64. Pausa congela relojes, mechas y partículas. `clearEffects()` limpia entidades, cola, VFX y buffs; emergencia del panel además elimina cargas pendientes de reglas y pausa.

### Reglas (`games/block-wars/rules.js`)

Exporta `createRules(engine, options)`; devuelve `{handle,flush,reset,configure,clearPending,metrics,state}`. `handle` acepta evento normalizado y devuelve booleano. Eventos `{type:'like'|'comment'|'follow'|'gift'|'subscribe_paid',source:'simulator'|'tikfinity',id,receivedAt,actor:{displayName,stableHash},data:{delta,text,count}}`. Identidad efímera del adaptador. `receivedAt` usa ms de reloj controlable en pruebas. Contadores separados por fuente, cooldown, equipos y dedupe acotados y con TTL. Gifts y suscripciones pagadas no producen acciones en Block Wars. Conserva `!dark,!light,!mine,!boom,!rain,!pico,!madera,!piedra,!oro,!diamante,!netherita`. Los18 alias de efectos admiten texto simple o `!`, sin distinguir mayúsculas; `!rain` conserva la votación y `Rain` solicita el efecto directo. Cooldown global de chat10s y por identidad/fuente15s. Umbral25 likes→TNT, con lotes y créditos pendientes cuando el motor rechaza. No sintetiza espectadores. Contrato completo en [CATALOG.md](CATALOG.md).

### Adaptador (`integrations/events.js`, `integrations/transport.js`)

`LiveEvents.createAdapter({now})` con `normalize(packet,source)` y métricas acotadas. `LiveTransport.connect({onEvent,onStatus})` devuelve `stop()`. Envelopes TikFinity planos/anidados validados; origen independiente del payload; dedupe por fuente/ID con TTL; rachas pendientes sin premiar; likes incrementales y procedencia separada. Reconexión SSE/WS con backoff y limpieza, mensajes agregados sin PII. Snake consume este mismo adaptador conservando reglas originales.

### Presentación (`games/block-wars/index.html`, `style.css`, `render.js`, `app.js`, `control.html`, `control.js`)

Ruta `/block-wars`, control `/block-wars/control`. Globals: `BlockWarsEngine`, `BlockWarsRules`, `LiveEvents`, `LiveTransport`; `render.js` exporta `BlockWarsRender.createRenderer(canvas)` con `draw(state,options)` o documenta su API al coordinador. App conecta motor/reglas/transporte y usa timestep fijo, limita catch-up al volver de suspensión. El panel usa `/api/command` con `target:'block-wars'`, tipos nuevos allowlist `bw_action,bw_settings,bw_pause,bw_reset,bw_emergency` y los gratuitos existentes `like,follow,chat`. No impacta Snake por defecto; sus comandos conservan destino snake. Acciones/configuración de control tipadas en servidor. Métricas locales sin nombres: `/api/block-wars/telemetry`, campos allowlist. El panel ofrece simulación, identidad ficticia, equipos, todos los picos/encantamientos/efectos, pausa/reinicio/emergencia, reducir movimiento y comparación de velocidades. Origen simulador visible aun con relay abierto. No etiquetar LIVE verificado automáticamente. Las opciones gratuitas se explican de forma discreta en el overlay.

Canvas720×1280: siete columnas de mundo más pared lateral de bedrock, bloques90px, cielo en el hueco, fracturas, pico grande, objetos TNT y HUD superpuesto. La app avanza a50ms con máximo cinco pasos por frame y reinicia acumulador al volver de suspensión. Cámara sigue `focus` hacia78% de la altura, suavizado exponencial de tasa7/s y delta visual máximo0.1s; al cambiar ronda vuelve al origen. Movimiento reducido elimina partículas y desactiva giro/desplazamientos decorativos. Estas cifras son decisiones locales y se prueban por separado de la lectura de las capturas.

## Capacidades locales implementadas

- [x] Adaptador compartido y consumo por Snake y Block Wars, pruebas de esquemas, duplicados, números, reconexión, fuentes y regresiones.
- [x] Motor y overlay autónomo: mapa con semilla, picos, desgaste, encantamientos, rondas y eventos gratuitos; modo `shaft` basado en las referencias y `arena` de compatibilidad.
- [x] Participación gratuita: equipos, cooldown, likes→TNT, votos, follow y catálogo18, con métricas por fuente y pagos ignorados.
- [x] Panel local, pausa, reinicio, emergencia, ajustes, diagnóstico y ensayos acelerados.
- [ ] Ensayo prolongado real en OBS, TikFinity instalado y cuenta autorizada; revisión visual humana final de escenas en movimiento.
- [ ] Regalos/suscripciones pagadas y publicación: fuera de esta entrega; sin autorización implícita.

Las marcas anteriores describen código local, no merge de ramas ni aprobación de PRs.

Cada unidad empieza con prueba fallida, implementación y prueba verde. Ejemplos de aceptación: dos semillas iguales producen el mismo mapa; 25 likes producen una TNT; repetir ID no duplica; pausa no consume duración; oro con eficiencia V alcanza 16.8 bloques/s en dureza 1; Nuke concurrente no supera cola/partículas ni detiene la ronda. Verificar pruebas desde checkout limpio, `npm run check`, CI Windows/Linux Node20/24, ensayo acelerado de motor y navegador vertical. Revisión adversarial antes de presentar los PRs. Capturas fuera de Git.

## Verificación ejecutada el11 de noviembre de2026

`node --test tests/block-engine.test.cjs tests/block-shaft.test.cjs tests/block-catalog.test.cjs`:37/37 pasan, incluidos replay,19 regresiones del motor anterior, los18 eventos, mechas, controles,100000 ticks de pozo y120000 de arena. La prueba del piso reprodujo el salto al techo antes de corregirlo.

`$env:SOAK_HOURS='6'; npm run test:block-soak`: el script usa motor y reglas reales con fixtures locales, primero seis horas virtuales de arena y luego seis de pozo. Arena:513 rondas; cola máxima10, partículas160, VFX14. Pozo7×40 a50ms:432000 pasos,1299 rondas,360 pausas,72 emergencias,1440 duplicados comprobados y2880 fixtures pagados sin efecto. Máximos del pozo: entidades19, cola3, conjunto19/24, partículas160/160, VFX19/24 y32 bloques removidos por paso, por debajo del presupuesto40. Los18 eventos y los cinco picos tuvieron acciones aceptadas. Con GC forzado y muestras después de la primera hora: heap arena4.72–4.79MiB; pozo5.16–5.25MiB. Son mediciones Node de esta ejecución, no RAM total del navegador ni prueba de ausencia de fugas en OBS.

La suite completa final114/114 y sintaxis32archivos pasaron también en una copia limpia del árbol staged sin PNG locales; ver VERIFICATION.md. Este registro no acredita sesiones reales de transmisión. Las etiquetas `tikfinity` del soak son fixtures; no se abrió una cuenta ni un transporte real.

## Límites de la entrega

Lista para ensayo local reproducible. La validación de versión instalada de TikFinity, una sesión prolongada real de OBS y acceso de la cuenta requieren el equipo/cuenta del creador. No activar regalos pagados en Block Wars, no instalar software de emisión ni conectar una cuenta sin instrucción. Sin audio externo; sonido opcional original puede ser sintetizado localmente solo con activación explícita del operador.
