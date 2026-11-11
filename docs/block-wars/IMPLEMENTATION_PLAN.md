# Block Wars LIVE — plan de implementación local

Fecha: 2026-11-10. Encargo del propietario: completar el modo de bloques para atraer audiencia mediante participación gratuita. Implementar sobre la estabilización `c50b681`, conservando Snake. No merge automático de los PRs ni promesas de audiencia, ingresos o LIVE verificado.

## Arquitectura y contratos acordados para esta entrega

JavaScript/Canvas y Node 20+, sin nuevas dependencias npm. Módulos UMD utilizables con `require()` en pruebas y globals en navegador. Arte procedural original, sin recursos externos. Adaptador compartido bajo `integrations/`; motor, reglas y presentación separados bajo `games/block-wars/`.

### Motor (`games/block-wars/engine.js`)

Exporta `createEngine(options)` y configuración de herramientas/materiales (puede usar `config.js`). Opciones: `{seed: 20261110, width:20, height:25, duration:180, eventInterval:60, reducedMotion:false}`. Objeto devuelto:

```js
const engine = createEngine({seed:42});
engine.update(0.05); // segundos; presupuesto acotado por actualización
engine.action({type:'tnt', team:'dark'}); // devuelve true si acepta; false si rechaza
engine.action({type:'pickaxe', team:'light', pickaxe:'gold'});
engine.action({type:'enchant', team:'dark', efficiency:5, unbreaking:3, fortune:3});
engine.pause(true); // false reanuda
engine.reset(42);
const state = engine.state; // referencia para lectura por render, no copiar cada frame
```

`state`: `width,height,blocks` (array row-major de bloque o null; bloque `{material,hp,maxHp,value}`), `teams.dark/light` (`score,blocks,pickaxe,durability,efficiency,unbreaking,fortune,progress,target,effectiveSpeed,unlocked`), `remaining,round,phase,result,nextEventIn,paused,particles,effects,queue`. Coordenadas de target/partículas/efectos en celdas del mapa. Partículas `{x,y,vx,vy,life,color}`, efectos `{kind,x,y,age,duration}`. `phase` es `playing`/`summary`; resultado `dark`/`light`/`tie`/null. Acciones: `mine,tnt,meteor,rain,nuke,turbo,descomunal,repair,pickaxe,enchant`. Nuke con cooldown global; explosiones y minería comparten presupuesto acotado. El temporizador del motor programa eventos gratuitos sin espectadores. Pausa congela tiempo de juego, emergencia vacía efectos/cola si se implementa como `clearEffects()`.

### Reglas (`games/block-wars/rules.js`)

Exporta `createRules(engine, options)`; devuelve `{handle(event),reset(),metrics,state}`. `handle` acepta evento normalizado y devuelve booleano. Eventos `{type:'like'|'comment'|'follow'|'gift'|'subscribe_paid',source:'simulator'|'tikfinity',id,receivedAt,actor:{displayName,stableHash},data:{delta,text,count}}`. Identidad efímera del adaptador. `receivedAt` usa ms de reloj controlable en pruebas. Separar contadores por fuente, cooldown y pertenencia de equipos acotados y con TTL. No aplicar gifts/subs pagadas a Block Wars. Comandos `!dark,!light,!mine,!boom,!rain,!pico,!madera,!piedra,!oro,!diamante,!netherita`. Umbral 25 likes → TNT; agregar ráfagas sin una operación por like. Votos y cooldowns de diseño. No sintetizar espectadores. Opciones validadas para umbral/cooldowns; exponer `metrics` agregadas y `state` de lectura para HUD (likes, progreso umbral, equipos/votos).

### Adaptador (`integrations/events.js`, `integrations/transport.js`)

`LiveEvents.createAdapter({now})` con `normalize(packet,source)` y métricas acotadas. `LiveTransport.connect({onEvent,onStatus})` devuelve `stop()`. Envelopes TikFinity planos/anidados validados; origen independiente del payload; dedupe por fuente/ID con TTL; rachas pendientes sin premiar; likes incrementales y procedencia separada. Reconexión SSE/WS con backoff y limpieza, mensajes agregados sin PII. Snake consume este mismo adaptador conservando reglas originales.

### Presentación (`games/block-wars/index.html`, `style.css`, `render.js`, `app.js`, `control.html`, `control.js`)

Ruta `/block-wars`, control `/block-wars/control`. Globals: `BlockWarsEngine`, `BlockWarsRules`, `LiveEvents`, `LiveTransport`; `render.js` exporta `BlockWarsRender.createRenderer(canvas)` con `draw(state,options)` o documenta su API al coordinador. App conecta motor/reglas/transporte y usa timestep fijo, limita catch-up al volver de suspensión. El panel usa `/api/command` con `target:'block-wars'`, tipos nuevos allowlist `bw_action,bw_settings,bw_pause,bw_reset,bw_emergency` y los gratuitos existentes `like,follow,chat`. No impacta Snake por defecto; sus comandos conservan destino snake. Acciones/configuración de control tipadas en servidor. Métricas locales sin nombres: `/api/block-wars/telemetry`, campos allowlist. El panel ofrece simulación, identidad ficticia, equipos, todos los picos/encantamientos/efectos, pausa/reinicio/emergencia, reducir movimiento y comparación de velocidades. Origen simulador visible aun con relay abierto. No etiquetar LIVE verificado automáticamente. Las opciones gratuitas se explican de forma discreta en el overlay.

## Secuencia de ramas y PRs

- [ ] Adaptador compartido y migración de Snake: `codex/shared-events`, base estabilización. Pruebas de ambos esquemas, duplicados, números, reconexión, fuentes y regresiones Snake.
- [ ] Motor + overlay autónomo: `codex/block-wars-engine`, base adaptador. Minería con semilla, picos, durabilidad, encantamientos, explosiones acotadas, rondas; juego completo sin público. PR independiente.
- [ ] Participación gratuita: `codex/block-wars-free-play`, base motor. Equipos/cooldown, likes→TNT, votos/herramientas/follow, métricas por fuente. PR independiente.
- [ ] Panel, diagnóstico y resistencia: `codex/block-wars-controls`, base participación. Controles locales validados, emergencia, ajustes, telemetría agregada, comparación de herramientas y guía de emisión. PR independiente.

Cada unidad empieza con prueba fallida, implementación y prueba verde. Ejemplos de aceptación: dos semillas iguales producen el mismo mapa; 25 likes producen una TNT; repetir ID no duplica; pausa no consume duración; oro con eficiencia V alcanza 16.8 bloques/s en dureza 1; Nuke concurrente no supera cola/partículas ni detiene la ronda. Verificar pruebas desde checkout limpio, `npm run check`, CI Windows/Linux Node20/24, ensayo acelerado de motor y navegador vertical. Revisión adversarial antes de presentar los PRs. Capturas fuera de Git.

## Límites de la entrega

Lista para ensayo local reproducible. La validación de versión instalada de TikFinity, una sesión prolongada real de OBS y acceso de la cuenta requieren el equipo/cuenta del creador. No activar regalos pagados en Block Wars, no instalar software de emisión ni conectar una cuenta sin instrucción. Sin audio externo; sonido opcional original puede ser sintetizado localmente solo con activación explícita del operador.
